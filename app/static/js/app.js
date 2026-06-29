/**
 * app.js: JS core translation engine and UI coordinator for Live Translation AI.
 */

import { startAudioPlayerWorklet } from "./audio-player.js";
import { startAudioRecorderWorklet } from "./audio-recorder.js";

// Session State variables
const userId = "demo-user";
const sessionId = "session-" + Math.random().toString(36).substring(7);
let websocket = null;
let isAudioEnabled = false;

// Audio context nodes
let audioPlayerNode = null;
let audioPlayerContext = null;
let audioRecorderNode = null;
let audioRecorderContext = null;
let micStream = null;

// Subtitle state tracking
let activeSubtitleElement = null;
let activeInputText = "";
let activeOutputText = "";
let isBilingual = false;
let isWaitingForChatResponse = false;
let isReconnectingForConfig = false;
let reconnectTimer = null;

// DOM Elements
const selectFrom = document.getElementById("selectFrom");
const selectTo = document.getElementById("selectTo");
const enableBilingualMode = document.getElementById("enableBilingualMode");
const enableProactivity = document.getElementById("enableProactivity");
const enableAffectiveDialog = document.getElementById("enableAffectiveDialog");

const statusIndicator = document.getElementById("statusIndicator");
const statusText = document.getElementById("statusText");
const subtitlesWrapper = document.getElementById("subtitlesWrapper");
const subtitlePlaceholder = document.getElementById("subtitlePlaceholder");
const messagesDiv = document.getElementById("messages");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("message");
const sendButton = document.getElementById("sendButton");
const clearConsoleBtn = document.getElementById("clearConsole");

const startAudioButton = document.getElementById("startAudioButton");
const cameraButton = document.getElementById("cameraButton");
const exportButton = document.getElementById("exportButton");
const waveformSvg = document.querySelector(".waveform-svg");

// Modal Elements
const cameraModal = document.getElementById("cameraModal");
const cameraPreview = document.getElementById("cameraPreview");
const closeCameraModal = document.getElementById("closeCameraModal");
const cancelCamera = document.getElementById("cancelCamera");
const captureImageBtn = document.getElementById("captureImage");
let cameraStream = null;

// Chat UI Tracking
let currentChatBubbleElement = null;
let currentChatTextAccumulator = "";

// ----------------------------------------------------
// 1. Connection & WebSocket Telemetry
// ----------------------------------------------------

function connectWebsocket() {
  if (websocket) {
    websocket.close();
  }

  updateConnectionStatus("connecting", "Connecting...");

  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const fromLang = selectFrom.value;
  const toLang = selectTo.value;
  isBilingual = enableBilingualMode.checked;
  
  // Construct WS URL with parameters
  const baseUrl = `${wsProtocol}//${window.location.host}/ws/${userId}/${sessionId}`;
  const params = new URLSearchParams();
  params.append("from_lang", fromLang);
  params.append("to_lang", toLang);
  
  if (enableProactivity.checked) {
    params.append("proactivity", "true");
  }
  if (enableAffectiveDialog.checked) {
    params.append("affective_dialog", "true");
  }

  const connectionUrl = `${baseUrl}?${params.toString()}`;
  console.log("Connecting WebSocket to:", connectionUrl);
  
  websocket = new WebSocket(connectionUrl);
  websocket.binaryType = "arraybuffer";

  websocket.onopen = () => {
    updateConnectionStatus("connected", "Streaming Active");
    console.log("WebSocket connected.");
    sendConfigParameters();
  };

  websocket.onclose = () => {
    updateConnectionStatus("disconnected", "Disconnected");
    console.log("WebSocket disconnected.");
    stopVisualizer();
    
    if (!isReconnectingForConfig) {
      console.log("WebSocket connection closed. Reconnecting in 5 seconds...");
      reconnectTimer = setTimeout(connectWebsocket, 5000);
    }
  };

  websocket.onerror = (error) => {
    console.error("WebSocket error:", error);
    updateConnectionStatus("disconnected", "Error occurred");
    stopVisualizer();
  };

  websocket.onmessage = (event) => {
    // If incoming message is binary audio data from model
    if (event.data instanceof ArrayBuffer) {
      handleBinaryAudio(event.data);
      return;
    }

    // Parse JSON ADK Event
    try {
      const adkEvent = JSON.parse(event.data);
      handleAdkEvent(adkEvent);
    } catch (err) {
      console.warn("Non-JSON message received:", event.data);
    }
  };
}

function updateConnectionStatus(state, text) {
  statusIndicator.className = "status-indicator";
  statusText.textContent = text;
  
  if (state === "connected") {
    statusIndicator.classList.add("connected");
    sendButton.disabled = false;
  } else if (state === "connecting") {
    statusIndicator.classList.add("connecting");
  } else {
    statusIndicator.classList.add("disconnected");
    sendButton.disabled = true;
  }
}

function sendConfigParameters() {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify({
      type: "config",
      from: selectFrom.value,
      to: selectTo.value,
      bilingual: enableBilingualMode.checked
    }));
  }
}

// Reconnect WS on configuration adjustments
function handleConfigChange() {
  isReconnectingForConfig = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  connectWebsocket();
  isReconnectingForConfig = false;
}

selectFrom.addEventListener("change", handleConfigChange);
selectTo.addEventListener("change", handleConfigChange);
enableBilingualMode.addEventListener("change", () => {
  isBilingual = enableBilingualMode.checked;
  // Update UI badge
  const badge = document.getElementById("subtitleLanguageBadge");
  badge.textContent = isBilingual ? "Bilingual" : `${selectTo.value.toUpperCase()} Only`;
});
enableProactivity.addEventListener("change", handleConfigChange);
enableAffectiveDialog.addEventListener("change", handleConfigChange);

// ----------------------------------------------------
// 2. Incoming Event Processing & Subtitles Viewport
// ----------------------------------------------------

function handleAdkEvent(event) {
  console.log("[EVENT RECEIVED]", event);

  // 1. Audio stream interrupted
  if (event.interrupted === true) {
    if (audioPlayerNode) {
      audioPlayerNode.port.postMessage({ command: "endOfAudio" });
    }
    finalizeActiveSubtitle();
    finalizeActiveChatBubble(true);
    stopVisualizer();
    isWaitingForChatResponse = false;
    return;
  }

  // 2. Audio turn complete
  if (event.turnComplete === true) {
    finalizeActiveSubtitle();
    finalizeActiveChatBubble();
    stopVisualizer();
    isWaitingForChatResponse = false;
    return;
  }

  // 3. User spoken audio transcript (Source text)
  if (event.inputTranscription && event.inputTranscription.text) {
    startVisualizer();
    activeInputText = cleanCJKSpaces(event.inputTranscription.text);
    renderSubtitles();
  }

  // 4. Model translated speech response (Target text)
  if (event.outputTranscription && event.outputTranscription.text) {
    const text = event.outputTranscription.text;
    const finished = event.outputTranscription.finished;
    
    if (isWaitingForChatResponse) {
      handleIncomingChatText(text, finished);
    } else {
      activeOutputText = text;
      renderSubtitles();
    }
  }

  // 5. Written text chunks (AI Copilot chat responses)
  if (event.content && event.content.parts) {
    const textPart = event.content.parts.find(p => p.text);
    const audioPart = event.content.parts.find(p => p.inlineData);

    if (textPart && textPart.text) {
      handleIncomingChatText(textPart.text);
    }
    
    if (audioPart && audioPart.inlineData) {
      const audioBytes = base64ToArray(audioPart.inlineData.data);
      handleBinaryAudio(audioBytes);
    }
  }
}

function renderSubtitles() {
  if (subtitlePlaceholder) {
    subtitlePlaceholder.remove();
  }

  // Initialize or fetch the active subtitle card
  if (!activeSubtitleElement) {
    activeSubtitleElement = document.createElement("div");
    activeSubtitleElement.className = "subtitle-block active";
    subtitlesWrapper.appendChild(activeSubtitleElement);
    scrollToBottom(subtitlesWrapper);
  }

  if (isBilingual) {
    activeSubtitleElement.innerHTML = `
      <div class="bilingual-block">
        <div class="transcript-source">${activeInputText || "..."}</div>
        <div class="translation-target">${activeOutputText || "..."}</div>
      </div>
    `;
  } else {
    // Single language displays target translation, fallback to source transcript
    const textToDisplay = activeOutputText || activeInputText || "...";
    activeSubtitleElement.innerHTML = `
      <div class="subtitle-text">${textToDisplay}</div>
    `;
  }
}

function finalizeActiveSubtitle() {
  if (activeSubtitleElement) {
    activeSubtitleElement.classList.remove("active");
    activeSubtitleElement.classList.add("historical");
    
    // Auto purge extremely old subtitle items to conserve DOM tree size
    const blocks = subtitlesWrapper.querySelectorAll(".subtitle-block");
    if (blocks.length > 5) {
      blocks[0].remove();
    }
  }
  activeSubtitleElement = null;
  activeInputText = "";
  activeOutputText = "";
}

function startVisualizer() {
  waveformSvg.classList.add("active");
}

function stopVisualizer() {
  waveformSvg.classList.remove("active");
}

// ----------------------------------------------------
// 3. Audio & Worklet Processing
// ----------------------------------------------------

function handleBinaryAudio(arrayBuffer) {
  if (audioPlayerNode) {
    audioPlayerNode.port.postMessage(arrayBuffer);
  }
}

function toggleAudio() {
  if (!isAudioEnabled) {
    startAudioButton.disabled = true;
    startAudioButton.innerHTML = `<span class="icon">⌛</span><span>Starting...</span>`;

    // Initialize play & record worklets
    startAudioPlayerWorklet().then(([playerNode, playerCtx]) => {
      audioPlayerNode = playerNode;
      audioPlayerContext = playerCtx;

      return startAudioRecorderWorklet(audioRecorderHandler);
    }).then(([recorderNode, recorderCtx, stream]) => {
      audioRecorderNode = recorderNode;
      audioRecorderContext = recorderCtx;
      micStream = stream;

      isAudioEnabled = true;
      startAudioButton.disabled = false;
      startAudioButton.classList.add("active");
      startAudioButton.innerHTML = `<span class="icon">⏸️</span><span>Stop Audio</span>`;
      console.log("Audio pipeline initialized.");
    }).catch(err => {
      console.error("Audio init failure:", err);
      startAudioButton.disabled = false;
      startAudioButton.innerHTML = `<span class="icon">🎤</span><span>Start Audio</span>`;
      alert("Failed to access microphone. Please check permissions.");
    });
  } else {
    // Disable Audio streaming
    if (audioRecorderContext) {
      audioRecorderContext.close();
    }
    if (audioPlayerContext) {
      audioPlayerContext.close();
    }
    if (micStream) {
      micStream.getTracks().forEach(t => t.stop());
    }

    audioPlayerNode = null;
    audioRecorderNode = null;
    micStream = null;
    isAudioEnabled = false;

    startAudioButton.classList.remove("active");
    startAudioButton.innerHTML = `<span class="icon">🎤</span><span>Start Audio</span>`;
    stopVisualizer();
  }
}

function audioRecorderHandler(pcmData) {
  if (websocket && websocket.readyState === WebSocket.OPEN && isAudioEnabled) {
    websocket.send(pcmData);
  }
}

startAudioButton.addEventListener("click", toggleAudio);

// ----------------------------------------------------
// 4. AI Copilot Chat Interface
// ----------------------------------------------------

messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  // Render user text bubble
  appendChatBubble(text, "user");
  messageInput.value = "";

  // Stream text over WS
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    isWaitingForChatResponse = true;
    websocket.send(JSON.stringify({
      type: "text",
      text: text
    }));
  }
});

function appendChatBubble(text, sender) {
  const bubbleWrapper = document.createElement("div");
  bubbleWrapper.className = `message ${sender}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const meta = document.createElement("div");
  meta.className = "bubble-meta";
  meta.textContent = sender === "user" ? "You" : "AI Copilot";

  const content = document.createElement("div");
  content.className = "bubble-text";
  content.textContent = text;

  bubble.appendChild(meta);
  bubble.appendChild(content);
  bubbleWrapper.appendChild(bubble);
  messagesDiv.appendChild(bubbleWrapper);
  scrollToBottom(messagesDiv);
}

function handleIncomingChatText(textChunk, finished) {
  if (!currentChatBubbleElement) {
    // Create new agent bubble wrapper
    currentChatBubbleElement = document.createElement("div");
    currentChatBubbleElement.className = "message agent";

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    const meta = document.createElement("div");
    meta.className = "bubble-meta";
    meta.textContent = "AI Copilot";

    const content = document.createElement("div");
    content.className = "bubble-text";
    
    // Add typing/pending dots
    const loader = document.createElement("div");
    loader.className = "typing-indicator";
    loader.innerHTML = `
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    `;

    bubble.appendChild(meta);
    bubble.appendChild(content);
    bubble.appendChild(loader);
    currentChatBubbleElement.appendChild(bubble);
    messagesDiv.appendChild(currentChatBubbleElement);
  }

  const txtElement = currentChatBubbleElement.querySelector(".bubble-text");
  
  if (finished) {
    // Final transcription contains the complete text, replace entirely
    txtElement.textContent = textChunk;
    finalizeActiveChatBubble();
  } else {
    // Partial transcription - append to existing text
    currentChatTextAccumulator += textChunk;
    txtElement.textContent = currentChatTextAccumulator;
  }
  scrollToBottom(messagesDiv);
}

function finalizeActiveChatBubble(interrupted = false) {
  if (currentChatBubbleElement) {
    // Remove loading dots
    const indicator = currentChatBubbleElement.querySelector(".typing-indicator");
    if (indicator) {
      indicator.remove();
    }
    if (interrupted) {
      currentChatBubbleElement.classList.add("interrupted");
    }
  }
  currentChatBubbleElement = null;
  currentChatTextAccumulator = "";
}

// Hook up preset prompt chips
document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const promptText = chip.getAttribute("data-prompt");
    messageInput.value = promptText;
    messageForm.dispatchEvent(new Event("submit"));
  });
});

clearConsoleBtn.addEventListener("click", () => {
  messagesDiv.innerHTML = "";
});

// ----------------------------------------------------
// 5. Visual Context & Camera Modal
// ----------------------------------------------------

async function openCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 600 }, height: { ideal: 600 }, facingMode: "user" }
    });
    cameraPreview.srcObject = cameraStream;
    cameraModal.classList.add("show");
  } catch (err) {
    console.error("Camera access failed:", err);
    alert("Could not start camera preview: " + err.message);
  }
}

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
  }
  cameraPreview.srcObject = null;
  cameraStream = null;
  cameraModal.classList.remove("show");
}

function captureImageAndSend() {
  if (!cameraStream) return;

  const canvas = document.createElement("canvas");
  canvas.width = cameraPreview.videoWidth;
  canvas.height = cameraPreview.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);

  const base64Data = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify({
      type: "image",
      data: base64Data,
      mimeType: "image/jpeg"
    }));

    // Render placeholder bubble in Chat sidebar
    appendChatBubble("[📷 Visual Snapshot Shared with AI context]", "user");
  }
  closeCamera();
}

cameraButton.addEventListener("click", openCamera);
closeCameraModal.addEventListener("click", closeCamera);
cancelCamera.addEventListener("click", closeCamera);
captureImageBtn.addEventListener("click", captureImageAndSend);
cameraModal.addEventListener("click", (e) => {
  if (e.target === cameraModal) closeCamera();
});

// ----------------------------------------------------
// 6. Dual Transcript Export Flow
// ----------------------------------------------------

function exportMeetingMinutes() {
  // 1. Client-Side Markdown File Compilation
  const subtitleBlocks = subtitlesWrapper.querySelectorAll(".subtitle-block");
  let markdownText = `# Meeting Transcript - Live Translation AI\n`;
  markdownText += `* **Date/Time:** ${new Date().toLocaleString()}\n`;
  markdownText += `* **Session ID:** ${sessionId}\n\n`;
  markdownText += `## Translation Subtitles\n\n`;

  if (subtitleBlocks.length === 0 || (subtitleBlocks.length === 1 && subtitlePlaceholder)) {
    markdownText += `*No translation captions recorded.*\n`;
  } else {
    subtitleBlocks.forEach((block, idx) => {
      if (block.querySelector(".bilingual-block")) {
        const src = block.querySelector(".transcript-source").textContent;
        const tgt = block.querySelector(".translation-target").textContent;
        markdownText += `**[Speaker ${idx+1}]**\n* Original: ${src}\n* Translation: ${tgt}\n\n`;
      } else {
        const text = block.textContent.trim();
        if (text) {
          markdownText += `**[Caption ${idx+1}]** ${text}\n\n`;
        }
      }
    });
  }

  // Append Copilot Q&A
  const chatBubbles = messagesDiv.querySelectorAll(".message");
  if (chatBubbles.length > 0) {
    markdownText += `## Copilot Interactive Logs\n\n`;
    chatBubbles.forEach(msg => {
      const sender = msg.classList.contains("user") ? "User" : "AI Copilot";
      const text = msg.querySelector(".bubble-text").textContent;
      markdownText += `* **${sender}:** ${text}\n`;
    });
  }

  // Trigger Client-Side Download
  const blob = new Blob([markdownText], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `meeting_minutes_${sessionId}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  console.log("Client-side download triggered.");

  // 2. Fetch/Trigger Server-Side JSON Export
  const downloadUrl = `/exports/${sessionId}`;
  fetch(downloadUrl)
    .then(res => {
      if (res.ok) {
        return res.blob();
      }
      throw new Error("Server-side file not compiled/ready yet.");
    })
    .then(serverBlob => {
      const serverLink = document.createElement("a");
      serverLink.href = URL.createObjectURL(serverBlob);
      serverLink.download = `meeting_archive_${sessionId}.json`;
      document.body.appendChild(serverLink);
      serverLink.click();
      document.body.removeChild(serverLink);
      console.log("Server-side archive download succeeded.");
    })
    .catch(err => {
      console.warn("Server-side export skipped or failed:", err.message);
      alert("Minutes saved locally! Note: Server-side archive JSON is written upon session closure (closing audio/connection).");
    });
}

exportButton.addEventListener("click", exportMeetingMinutes);

// ----------------------------------------------------
// Helper Utilities
// ----------------------------------------------------

function scrollToBottom(container) {
  container.scrollTop = container.scrollHeight;
}

function cleanCJKSpaces(text) {
  const cjkPattern = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\uff00-\uffef]/;
  return text.replace(/(\S)\s+(?=\S)/g, (match, char1) => {
    const nextCharMatch = text.match(new RegExp(char1 + '\\s+(.)', 'g'));
    if (nextCharMatch && nextCharMatch.length > 0) {
      const char2 = nextCharMatch[0].slice(-1);
      if (cjkPattern.test(char1) && cjkPattern.test(char2)) {
        return char1;
      }
    }
    return match;
  });
}

function base64ToArray(base64) {
  let standardBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  while (standardBase64.length % 4) {
    standardBase64 += '=';
  }
  const binaryString = window.atob(standardBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// ----------------------------------------------------
// Initialize Connection on window load
// ----------------------------------------------------
window.addEventListener("load", () => {
  connectWebsocket();
});
