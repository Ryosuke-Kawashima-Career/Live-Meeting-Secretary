# Revision Plan - AI Copilot Query Failure Resolution (Updated)

This document details the diagnostic analysis and the revised step-by-step plan to solve the issue where users cannot successfully submit or view queries in the **Interactive AI Copilot** section.

---

## Diagnostic Cause Analysis

We performed WebSocket event telemetry checks on the backend and client loops. The backend successfully processes text queries and returns speech transcription events. The failure to send and display queries in the chat sidebar is caused by three key bugs in the frontend client logic (`app.js`):

### 1. Lack of WebSocket Reconnection Loop (P0 - Critical)
*   **The Cause:** In our current `app.js` implementation, the `websocket.onclose` event handler only marks the connection status as "Disconnected" and stops the visualizer. It **does not** attempt to reconnect.
*   **The Bug:** If the backend FastAPI server restarts (e.g. during development updates or timeouts) or experiences temporary network drops, the WebSocket connection closes permanently. The send button is locked in the `disabled` state forever, making it impossible for the user to submit queries without manually refreshing the browser.
*   **The Solution:** Implement an automatic reconnect loop in the `onclose` handler using `setTimeout(connectWebsocket, 5000);`.

### 2. Transcription Accumulator Text Duplication (P1 - Major Display Glitch)
*   **The Cause:** The Gemini Live API streams speech transcriptions in two phases: partial chunks with `finished: false` containing individual word updates (e.g., `'The objective'`, `' of soccer'`), followed by a final event with `finished: true` containing the **entire accumulated sentence**.
*   **The Bug:** The current `handleIncomingChatText` implementation appends *every* transcription update to `currentChatTextAccumulator` indiscriminately. When the final event arrives, the entire sentence is appended to the partial words, creating massive, confusing duplications in the chat bubble (e.g., `"The objective of soccer is... The objective of soccer is for two teams..."`), making the chat response look broken.
*   **The Solution:** Modify `handleIncomingChatText` to accept the `finished` boolean. If `finished` is `false`, append the partial text chunk; if `finished` is `true`, replace the entire bubble text with the final complete sentence.

### 3. Reconnection Race Condition on Config Adjustments (P1)
*   **The Cause:** Changing the language dropdowns closes the WebSocket to reconnect with new parameters. Without state checks, the automatic reconnect loop could trigger a race condition, opening multiple parallel WebSockets.
*   **The Solution:** Add a flag `let isReconnectingForConfig = false;` to suppress the standard reconnect timeout if the connection is closed intentionally for configurations.

---

## Proposed Solutions & Revision Plan

We will modify [app/static/js/app.js](file:///d:/adventure/Projects/Live-Meeting-Secretary/app/static/js/app.js) without changing any backend logic.

### 1. Update State Variables
Add at the top of `app.js`:
```javascript
let isWaitingForChatResponse = false;
let isReconnectingForConfig = false;
let reconnectTimer = null;
```

### 2. Implement WebSocket Reconnect Loop
Update `websocket.onclose` and `handleConfigChange`:
```javascript
websocket.onclose = () => {
  updateConnectionStatus("disconnected", "Disconnected");
  stopVisualizer();
  
  if (!isReconnectingForConfig) {
    console.log("WebSocket connection closed. Reconnecting in 5 seconds...");
    reconnectTimer = setTimeout(connectWebsocket, 5000);
  }
};
```
When config changes:
```javascript
function handleConfigChange() {
  isReconnectingForConfig = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  connectWebsocket();
  isReconnectingForConfig = false;
}
```

### 3. Implement Differentiated Transcription Appending
Update `handleAdkEvent` output transcription routing:
```javascript
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
```
Update `handleIncomingChatText` logic:
```javascript
function handleIncomingChatText(textChunk, finished) {
  if (!currentChatBubbleElement) {
    // Create new agent bubble wrapper and typing indicator
    // ...
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
```

---

## Verification Plan

### Automated Check
- Validate compile safety:
  ```bash
  python -m py_compile app/main.py
  ```

### Manual Steps
1. Launch server: `python -m uvicorn app.main:app --port 8000`.
2. Connect to UI, verify status glows green ("Streaming Active").
3. Type a query, press Enter, verify chat bubble appears.
4. Verify response streams dynamically in the sidebar with no text duplications, and the typing indicator disappears on turn complete.
5. Kill the server and verify status turns red ("Disconnected"). Verify the client successfully reconnects automatically once the server is restarted.
