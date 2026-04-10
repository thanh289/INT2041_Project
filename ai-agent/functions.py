from class_using import RequestType, Summarize, TTS, AgentResponse, FileContent
from logger import logger
from const import MODEL, MODEL_TTS, OUTPUT_DIR
from client import client
from utils import (
    get_next_filename,
    return_text_to_speech,
    find_file_in_downloads,
    read_file_content,
    get_nth_file_info,
)
import base64
from typing import List, Dict

model = MODEL
model_tts = MODEL_TTS


def route_request(user_input: str, context: List[Dict]) -> RequestType:
    """Router LLM call + context support to determine if user wants summary or raw read."""
    logger.info("Routing request with context...")

    # ---- Build contextual prompt ----
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

    # ---- LLM call ----
    completion = client.beta.chat.completions.parse(
        model=model,
        messages=[
            {
                "role": "system",
                "content": """
                    You are an expert at classifying user requests into two categories:

                    1. "read raw text" 
                        - When the user wants to view a file's raw content.
                        - NOT requesting any summary.

                    2. "read file and summary"
                        - When the user asks to extract, understand, summarize, or explain
                        the content of a file.
                    
                    3. "unsupported"
                        - Use this for ANY request that is NOT "read raw text" or "read file and summary".

                    Respond ONLY with a JSON object matching the schema:
                    {
                        "request_type": "...",
                        "confidence_score": float,
                        "description": "...",
                        "file_name": "..." (if the user requests reading a specific file),
                        "nth_file": int (if the user requests reading the nth most recent file)
                    }
                """,
            },
            {
                "role": "user",
                "content": full_prompt,
            },
        ],
        response_format=RequestType,
    )

    # Parse output 
    result = completion.choices[0].message.parsed
    logger.info(
        f"[Router] Classified as: {result.request_type} | confidence: {result.confidence_score}"
    )

    return result



def handle_summarization(text: str, max_words: int = 50) -> Summarize:
    """Handle text summarization."""
    logger.info("Handling summarization...")
    
    prompt = (
        f"""Summarize the following text in about {max_words} words:\n\n{text}
        User input might be had this format:
        - Requested for summarizing text
        - Text to be summarized under the request
        So please summarize the text only, without including the request part.
        """
    )
    
    completion = client.beta.chat.completions.parse(
        model=model,
        messages=[
            {"role": "system", "content": "You are a helpful assistant that summarizes text."},
            {"role": "user", "content": prompt},
        ],
        response_format=Summarize,
    )
    
    summary = completion.choices[0].message.parsed
    summary.raw_text = text
    logger.info("Summarization completed.")
    
    return summary


def handle_read_file_or_summary(route_result: RequestType, max_words: int = 50, intent_summary: bool=False) -> FileContent:
    """Handle reading a file or summarizing its content."""
    logger.info("Handling read file or summary...")

    # Extract file's name from user input
    # route_result = route_request(user_input)

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
        else:
            return FileContent(
                file_name=route_result.file_name,
                content=file_content,
                summary=Summarize(summary="Summary not requested.", raw_text=file_content)
            )
    elif route_result.nth_file:
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
        else:
            return FileContent(
                file_name=file_name,
                content=file_content,
                summary=Summarize(summary="Summary not requested.", raw_text=file_content)
            )



def handle_normal_chat(user_input: str, context: List[Dict]) -> str:
    """Handle normal chat requests."""
    logger.info("Handling normal chat...")

    # ---- Build contextual prompt ----
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

    completion = client.beta.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "You are a helpful and friendly assistant.",
            },
            {
                "role": "user",
                "content": full_prompt,
            },
        ],
    )

    response_text = completion.choices[0].message.content.strip()
    logger.info("Normal chat response generated.")

    return response_text

def handle_image_description(user_input: str, base64_image: str) -> str:
    """Handle image description requests."""
    logger.info("Handling image description...")
    result = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_input},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        max_tokens=100
    )
    return result.choices[0].message.content


def process_user_input(user_input: str, context: List[Dict]) -> AgentResponse:
    """Process user input and return an appropriate AgentResponse."""
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
    elif route_result.request_type == "read file and summary" and route_result.confidence_score >= 0.7:
        print("Processing read file and summary request...")
        read_file_and_summary = handle_read_file_or_summary(route_result, intent_summary=True)
        return AgentResponse(
            status="done",
            message="File read and summarized successfully.",
            summary=read_file_and_summary.summary,
            intent="read file and summary"
        )
    else:
        return AgentResponse(
            status="unsupported",
            message="Request type unsupported or confidence too low.",
            intent="unsupported"
        )

def handle_tts(text: str) -> TTS:
    """Handle text-to-speech conversion."""
    logger.info("Starting text-to-speech conversion...")

    # Clean the text to be read
    cleaned_text = return_text_to_speech(text)
    # Call the OpenAI Audio API for TTS
    with client.audio.speech.with_streaming_response.create(
        model=model_tts,
        voice="alloy",
        input=cleaned_text
    ) as response:
        audio_bytes = response.read()
    # Find next available filename
    output_path = get_next_filename(OUTPUT_DIR)
    # Save audio bytes to file
    with open(output_path, "wb") as f:
        f.write(audio_bytes)
    logger.info(f"Saved file in: {output_path}")
    return TTS(raw_text=cleaned_text, audio_content=audio_bytes, audio_direction=output_path)