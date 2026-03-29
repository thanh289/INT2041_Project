import os
import cv2
import uuid
import base64
import numpy as np
import tempfile
from storage import ConversationCache
from dotenv import load_dotenv
from datetime import datetime
from logger import logger
from const import PAIRS_TO_FLUSH
from utils import ensure_user_exists
from typing import Optional, Dict, Any
from pydantic import BaseModel
import asyncio
import io
from PIL import Image
from client import client

from livekit import agents
from livekit import rtc
from livekit.agents import AgentSession, Agent, RoomInputOptions, RunContext, get_job_context
from livekit.plugins import noise_cancellation, silero, azure, google, openai
from livekit.agents.llm import function_tool
from livekit.agents import ConversationItemAddedEvent
from livekit.agents.llm import ImageContent, AudioContent
from livekit.agents.llm import ChatContext

from functions import process_user_input

load_dotenv(".env")

LOGIN_USERNAME = os.getenv("AGENT_LOGIN_USERNAME")

class Assistant(Agent):
    """A voice AI assistant agent."""
    
    def __init__(self, chat_ctx: Optional[ChatContext] = None) -> None:
        super().__init__(
            # instructions="""You are a helpful voice AI assistant.
            # You eagerly assist users with their questions by providing information from your extensive knowledge.
            # Your responses are concise, to the point, and without any complex formatting or punctuation including emojis, asterisks, or other symbols.
            # You are curious, friendly, and have a sense of humor.""",
            instructions="""
                You are a helpful voice AI assistant with special tools.
                You MUST prioritize using a tool over answering directly if a tool is relevant.

                - **File Tool:** If the user asks to read, summarize, or get info from a pdf file 
                (e.g., "summarize my report", "read the first PDF"), 
                you MUST call the 'process_file_request' tool.

                - **Vision:** If the user asks about what you see (e.g., "describe me", "what do you see?", "What is this?"), 
                you MUST call 'describe_camera_view' tool.

                - **Time Tool:** If the user asks for the date or time, call 'get_current_date_and_time'.

                **CRITICAL RULE:** Do NOT ask the user to "upload a file." 
                The 'process_file_request' tool handles file access. 
                For all other general chat, respond normally.
            """,
            chat_ctx=chat_ctx,
        )
        self.context_pairs = []
        self.cache = None

    def update_context(self, username: str):
        if not self.cache: # just initialize once
            self.cache = ConversationCache(username=username, pairs_to_flush=int(PAIRS_TO_FLUSH))
        new_pairs = self.cache.get_last_n_pairs(5)
        self.context_pairs = new_pairs

    # async def on_transcription(self, ctx: RunContext, transcription: str):
    #     logger.info(f"[USER] {transcription}")

    # async def on_response_sent(self, ctx: RunContext, response_text: str):
    #     logger.info(f"[AGENT] {response_text}")
    
    @function_tool
    async def get_current_date_and_time(self, ctx: RunContext) -> str:
        """Get the current date and time."""
        return datetime.now().strftime("Current date and time: %Y-%m-%d %H:%M:%S")
    
    @function_tool
    async def process_file_request(self, ctx: RunContext, user_input: str) -> str:
        """
        Finds and processes a pdf file based on a user's spoken request.
        This tool handles all logic for locating the file and extracting its content.
        """
        try:
            # assistant = ctx.agent
            # context_pairs = assistant.context_pairs
            context_pairs = self.context_pairs
            result = process_user_input(user_input, context=context_pairs)
            print("Process file request result:", result)
            if result.intent == "read raw text":
                print(result.raw_text)
                return f"I will read the file you requested: {result.raw_text}"
            elif result.intent == "read file and summary":
                print(result.summary.summary)
                return f"Summary of the file you requested: {result.summary.summary}"
            else:
                # return "Sorry, I could not understand your request."
                print(result.message)
                return result.message
        except Exception as e:
            print(f"Error in process_file_request: {e}")
            return f"Error while processing: {e}"
        
    @function_tool
    async def describe_camera_view(self, ctx: RunContext, user_input: str) -> str:
        """
        Describes what the camera currently sees. 
        Use this when the user asks a question about their live video feed.
        """
        logger.info("describe_camera_view tool called.")

        # Take room from RunContext, not from self, 
        # because we want the most up-to-date room state when the tool is called.
        room = get_job_context().room

        # Find participant and video track
        participant = next(iter(room.remote_participants.values()), None)
        if not participant:
            logger.warning("No remote participants found.")
            return "I don't see anyone else in the room."

        # track is media data stream, publication is the metadata about the track. 
        # We want to find the video track publication first, then get the track from it.
        video_track_pub = next(
            (pub for pub in participant.track_publications.values()
            if pub.track and pub.track.kind == rtc.TrackKind.KIND_VIDEO),
            None,
        )

        if not video_track_pub or not video_track_pub.track:
            logger.warning("Participant found, but no video track.")
            return "I am not receiving any video feed. Please ensure your camera is on."

        # create stream and wait for the first frame with a timeout
        # to avoid hanging if the video feed is not working.
        video_stream = rtc.VideoStream(video_track_pub.track)
        frame_to_process: Optional[rtc.VideoFrame] = None
        try:
            logger.info("Waiting for video frame...")
            # wait for first frame with a timeout of 2 seconds
            event = await asyncio.wait_for(anext(video_stream), timeout=2.0)
            frame_to_process = event.frame
            logger.info("Video frame received.")
        
        except asyncio.TimeoutError:
            logger.warning("Timed out waiting for video frame in tool.")
            return "I am not receiving any video feed. Please ensure your camera is on."
        except Exception as e:
            logger.error(f"Error getting frame from stream: {e}")
            return "An error occurred while accessing the video stream."
        finally:
            # close the stream to free up resources. 
            # really important to avoid memory leaks or too many open streams.
            await video_stream.aclose()

        if frame_to_process is None:
            logger.warning("Frame was None after stream.")
            return "I am not receiving any video feed. Please ensure your camera is on."

        # Frame processing logic:
        try:
            logger.info("Processing frame...")
            rgb_frame = frame_to_process.convert(rtc.VideoBufferType.RGB24)
            img = Image.frombytes(
                "RGB", (rgb_frame.width, rgb_frame.height), rgb_frame.data
            )
            buf = io.BytesIO()
            img.save(buf, format="JPEG")
            img_bytes = buf.getvalue()
            base64_image = base64.b64encode(img_bytes).decode("utf-8")

            # Calling OpenAI Vision
            logger.info("Calling OpenAI Vision API...")
            result = client.chat.completions.create(
                model=os.environ.get("OPENAI_MODEL"),
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
            print("OpenAI response:", result.choices[0].message.content)
            return result.choices[0].message.content

        except Exception as e:
            logger.error(f"Error in describe_camera_view: {e}")
            return f"Sorry, an error occurred while analyzing the image: {e}"
    


async def entrypoint(ctx: agents.JobContext):
    """Entry point for the agent session. Add history to LLM through ChatContext"""

    # back then 
    username = LOGIN_USERNAME
    if not ensure_user_exists(username):
        logger.error(
            "Cannot initialize assistant because user registration/login failed."
        )
    
    temp_cache = ConversationCache(
        username=username, pairs_to_flush=int(PAIRS_TO_FLUSH)
    )
    history_pairs = temp_cache.get_last_n_pairs(5)

    initial_ctx = ChatContext()
    message_count = 0
    for pair in history_pairs:
        if pair.get("user"):
            initial_ctx.add_message(role="user", content=pair["user"])
            message_count += 1
        if pair.get("bot"):
            initial_ctx.add_message(role="assistant", content=pair["bot"])
            message_count += 1
    logger.info(f"Loaded {message_count} messages into agent's ChatContext.")

    assistant = Assistant(chat_ctx=initial_ctx)
    assistant.cache = temp_cache
    assistant.context_pairs = history_pairs

    session = AgentSession(
        stt=azure.STT(
            speech_key=os.environ.get("AZURE_SPEECH_KEY"),
            speech_region=os.environ.get("AZURE_SPEECH_REGION"),
        ),
        llm=openai.LLM(
            api_key=os.environ.get("OPENAI_API_KEY"),
            model=os.environ.get("OPENAI_MODEL"),
        ),
        tts=azure.TTS(
            speech_key=os.environ.get("AZURE_SPEECH_KEY"),
            speech_region=os.environ.get("AZURE_SPEECH_REGION"),
        ),
        vad=silero.VAD.load(min_silence_duration=2.0), # Agent wait for 2 seconds of silence and consider the user has finished speaking before responding
    )

    @session.on("conversation_item_added")
    def on_conversation_item_added(event: ConversationItemAddedEvent):
        # async without blocking main thread
        async def async_handler():
            role = event.item.role
            text_contents = event.item.text_content
            print(
                f"Conversation item added from {role}: {text_contents}. interrupted: {event.item.interrupted}"
            )

            new_ctx = assistant.chat_ctx.copy()

            # to iterate over all types of content:
            for content in event.item.content:
                if isinstance(content, str):
                    if role == "user":
                        # USER input text
                        logger.info(f"[USER] {content}")
                        assistant.cache.add_user_message(content)
                    elif role == "assistant":
                        # AGENT response text
                        logger.info(f"[AGENT] {content}")
                        assistant.cache.add_agent_message(content)
                    new_ctx.add_message(role=role, content=content)
                elif isinstance(content, ImageContent):
                    # image is either a rtc.VideoFrame or URL to the image
                    print(f" - image: {content.image}")
                elif isinstance(content, AudioContent):
                    # frame is a list[rtc.AudioFrame]
                    print(
                        f" - audio: {content.frame}, transcript: {content.transcript}"
                    )
            await assistant.update_chat_ctx(new_ctx)
            assistant.update_context(assistant.cache.username)
            print("Updated context pairs:", assistant.context_pairs)

        asyncio.create_task(async_handler())
    
    @session.on("close")
    def on_session_close():
        logger.info("Session is closing.")
        assistant.cache.flush()


    await session.start(
        room=ctx.room,
        agent=assistant,
        room_input_options=RoomInputOptions(
            video_enabled=True,
            noise_cancellation=noise_cancellation.BVC(), 
        ),
    )

    # username = ctx.room.local_participant.identity
    # assistant.update_context(username=username)



if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))