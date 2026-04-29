import base64
import os
from typing import List, Dict, Type, TypeVar

from pydantic import BaseModel
from google.genai import types
from groq import Groq
import azure.cognitiveservices.speech as speechsdk

from class_using import RequestType, Summarize, TTS, AgentResponse, FileContent
from logger import logger
from const import MODEL, OUTPUT_DIR
from client import client
from utils import (
    return_text_to_speech,
    find_file_in_downloads,
    read_file_content,
    get_nth_file_info,
    get_next_filename,
)

model = MODEL
T = TypeVar("T", bound=BaseModel)

# ---------------------------------------------------------------------------
# Groq client — handles ALL text tasks (routing + summarization)
# Gemini is reserved for image description only (multimodal).
# ---------------------------------------------------------------------------

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
GROQ_MODEL = "llama-3.3-70b-versatile"


def _groq_generate(system_prompt: str, user_prompt: str, json_mode: bool = False) -> str:
    """Call Groq and return plain text. Set json_mode=True for structured JSON output."""
    kwargs = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.0 if json_mode else 0.3,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    response = groq_client.chat.completions.create(**kwargs)
    return (response.choices[0].message.content or "").strip()


# ---------------------------------------------------------------------------
# Core functions
# ---------------------------------------------------------------------------

def route_request(user_input: str, context: List[Dict]) -> RequestType:
    """Classify the user request using Groq."""
    logger.info("Routing request via Groq...")

    context_block = ""
    if context:
        for pair in context:
            context_block += f"User: {pair.get('user', '')}\nAssistant: {pair.get('bot', '')}\n"

    system_prompt = """
        You are an expert at classifying user requests. Return ONLY a valid JSON object — no markdown, no explanation.

        Classify into exactly one request_type:
        - "read raw text": user wants to view a file's raw content, NOT a summary.
        - "read file and summary": user wants to summarize, understand, or extract info from a file.
        - "unsupported": anything NOT about reading or summarizing a file.

        Also extract:
        - file_name: exact filename if mentioned (e.g. "report.pdf"), else null.
        - nth_file: integer if user says "first", "second", "latest" (1=most recent), else null.
        - confidence_score: float 0.0-1.0.
        - description: one-sentence description of the request.

        Return ONLY this structure:
        {"request_type": "...", "confidence_score": 0.95, "description": "...", "file_name": null, "nth_file": null}
        """.strip()

    raw = _groq_generate(
        system_prompt=system_prompt,
        user_prompt=f"Conversation history:\n{context_block}\nClassify this request: {user_input}",
        json_mode=True,
    )

    try:
        return RequestType.model_validate_json(raw)
    except Exception as e:
        logger.error(f"Groq routing parse error: {e}. Raw: {raw}")
        return RequestType(
            request_type="unsupported",
            confidence_score=0.0,
            description="Failed to parse routing response.",
            file_name=None,
            nth_file=None,
        )


def handle_summarization(text: str, max_words: int = 50) -> Summarize:
    """Summarize text using Groq."""
    logger.info("Handling summarization via Groq...")

    summary_text = _groq_generate(
        system_prompt="You are a helpful assistant that summarizes text concisely. Return only the summary, nothing else.",
        user_prompt=f"Summarize the following text in about {max_words} words:\n\n{text}",
    )

    return Summarize(raw_text=text, summary=summary_text)


def handle_read_file_or_summary(route_result: RequestType, max_words: int = 50, intent_summary: bool = False) -> FileContent:
    """Handle reading a file or summarizing its content."""
    logger.info("Handling read file or summary...")

    # --- Case 1: specific file name ---
    if route_result.file_name:
        try:
            filepath = find_file_in_downloads(route_result.file_name)
            print(f"Found file at: {filepath}")
            file_content = read_file_content(filepath)
        except Exception as e:
            logger.error(f"Error reading file: {e}")
            raise
        if intent_summary:
            return FileContent(file_name=route_result.file_name, content=file_content,
                               summary=handle_summarization(file_content, max_words))
        return FileContent(file_name=route_result.file_name, content=file_content, summary=None)

    # --- Case 2: nth file (e.g. "first pdf", "second file") ---
    if route_result.nth_file:
        try:
            nth_file_info = get_nth_file_info(route_result.nth_file)
            filepath = nth_file_info["full_path"]
            file_name = nth_file_info["file_name"]
            print(f"Found nth file at: {filepath}")
            file_content = read_file_content(filepath)
        except Exception as e:
            logger.error(f"Error reading nth file: {e}")
            raise
        if intent_summary:
            return FileContent(file_name=file_name, content=file_content,
                               summary=handle_summarization(file_content, max_words))
        return FileContent(file_name=file_name, content=file_content, summary=None)

    # --- Case 3: "latest"/"recent"/unspecified → grab most recent PDF ---
    logger.info("No file_name or nth_file. Falling back to latest PDF in Downloads...")
    try:
        latest = get_nth_file_info(1)  # 1 = most recent
        filepath = latest["full_path"]
        file_name = latest["file_name"]
        print(f"Found latest file at: {filepath}")
        file_content = read_file_content(filepath)
    except Exception as e:
        logger.error(f"Error reading latest file: {e}")
        raise ValueError(f"Could not find any PDF in Downloads folder: {e}")

    if intent_summary:
        return FileContent(file_name=file_name, content=file_content,
                           summary=handle_summarization(file_content, max_words))
    return FileContent(file_name=file_name, content=file_content, summary=None)


def handle_normal_chat(user_input: str, context: List[Dict]) -> str:
    """General chat via Groq."""
    logger.info("Handling normal chat via Groq...")

    context_block = ""
    if context:
        for pair in context:
            context_block += f"User: {pair.get('user', '')}\nAssistant: {pair.get('bot', '')}\n"

    return _groq_generate(
        system_prompt="You are a helpful and friendly assistant.",
        user_prompt=f"Conversation history:\n{context_block}\nRespond to: {user_input}",
    )


def handle_image_description(user_input: str, base64_image: str) -> str:
    """Describe an image using Gemini."""
    logger.info("Handling image description via Gemini.")

    try:
        image_bytes = base64.b64decode(base64_image)
        response = client.models.generate_content(
            model=model,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                user_input,
            ],
        )
        return (response.text or "").strip()

    except Exception as e:
        msg = str(e)
        logger.error(f"Gemini vision failed: {msg}")

        if "503" in msg or "UNAVAILABLE" in msg or "high demand" in msg:
            return "VISION_TEMPORARILY_UNAVAILABLE: The camera frame was received, but the vision model is temporarily overloaded."

        return "VISION_ERROR: The camera frame was received, but I could not analyze it due to a temporary vision error."


def process_user_input(user_input: str, context: List[Dict]) -> AgentResponse:
    route_result = route_request(user_input, context=context)

    if route_result.request_type == "read raw text" and route_result.confidence_score >= 0.7:
        print("Processing read raw text request...")
        read_file = handle_read_file_or_summary(route_result, intent_summary=False)
        return AgentResponse(
            status="done",
            message="Read file successfully.",
            raw_text=read_file.content,
            intent="read raw text"
        )

    if route_result.request_type == "read file and summary" and route_result.confidence_score >= 0.7:
        print("Processing read file and summary request...")
        result = handle_read_file_or_summary(route_result, intent_summary=True)
        return AgentResponse(
            status="done",
            message="File read and summarized successfully.",
            summary=result.summary,
            intent="read file and summary"
        )

    return AgentResponse(
        status="unsupported",
        message="Request type unsupported or confidence too low.",
        intent="unsupported",
    )


def handle_tts(text: str, voice: str = "en-US-AriaNeural", output_dir: str = OUTPUT_DIR) -> TTS:
    """
    Convert text to speech using Azure TTS and save as .mp3.
    Returns a TTS object with the path to the saved audio file.
    Falls back gracefully if Azure credentials are missing.
    """
    logger.info("Preparing text for TTS...")
    clean_text = return_text_to_speech(text)

    speech_key = os.getenv("AZURE_SPEECH_KEY")
    speech_region = os.getenv("AZURE_SPEECH_REGION")

    if not speech_key or not speech_region:
        logger.warning("AZURE_SPEECH_KEY or AZURE_SPEECH_REGION not set — skipping synthesis.")
        return TTS(raw_text=clean_text, audio_direction=None)

    output_path = get_next_filename(output_dir)

    try:
        speech_config = speechsdk.SpeechConfig(
            subscription=speech_key,
            region=speech_region,
        )
        speech_config.speech_synthesis_voice_name = voice
        speech_config.set_speech_synthesis_output_format(
            speechsdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3
        )

        audio_config = speechsdk.audio.AudioOutputConfig(filename=output_path)
        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=speech_config,
            audio_config=audio_config,
        )

        result = synthesizer.speak_text_async(clean_text).get()

        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            logger.info(f"TTS audio saved to: {output_path}")
            return TTS(raw_text=clean_text, audio_direction=output_path)

        if result.reason == speechsdk.ResultReason.Canceled:
            details = result.cancellation_details
            logger.error(f"TTS canceled: {details.reason} — {details.error_details}")
            return TTS(raw_text=clean_text, audio_direction=None)

    except Exception as e:
        logger.error(f"TTS synthesis failed: {e}")

    return TTS(raw_text=clean_text, audio_direction=None)