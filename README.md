# Live Translation AI (Live Meeting Secretary)

A real-time, low-latency simultaneous translation and AI Copilot assistant for multilingual business meetings.

Utilizing the **Google Agent Development Kit (ADK)** and the native-audio **Gemini Live API**, this application transcribes, translates, and lets you interactively query meeting contents (Q&A/summarization) on the fly in both **English** and **Japanese**.

---

## Key Features

1. **Real-Time Speech Translation (EN $\leftrightarrow$ JA):** Converts spoken English or Japanese speech into live text captions.
2. **Stacked Bilingual Subtitles:** Option to view the speaker's original language transcript alongside the counterpart translation in a clean, stacked layout.
3. **On-the-Fly AI Copilot Sidebar:** Run preset prompt actions (e.g., *Extract Action Items*, *Summarize Last 5 Mins*) or type custom questions to query details from the meeting history.
4. **Dual Transcript Storage:**
    * **Server-Side Archival:** Transcripts are automatically compiled and exported to `app/exports/meeting_{session_id}.json` upon session disconnect.
    * **Client-Side Download:** Download a markdown version of the transcript directly from the frontend interface.
5. **Visual Context Sharing:** Capture slide presentations or documents via your camera to feed into the Gemini Live session context.
6. **Cosmic Midnight Aesthetics:** Sleek, glassmorphic UI styled in a dark cosmic palette, equipped with active voice amplitude waveforms and connection indicators.

---

## Technical Architecture

* **Frontend:** Vanilla HTML5, CSS3 (translucent glass panels, CSS keyframe waveforms), and ES6 modules handling Web Audio API PCM capture (16kHz Mono).
* **Backend:** FastAPI WebSockets acting as a telemetry gateway utilizing the Google ADK Runner.
* **AI Engine:** Gemini Live API (`gemini-live-2.5-flash-native-audio` model) running in Bidirectional streaming mode.

---

## Setup & Installation

### 1. Prerequisites

Ensure you have Python 3.10 or higher installed.

### 2. Create Virtual Environment & Install Dependencies

We recommend using [uv](https://github.com/astral-sh/uv) for fast, reliable package resolution:

1. **Create the virtual environment**:
   ```bash
   uv venv
   ```
2. **Activate the virtual environment**:
   * On Windows (PowerShell):
     ```powershell
     .venv\Scripts\activate
     ```
   * On macOS/Linux:
     ```bash
     source .venv/bin/activate
     ```
3. **Install the package and dependencies in editable mode**:
   ```bash
   uv pip install -e .
   ```

*(Alternatively, if using standard python `venv` and `pip`)*:
```bash
python -m venv .venv
# Activate the environment, then run:
pip install -e .
```

### 3. Environment Configuration

Create a `.env` file inside the `app/` directory and configure your Gemini API Key:

1. Create `app/.env`.
2. Add the following entry:

   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

---

## How to Run

1. **Launch the Backend Server:**
    From the project root directory, run:

    ```bash
    python -m uvicorn app.main:app --reload
    ```

    This starts the server on `http://127.0.0.1:8000`.

2. **Open the Web Dashboard:**
    Navigate to `http://localhost:8000` in your web browser.

3. **Configure & Connect:**
    * Set the **Translate From** select (e.g., *Auto-Detect*, *English*, or *Japanese*).
    * Set the **Translate To** select (e.g., *English* or *Japanese*).
    * Toggle **Bilingual Mode** to view both original and translated text stacked.
    * Click **Start Audio** to initialize browser microphone input and voice playbacks.

4. **Use the Copilot Sidebar:**
    * As conversation transcripts accumulate, click **Extract Action Items** or **Summarize** in the right-side panel to trigger instant summaries.
    * Type custom messages in the text bar to query meeting history.

5. **Export Minutes:**
    * Click **Export** in the bottom panel to trigger a local browser download of the meeting transcript.
    * Check `app/exports/` for the server-side auto-archived JSON log.

---

## Verification & Tests

* **Syntax & Compile Check:**

    ```bash
    python -m py_compile app/main.py app/my_agent/agent.py
    ```

* **Environment Verify:**

    ```bash
    python -c "import os; from dotenv import load_dotenv; load_dotenv('app/.env'); print('API Key status:', bool(os.getenv('GEMINI_API_KEY')))"
    ```

* **Telemetry Server Connection Test:**

    ```bash
    python -c "import asyncio, websockets; asyncio.run(websockets.connect('ws://localhost:8000/ws/test-user/test-session'))"
    ```
