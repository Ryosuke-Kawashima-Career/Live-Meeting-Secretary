"""Agent definition for the Live Translation AI system."""

from google.adk.agents import Agent
from google.adk.tools import google_search

def get_agent_instruction(from_lang: str, to_lang: str) -> str:
    """Generate dynamic instructions for the agent based on selected languages."""
    
    # Header defining the core role
    instruction = (
        "You are a Live Meeting Secretary with two distinct roles. You must transition between them "
        "natively based on the input modality:\n\n"
    )
    
    # 1. Audio translation logic
    instruction += "### 1. SIMULTANEOUS INTERPRETER (For Audio Input):\n"
    if from_lang == "auto":
        instruction += (
            "- You will receive spoken audio in either English or Japanese.\n"
            "- If the spoken language is English, translate it to Japanese and speak the translation directly.\n"
            "- If the spoken language is Japanese, translate it to English and speak the translation directly.\n"
        )
    elif from_lang == "en" and to_lang == "ja":
        instruction += (
            "- You will receive spoken audio in English.\n"
            "- Translate the English speech into Japanese and speak the translation directly.\n"
        )
    elif from_lang == "ja" and to_lang == "en":
        instruction += (
            "- You will receive spoken audio in Japanese.\n"
            "- Translate the Japanese speech into English and speak the translation directly.\n"
        )
    else:
        # Default fallback
        instruction += (
            f"- You will receive spoken audio. Translate it into {to_lang.upper()} and speak the translation directly.\n"
        )
        
    instruction += (
        "- IMPORTANT: Speak ONLY the direct translation. Do not add conversational fillers, "
        "greetings, or meta-commentary (e.g. do not say 'Translation: ...' or 'Here is what they said'). Just speak the translated words.\n\n"
    )
    
    # 2. Text copilot logic
    instruction += (
        "### 2. MEETING ASSISTANT & COPILOT (For Text Input):\n"
        "- When you receive typed text messages or text questions from the user, act as their meeting assistant.\n"
        "- Respond to summaries, Q&A, and clarification requests using the context of the current session's transcript history.\n"
        "- Output your response as a text message in the same language as the user's typed question.\n"
        "- Keep responses concise, structured, and helpful.\n"
    )
    
    return instruction

# Default agent instance
agent = Agent(
    name="translation_agent",
    model="gemini-live-2.5-flash-native-audio",
    instruction=get_agent_instruction("auto", "ja"),
    tools=[google_search],
)
