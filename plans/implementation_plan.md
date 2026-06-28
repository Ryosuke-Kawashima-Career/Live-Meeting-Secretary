# Implementation Plan - Live Translation AI (Live Meeting Secretary)

This document describes the step-by-step developer plan to implement the Live Translation AI system in the workspace root, adapting reference files from [references/app] and satisfying the requirements in [requirements.md] and [design.md].

---

## User Review Required

> [!IMPORTANT]
> **API Keys & Credentials:** The application requires a valid `GEMINI_API_KEY` set in the environment to connect to the Gemini Live API. A `.env` file must be created from the template.

> [!WARNING]
> **Web Audio API Gesture Constraints:** Browsers block microphone/audio contexts until the user interacts with the page. The frontend must guide the user to click a "Connect/Start" button before starting stream ingestion.

---

## Open Questions Resolved

> [!NOTE]
> **1. Auto-Detection vs Explicit Configuration:** Both are supported. The frontend defaults to "Auto-Detect", which configures a system prompt instructing Gemini to automatically translate the source language to the counterpart. If the user explicitly selects "English" or "Japanese" as the source, the system prompt updates to lock that direction.
>
> **2. Transcript Storage:** Both server-side storage and client-side frontend downloads are implemented.
>
> * *Server-Side:* The FastAPI backend saves meeting transcripts as JSON/Markdown logs under `app/exports/meeting_{session_id}.json` upon session close or manual trigger, exposing a `GET /exports/{session_id}` endpoint to retrieve or download them.
> * *Client-Side:* The frontend generates a client-side Markdown file download on the fly for immediate user saving.

---

## Proposed Changes

We will copy the base project layout from [references] to the workspace root, customize the files to implement the bilingual selectors, style the Cosmic Midnight dashboard, and configure the backend interpreter instructions.

### Step 1: Workspace Config & Environment Setup

#### [NEW] [pyproject.toml](file:///d:/adventure/Projects/Live-Meeting-Secretary/pyproject.toml)

* Create python package configuration using `google-adk>=1.26.0`, `fastapi`, `uvicorn`, `websockets`, and `python-dotenv`.
* Reference the structure from [references/pyproject.toml].

#### [NEW] [app/.env](file:///d:/adventure/Projects/Live-Meeting-Secretary/app/.env)

* Define environment configuration containing `GEMINI_API_KEY`.

##### Verification / Test Commands (Step 1)

* Verify virtual environment configuration and package compile safety:

  ```bash
  python -m py_compile pyproject.toml
  ```

* Check that the `.env` exists and contains the API key (simulate backend load):

  ```bash
  python -c "import os; from dotenv import load_dotenv; load_dotenv('app/.env'); print('GEMINI_API_KEY check passed:', bool(os.getenv('GEMINI_API_KEY')))"
  ```

---

### Step 2: Backend Components & WebSocket Protocol

#### [NEW] [app/main.py]

* Create FastAPI app with uvicorn integration.
* Implement WebSocket endpoint `/ws/{user_id}/{session_id}`.
* Implement connection state configuration listeners. When a WebSocket message `{"type": "config", ...}` is received, dynamically update the agent instructions or restart the live session with the new parameters.
* Implement backend transcript logging: append incoming spoken sentences and model responses to an in-memory session log.
* Implement `GET /exports/{session_id}` to retrieve saved transcript records.
* Upon WebSocket disconnect, save the accumulated session log to `app/exports/meeting_{session_id}.json`.

#### [NEW] [app/exports/]

* Directory for archiving server-side session transcripts.

#### [NEW] [app/my_agent/agent.py]

* Define the ADK Agent targeting `gemini-live-2.5-flash-native-audio`.
* Create modular instruction factory methods that generate system instructions for:
    1. *Bilingual Auto-Detect:* "Transcribe the spoken language, and translate it to the other language (EN <-> JA). Output in JSON format `{"transcript": "...", "translation": "..."}`."
    2. *English Spoken, Japanese Subtitles:* "Translate English speech to Japanese subtitles."
    3. *Japanese Spoken, English Subtitles:* "Translate Japanese speech to English subtitles."

#### [NEW] [app/my_agent/**init**.py]

* Expose the agent.

##### Verification / Test Commands (Step 2)

* Compile check Python backend files:

  ```bash
  python -m py_compile app/main.py app/my_agent/agent.py app/my_agent/__init__.py
  ```

* Launch server in background to test WebSocket connectivity:

  ```bash
  # Launch server: python -m uvicorn app.main:app --port 8000
  # Run WebSocket hand-shake client verification:
  python -c "import asyncio, websockets; asyncio.run(websockets.connect('ws://localhost:8000/ws/test-user/test-session'))"
  ```

* Verify export directory creation:

  ```bash
  python -c "import os; os.makedirs('app/exports', exist_ok=True); print('Exports folder OK:', os.path.exists('app/exports'))"
  ```

---

### Step 3: Frontend Visuals & Client Translation Engine

#### [NEW] [app/static/index.html]

* Adapt [references/app/static/index.html] into a premium dashboard grid:
  * **Header:** Add `<select>` dropdowns for "Translate From" (`auto`, `en`, `ja`) and "Translate To" (`en`, `ja`). Add a styled checkbox toggle for "Bilingual Mode".
  * **Subtitle Card:** Position a massive display box for live subtitles with support for dual-line text containers.
  * **Sidebar:** Interactive chat elements with fast action buttons for summarization and key points extraction.
  * **Waveform Overlay:** Interactive canvas/SVG waveform element indicating live voice telemetry levels.

#### [NEW] [app/static/css/style.css]

* Implement the Cosmic Midnight theme:
  * Deep background styling (`#08090f` background) and Slate grey cards (`#151722`).
  * Neon borders, glowing active indicators, and glassmorphic backdrop-filters (`blur(16px)`).
  * Styles for stacked subtitle layouts (dimmed transcription on top, glowing large translation below).
  * Pulsing animations for the connection status and microphone.

#### [NEW] [app/static/js/app.js]

* Rewrite connection setup and incoming event loops:
  * On dropdown/toggle changes, construct and send `{"type": "config", "from": ..., "to": ..., "bilingual": ...}` config frames.
  * Support JSON translation event parsing. If bilingual mode is active, display both source `transcript` and destination `translation` lines.
  * Hook up the camera modal, microphone stream, and speaker player worklets.
  * Enable preset Copilot sidebar buttons to submit instant text prompts (e.g. "Summarize last 5 minutes").
  * Implement "Export" button click handler that downloads a frontend-generated Markdown file of the transcript and queries the server `GET /exports/{session_id}` to trigger backend archiving.

#### [NEW] [app/static/js/audio-player.js]

#### [NEW] [app/static/js/audio-recorder.js]

#### [NEW] [app/static/js/pcm-player-processor.js]

#### [NEW] [app/static/js/pcm-recorder-processor.js]

* Copy worklet processor scripts from references directory to manage PCM audio buffer conversion and audio context capture.

##### Verification / Test Commands (Step 3)

* Verify index.html existence and accessibility:

  ```bash
  python -c "import os; print('Static files found:', all(os.path.exists(f'app/static/{x}') for x in ['index.html', 'css/style.css', 'js/app.js']))"
  ```

* Check server static hosting handles assets (simulate HTTP requests):

  ```bash
  python -c "import urllib.request; print('Static file test code:', urllib.request.urlopen('http://localhost:8000/static/index.html').getcode())"
  ```

---

## Verification Plan (Final System-Level)

### Automated Tests

* Validate syntax and module loading:

  ```bash
  python -m py_compile app/main.py app/my_agent/agent.py
  ```

### Manual Verification

1. **Launch Server:**
    * Run `python -m uvicorn app.main:app --reload` or use Hatch/pip run config.
2. **Verify UI Aesthetics:**
    * Access `http://localhost:8000`. Confirm deep dark Cosmic Midnight aesthetics, glassmorphic blur, and neon indicators.
3. **Verify Bilingual Functionality:**
    * Select *Translate From: English*, *Translate To: Japanese*.
    * Speak in English: Verify Japanese subtitles are rendered in real time.
    * Select *Translate From: Japanese*, *Translate To: English*.
    * Speak in Japanese: Verify English subtitles are rendered.
    * Toggle *Bilingual Mode*: Verify both Japanese speaker text and English translation appear stacked in the viewport.
4. **Verify AI Copilot:**
    * Click "Extract Action Items" in the sidebar and verify the AI prints a formatted summary list based on prior spoken dialog history.
5. **Verify Context Input:**
    * Open camera modal, capture an image, send to session, and check console logs for image transmission.
6. **Verify Server-Side & Frontend Storage Exports:**
    * Close session by disconnecting.
    * Verify a new json log file is created in `app/exports/`.
    * Click the "Export" button in the footer and verify the browser downloads a client-generated Markdown transcript.
