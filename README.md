# Live Meeting Secretary (Live Translation AI)

An agentic live meeting assistant and translation engine built using **FastAPI** and the **Google ADK (Agent Development Kit) for Gemini Live API**. The system performs real-time audio translation between English and Japanese, renders stacked bilingual subtitles, provides an interactive AI Copilot for meeting summaries/actions, and exports transcripts and minutes.

---

## Prerequisites

- **Python**: Version 3.10 or higher (Python 3.13 recommended)
- **Package Manager**: [uv](https://github.com/astral-sh/uv) (fast Python package installer and resolver)
- **Google Cloud Platform (GCP)**: A GCP project with the Vertex AI API enabled (if using Vertex AI mode) or a Gemini Developer API Key.

---

## 1. Virtual Environment Setup

We recommend using `uv` to manage the virtual environment and dependencies for maximum speed and reliability.

### Step 1: Install `uv` (if not already installed)

In PowerShell, run:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### Step 2: Create a Virtual Environment

Navigate to the project root directory and create the `.venv` folder:

```powershell
uv venv
```

### Step 3: Activate the Virtual Environment

Activate the environment depending on your operating system:

- **Windows (PowerShell)**:

    ```powershell
    .venv\Scripts\Activate.ps1
    ```

* **Windows (Command Prompt)**:

    ```cmd
    .venv\Scripts\activate.bat
    ```

* **macOS / Linux**:

    ```bash
    source .venv/bin/activate
    ```

### Step 4: Install Project Dependencies

Install all package packages in editable mode:

```powershell
uv pip install -e .
```

---

## 2. Configuration & Environment Variables

Create an environment configuration file at `app/.env` (or copy from template) containing your Gemini Live API credentials.

Example content for `app/.env`:

```env
# Vertex AI settings (Google Cloud)
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_GENAI_USE_VERTEXAI=TRUE

# Optional: Developer API Key (Google AI Studio)
# Set GOOGLE_GENAI_USE_VERTEXAI=FALSE to use this instead
GEMINI_API_KEY=your-gemini-developer-api-key
```

---

## 3. Running the System

Follow these steps to run the backend and launch the web portal.

### Step 1: Run the FastAPI Application

Start the Uvicorn ASGI server. Ensure your virtual environment is active:

```powershell
.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

Alternatively, with hot reloading enabled (for development):

```powershell
.venv\Scripts\python -m uvicorn app.main:app --port 8000 --reload
```

### Step 2: Access the Frontend Portal

Open your web browser and navigate to:

```text
http://localhost:8000
```

---

## 4. Key Features & How to Use

1. **Select Languages**: Use the dropdowns in the top header to configure:
    - `Translate From`: Select a specific source language (English/Japanese) or use **Auto-Detect**.
    - `Translate To`: Select the target translation output language.
2. **Start Translation**: Click the **Start Audio** button in the bottom dock. Authorize microphone permissions in your browser. Speak in English/Japanese to view translated subtitles in real-time.
3. **Bilingual Subtitles**: Toggle **Bilingual Mode** in the header to display stacked captions containing both the original speaker audio transcription and the translated output text.
4. **AI Copilot Chat**: Use the right sidebar to ask questions about the meeting or request summaries. You can also click the quick prompt chips (e.g., `📝 Summarize`, `⚡ Action Items`) to trigger pre-configured prompts.
5. **Visual Context**: Click the **Camera Context** button in the dock to capture and share screenshots/images with the AI model for context-aware questions.
6. **Export Minutes**: Click the **Export Minutes** button in the bottom dock. This triggers:
    - A local browser download of the meeting transcript in Markdown (`.md`).
    - A server-side download of the complete JSON session logs (`.json`) archived from `app/exports/`.
