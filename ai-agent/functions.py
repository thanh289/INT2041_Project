import base64
from typing import List, Dict, Type, TypeVar

from pydantic import BaseModel
from google.genai import types

from class_using import RequestType, Summarize, TTS, AgentResponse, FileContent
from logger import logger
from const import MODEL
from client import client
from utils import (
    return_text_to_speech,
    find_file_in_downloads,
    read_file_content,
    get_nth_file_info,
)

model = MODEL
T = TypeVar("T", bound=BaseModel)


def _generate_structured_output(
    prompt: str,
    schema_model: Type[T],
    system_instruction: str,
) -> T:
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config={
            "system_instruction": system_instruction,
            "response_mime_type": "application/json",
            "response_json_schema": schema_model.model_json_schema(),
        },
    )

    if not getattr(response, "text", None):
        raise ValueError("Gemini returned empty structured output.")

    return schema_model.model_validate_json(response.text)


def route_request(user_input: str, context: List[Dict]) -> RequestType:
    logger.info("Routing request with context...")

    context_block = ""
    if context:
        for pair in context:
            user_msg = pair.get("user", "")
            bot_msg = pair.get("bot", "")
            context_block += f"User: {user_msg}\nAssistant: {bot_msg}\n"

    full_prompt = (
        "Here is the conversation history:\n"
        f"{context_block}\n"
        f"Now classify this new user request: {user_input}"
    )

    return _generate_structured_output(
        prompt=full_prompt,
        schema_model=RequestType,
        system_instruction="""
            You are an expert at classifying user requests into three categories:

            1. "read raw text"
            - When the user wants to view a file's raw content.
            - NOT requesting any summary.

            2. "read file and summary"
            - When the user asks to extract, understand, summarize, or explain the content of a file.

            3. "unsupported"
            - Use this for ANY request that is NOT "read raw text" or "read file and summary".

            Return only valid JSON matching the provided schema.
            """.strip(),
    )


def handle_summarization(text: str, max_words: int = 50) -> Summarize:
    logger.info("Handling summarization...")

    prompt = f"""
        Summarize the following text in about {max_words} words.

        Text:
        {text}

        Important:
        - Summarize only the file/text content.
        - Do not repeat the request.
        - Keep it concise and informative.
        """.strip()

    result = _generate_structured_output(
        prompt=prompt,
        schema_model=Summarize,
        system_instruction="You are a helpful assistant that summarizes text.",
    )
    result.raw_text = text
    return result


def handle_read_file_or_summary(route_result: RequestType, max_words: int = 50, intent_summary: bool=False) -> FileContent:
    """Handle reading a file or summarizing its content."""
    logger.info("Handling read file or summary...")

    if route_result.file_name:
        try:
            filepath = find_file_in_downloads(route_result.file_name)
            print(f"Found file at: {filepath}")
            file_content = read_file_content(filepath)
        except Exception as e:
            logger.error(f"Error reading file: {e}")
            raise

        if intent_summary:
            summary = handle_summarization(file_content, max_words=max_words)
            return FileContent(
                file_name=route_result.file_name,
                content=file_content,
                summary=summary
            )

        return FileContent(
            file_name=route_result.file_name,
            content=file_content,
            summary=None,
        )

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
            summary = handle_summarization(file_content, max_words=max_words)
            return FileContent(
                file_name=file_name,
                content=file_content,
                summary=summary
            )

        return FileContent(
            file_name=file_name,
            content=file_content,
            summary=None,
        )

    raise ValueError("No file_name or nth_file detected in route result.")


def handle_normal_chat(user_input: str, context: List[Dict]) -> str:
    logger.info("Handling normal chat...")

    context_block = ""
    if context:
        for pair in context:
            user_msg = pair.get("user", "")
            bot_msg = pair.get("bot", "")
            context_block += f"User: {user_msg}\nAssistant: {bot_msg}\n"

    full_prompt = (
        "Here is the conversation history:\n"
        f"{context_block}\n"
        f"Now respond to this new user request: {user_input}"
    )

    response = client.models.generate_content(
        model=model,
        contents=full_prompt,
        config={
            "system_instruction": "You are a helpful and friendly assistant."
        },
    )

    return (response.text or "").strip()


def handle_image_description(user_input: str, base64_image: str) -> str:
    logger.info("Handling image description...")

    image_bytes = base64.b64decode(base64_image)

    response = client.models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(
                data=image_bytes,
                mime_type="image/jpeg",
            ),
            user_input,
        ],
    )

    return (response.text or "").strip()


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
        read_file_and_summary = handle_read_file_or_summary(route_result, intent_summary=True)
        return AgentResponse(
            status="done",
            message="File read and summarized successfully.",
            summary=read_file_and_summary.summary,
            intent="read file and summary"
        )

    return AgentResponse(
        status="unsupported",
        message="Request type unsupported or confidence too low.",
        intent="unsupported",
    )


def handle_tts(text: str) -> TTS:
    logger.info("Preparing text for TTS...")
    cleaned_text = return_text_to_speech(text)
    return TTS(raw_text=cleaned_text, audio_direction=None)