# Live Translation AI (Live Meeting Secretary) - UI/UX Design Description

This document defines the complete UI/UX design system, layout guidelines, micro-interactions, and visual guidelines for the Live Translation AI system. It references the baseline files in [static/index.html] and [static/css/style.css], and satisfies all functional and non-functional requirements in [requirements.md].

---

## 1. Design Philosophy: "Cosmic Midnight & Intelligent Clarity"

The Live Translation AI is a high-cognitive-load tool used during active business meetings. The UI must:

1. **Minimize Cognitive Friction:** Live subtitles must be legible from a distance. The visual hierarchy must prioritize current translation over sidebar features.
2. **Feel Premium and Alive:** Use the **Cosmic Midnight** theme—featuring deep dark backdrops, glassmorphic floating panels, and vibrant neon gradients—to create an advanced, high-tech AI atmosphere.
3. **Provide Continuous Reassurance:** Since real-time streaming relies on active connections, connection telemetry, microphone levels, and visualizers must feel highly responsive and tactile.

---

## 2. Visual Identity & Design System

### 2.1 Color Palette

To move away from plain, generic colors, the UI leverages custom HSL-based colors suited for a premium dark mode dashboard:

| Token Name | HSL Value | Hex Representation | Application Area |
| :--- | :--- | :--- | :--- |
| **Cosmic Void** | `hsl(232, 24%, 6%)` | `#08090f` | Main body background |
| **Deep Nebula** | `hsl(232, 18%, 11%)` | `#151722` | Cards, panels, sidebars |
| **Star Dust** | `hsl(220, 15%, 85%)` | `#d5d8e2` | Primary body text |
| **Supernova (Primary)** | `hsl(270, 95%, 68%)`| `#ad5eff` | Primary accents, buttons, user speech highlights |
| **Aurora Cyan (Secondary)** | `hsl(188, 100%, 50%)`| `#00e1ff` | Live streams, active mic, connection status glow |
| **Stellar Coral (Alert)** | `hsl(356, 85%, 60%)` | `#f43f5e` | Mute states, connection dropouts, errors |
| **Nebula Green (Success)** | `hsl(142, 70%, 45%)` | `#22c55e` | Connected states, confirmation actions |
| **Glass Border** | `hsla(255, 100%, 100%, 0.08)`| `rgba(255, 255, 255, 0.08)`| Thin panel borders |

### 2.2 Typography

We use two Google Fonts imported at the top of our stylesheet to deliver a polished display:

* **Primary Display / Headings:** **`Outfit`** (weights: 400, 500, 600) — clean, modern, geometric sans-serif for UI elements, titles, and buttons.
* **Body & Translations:** **`Inter`** (weights: 400, 500, 700) — highly optimized for onscreen legibility, used for live subtitles and chat messages.

### 2.3 Glassmorphism Specifications

All dashboard panels will float over a subtle background gradient using glassmorphism parameters:

```css
.glass-panel {
  background: rgba(21, 23, 34, 0.65);
  backdrop-filter: blur(16px) saturate(120%);
  -webkit-backdrop-filter: blur(16px) saturate(120%);
  border: 1px solid var(--glass-border);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  border-radius: 16px;
}
```

---

## 3. Layout Structure & UI Components

The page uses a responsive grid layout divided into three main operational zones.

```
+-----------------------------------------------------------------------------------+
|  [Logo] Live Trans AI  [From: Auto v] [To: JA v] [ ] Bilingual Mode   (•) Connected|  Header
+-----------------------------------------------------------------------------------+
|  WORKSPACE (Subtitle Viewport)                 |  INTERACTIVE AI COPILOT          |
|  +-------------------------------------------+ |                                  |
|  | (JA) 昨日は新しいロードマップについて...    | |  [Prompt: Summarize Meeting]     |  Main
|  | (EN) Yesterday, regarding the new roadmap..| |  [Prompt: Action Items]          |  Layout
|  +-------------------------------------------+ |                                  |  Split
|                                                |  +-----------------------------+ |
|                                                |  | AI: Sure! Here is a summary  | |
|                                                |  | of the points discussed...   | |
|  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~             |  +-----------------------------+ |
|  Waveform visualizer                           |  [Type your question...]    [>]  |
+-----------------------------------------------------------------------------------+
|                [ Microphone Toggle ]  [ Camera ]  [ Export ]                      |  Footer
+-----------------------------------------------------------------------------------+
```

### 3.1 Header (Global Topbar)

*   **Logo & Identity:** Bold text in `Outfit` with a linear gradient mask (`Supernova` to `Aurora Cyan`).
*   **Connection Telemetry:** A status pill containing a soft-pulsing green dot (`Nebula Green`) with text: "Streaming Active". If disconnected, it flashes "Disconnected" in `Stellar Coral` with a rapid blinking animation.
*   **Language Selection Dropdowns:**
    *   **"From" Dropdown:** Allows selecting the input language: `Auto-Detect (Default)`, `English (EN)`, or `Japanese (JA)`.
    *   **"To" Dropdown:** Allows selecting the output subtitle language: `English (EN)` or `Japanese (JA)`.
    *   Dropdown elements are custom styled with glassmorphic dropdown lists, showing a subtle violet shadow hover effect.
*   **Bilingual Mode Toggle:** A checkbox/slider to enable side-by-side or stacked display of both original transcription and translated subtitle lines.
*   **System Controls:** Quick toggles for *Proactivity* and *Affective Dialog* checkboxes, styled as sleek iOS-style sliders.

### 3.2 Subtitle Viewport (Center-Left Pane)

*   Occupies 65% of the screen width, using a black glass card as the background.
*   **Live Text Area:** Huge `Inter` typography.
    *   **Single-Language Mode:** Displays translated text at `28px` font size (`1.6` line-height) in bright frost white (`#fafbfc`).
    *   **Bilingual Mode:** Displays stacked captions.
        *   **Original Spoken Captions (Top):** Rendered in a smaller size (`20px`) and dimmed color (`#80869a`) to indicate the speaker's original audio transcript (e.g. *昨日は新しいロードマップについて話し合いました*).
        *   **Translated Subtitles (Bottom):** Rendered in a larger size (`28px`) and bright white (`#fafbfc`) with a soft glow effect matching the target language (e.g. *Yesterday, we discussed the new roadmap*).
*   **Vocal Waveform Visualizer:** Located at the bottom-center of the viewport. An active SVG path displaying a wave amplitude animation that expands and contracts dynamically in response to microphone input data.

### 3.3 Interactive AI Copilot Sidebar (Right Pane)

* Occupies 35% of the screen width.
* **Quick Actions Area:** A horizontal list of preset chips:
  * `📝 Summarize last 5m`
  * `⚡ Extract Action Items`
  * `💡 Define technical terms`
* **Chat Logs:** Translucent bubble cards. User bubbles have a dark violet background and float on the right. Agent bubbles have a deep slate background and float on the left.
* **Smart Suggestions Dock:** Small suggestion pills that display dynamically based on the transcription content (e.g. if someone says "Let's schedule next Monday", a suggestion pill appears: "Create Calendar Draft").

### 3.4 Floating Dock (Bottom Panel)

* A centralized glass pill floating 24px above the viewport bottom.
* **Microphone Button:** Circular button with a glowing background.
  * *Active State:* Radiant gradient background (`Supernova`), showing a small mic icon.
  * *Muted State:* Slime red background (`Stellar Coral`), with a diagonal line slash through the icon.
* **Context Camera Button:** Triggers a popup overlay to capture a snapshot of a slide or presentation, scaling down into the prompt field.

---

## 4. Key Interaction Flows & Micro-Animations

### 4.1 Audio Stream Telemetry Waveform

When streaming is active, the voice visualizer should display a running multi-band waveform. If the user is silent, the waveform displays as a flat line of glowing cyan dots.

```css
@keyframes soundWave {
  0% { transform: scaleY(0.2); }
  50% { transform: scaleY(1.0); }
  100% { transform: scaleY(0.2); }
}
.waveform-bar {
  animation: soundWave 1.2s ease-in-out infinite;
  transform-origin: center;
}
```

### 4.2 Subtitle Waterfall Transition

New sentences are added to the bottom. Old sentences slide upward and slowly transition from 100% opacity to 40% opacity, drawing the user's attention naturally to the latest translation.

```css
.subtitle-block.historical {
  opacity: 0.4;
  font-size: 24px;
  filter: grayscale(30%);
  transition: opacity 0.5s ease, font-size 0.5s ease;
}
.subtitle-block.active {
  opacity: 1;
  font-size: 28px;
  color: #fff;
  text-shadow: 0 0 10px rgba(0, 225, 255, 0.3);
}
```

### 4.3 Hover and Focus Micro-feedback

* **Buttons:** Scaling `transform: scale(1.05)` with `box-shadow: 0 0 20px rgba(173, 94, 255, 0.4)` on hover.
* **Input Fields:** Neon cyan outline shadow glow (`box-shadow: 0 0 12px rgba(0, 225, 255, 0.25)`) when focused.

---

## 5. Mobile & Tablet Responsiveness (Responsive Breakpoints)

* **Tablet Layout (Width < 1024px):** Subtitle Viewport and AI Copilot stack vertically. Subtitles sit on top (45% height) and the Copilot sits below (55% height).
* **Mobile Layout (Width < 768px):** Tabbed interface with two main views:
  * *Tab 1 (Translation):* Focuses entirely on the fullscreen live translation subtitles and the floating audio dock.
  * *Tab 2 (Copilot):* Fullscreen chat interface for interacting with the AI.
  * Tab transitions are handled with swipe gestures and a bottom tab bar.

---

## 6. Developer Implementation Specifications (EN/JA Integration)

To implement the bilingual English/Japanese showcase, the client-server message protocol and backend prompt configurations must be updated.

### 6.1 WebSocket Configuration Protocol
Upon connection or setting change, the client sends a configuration payload to the backend:
```json
{
  "type": "config",
  "from": "auto | en | ja",
  "to": "en | ja",
  "bilingual": true
}
```

### 6.2 Backend (FastAPI & Google ADK) Translation Engine
The FastAPI server intercepts this message and dynamically structures the `LiveRequestQueue` config:
1.  **Session & Agent Configuration:** The ADK Agent is configured with dynamic translation instructions.
2.  **System Instruction Templates:**
    *   **Auto-Detect & Bilingual (Default):**
        > "You are an expert bilingual simultaneous interpreter for English and Japanese. You will hear live audio in either English or Japanese. Transcribe the original speech exactly as spoken, and translate it to the counterpart language. You must output the result in a structured JSON string: `{"transcript": "[original language text]", "translation": "[translated text]"}`. Keep latency low."
    *   **Direct Translation (e.g., EN -> JA):**
        > "You are an expert English-to-Japanese simultaneous interpreter. You will receive English audio. Transcribe the English text and translate it to Japanese. Output format: `{"transcript": "[English speech]", "translation": "[Japanese translation]"}`."
3.  **JSON Event Dispatching:**
    *   The backend reads the JSON response from the Gemini Live stream and forwards it directly to the client:
    ```json
    {
      "type": "translation_update",
      "transcript": "昨日は新しいロードマップについて話し合いました。",
      "translation": "Yesterday, we discussed the new roadmap.",
      "bilingual": true
    }
    ```

### 6.3 Frontend (JS) Rendering Logic
The frontend receives the structured event and updates the subtitle element:
```javascript
function updateSubtitles(event) {
  const subtitleContainer = document.getElementById('messages');
  if (event.bilingual) {
    subtitleContainer.innerHTML = `
      <div class="subtitle-block active bilingual">
        <div class="transcript-source">${event.transcript}</div>
        <div class="translation-target">${event.translation}</div>
      </div>
    `;
  } else {
    subtitleContainer.innerHTML = `
      <div class="subtitle-block active">
        <div>${event.translation || event.transcript}</div>
      </div>
    `;
  }
}
```

