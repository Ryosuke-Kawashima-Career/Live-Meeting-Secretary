import asyncio
import base64
import json
import warnings
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.agents import Agent
from google.adk.tools import google_search
from google.genai import types

from app.my_agent.agent import get_agent_instruction

# Suppress noisy warnings
warnings.filterwarnings("ignore", message="Your application has authenticated using end user credentials")
warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

# Load environment configuration
load_dotenv(Path(__file__).parent / ".env")

APP_NAME = "live-meeting-secretary"
app = FastAPI()

static_dir = Path(__file__).parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

session_service = InMemorySessionService()

# Ensure exports directory exists
EXPORTS_DIR = Path(__file__).parent / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

@app.get("/")
async def root():
    return FileResponse(static_dir / "index.html")

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)

@app.get("/exports/{session_id}")
async def get_session_export(session_id: str):
    """Retrieve the archived server-side session transcript JSON."""
    file_path = EXPORTS_DIR / f"meeting_{session_id}.json"
    if file_path.exists():
        return FileResponse(
            path=file_path, 
            media_type="application/json", 
            filename=f"meeting_{session_id}.json"
        )
    return JSONResponse(
        status_code=404, 
        content={"error": "Session transcript not found", "session_id": session_id}
    )

@app.websocket("/ws/{user_id}/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    session_id: str,
    from_lang: str = Query("auto"),
    to_lang: str = Query("ja"),
) -> None:
    await websocket.accept()
    print(f"Connection open: session_id={session_id}, from={from_lang}, to={to_lang}")

    # Dynamically build Agent instructions based on connection parameters
    instruction = get_agent_instruction(from_lang, to_lang)
    safe_session_id = "".join(c if c.isalnum() or c == "_" else "_" for c in session_id)
    session_agent = Agent(
        name=f"agent_{safe_session_id}",
        model="gemini-live-2.5-flash-native-audio",
        instruction=instruction,
        tools=[google_search],
    )

    session_runner = Runner(
        app_name=APP_NAME, 
        agent=session_agent, 
        session_service=session_service
    )

    run_config = RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=["AUDIO"],
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
    )

    session = await session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    if not session:
        await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id
        )

    live_request_queue = LiveRequestQueue()
    transcript_log: List[Dict[str, Any]] = []

    # Track text chunks in a turn for agent-chat logging
    current_agent_response = ""

    async def upstream_task() -> None:
        """Receives messages from WebSocket and sends to LiveRequestQueue."""
        while True:
            message = await websocket.receive()

            # Handle text messages (JSON)
            if "text" in message:
                json_message = json.loads(message["text"])

                # Handle text messages
                if json_message.get("type") == "text":
                    user_text = json_message["text"]
                    print(f"[UPSTREAM] Text query: {repr(user_text)}")
                    
                    # Log chat query on the server side
                    transcript_log.append({
                        "speaker": "user-chat",
                        "text": user_text,
                        "timestamp": datetime.utcnow().isoformat()
                    })

                    content = types.Content(
                        parts=[types.Part(text=user_text)]
                    )
                    live_request_queue.send_content(content)

                # Handle image messages
                elif json_message.get("type") == "image":
                    print("[UPSTREAM] Image received")
                    image_data = base64.b64decode(json_message["data"])
                    mime_type = json_message.get("mimeType", "image/jpeg")

                    # Log image sent event
                    transcript_log.append({
                        "speaker": "user-visual",
                        "text": f"[Image Sent: {len(image_data)} bytes, type {mime_type}]",
                        "timestamp": datetime.utcnow().isoformat()
                    })

                    image_blob = types.Blob(
                        mime_type=mime_type,
                        data=image_data
                    )
                    live_request_queue.send_realtime(image_blob)

            # Handle binary messages (audio input stream)
            elif "bytes" in message:
                audio_data = message["bytes"]
                audio_blob = types.Blob(
                    mime_type="audio/pcm;rate=16000",
                    data=audio_data
                )
                live_request_queue.send_realtime(audio_blob)

    async def downstream_task() -> None:
        """Receives Events from run_live() and sends to WebSocket."""
        nonlocal current_agent_response
        print("[DOWNSTREAM] Starting run_live()")

        async for event in session_runner.run_live(
            user_id=user_id,
            session_id=session_id,
            live_request_queue=live_request_queue,
            run_config=run_config,
        ):
            # 1. Check for spoken audio transcripts (for subtitles)
            if event.input_transcription and event.input_transcription.text and event.input_transcription.finished:
                transcript_log.append({
                    "speaker": "user-audio",
                    "text": event.input_transcription.text,
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            if event.output_transcription and event.output_transcription.text and event.output_transcription.finished:
                transcript_log.append({
                    "speaker": "agent-audio-translation",
                    "text": event.output_transcription.text,
                    "timestamp": datetime.utcnow().isoformat()
                })

            # 2. Check for written text chunks (for AI Copilot text responses)
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if part.text:
                        current_agent_response += part.text

            # 3. Check for turn completion (to finalize Copilot text answers)
            if event.turn_complete:
                if current_agent_response:
                    transcript_log.append({
                        "speaker": "agent-chat",
                        "text": current_agent_response,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                    current_agent_response = ""

            event_json = event.model_dump_json(exclude_none=True, by_alias=True)
            await websocket.send_text(event_json)

        print("[DOWNSTREAM] run_live() completed")

    try:
        await asyncio.gather(upstream_task(), downstream_task())
    except (WebSocketDisconnect, RuntimeError):
        print("Client disconnected")
    finally:
        live_request_queue.close()
        
        # Save session transcript log server-side
        if transcript_log:
            file_path = EXPORTS_DIR / f"meeting_{session_id}.json"
            try:
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump({
                        "session_id": session_id,
                        "user_id": user_id,
                        "from_lang": from_lang,
                        "to_lang": to_lang,
                        "timestamp": datetime.utcnow().isoformat(),
                        "transcript": transcript_log
                    }, f, ensure_ascii=False, indent=2)
                print(f"Successfully archived server-side transcript to {file_path}")
            except Exception as e:
                print(f"Failed to archive server-side transcript: {e}")

        print("Session terminated")
