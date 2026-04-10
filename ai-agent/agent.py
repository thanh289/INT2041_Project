import os
import base64
import asyncio
import io
import json
from storage import ConversationCache
from dotenv import load_dotenv
from datetime import datetime
from logger import logger
from const import PAIRS_TO_FLUSH, LAST_N_PAIRS
from utils import ensure_user_exists
from PIL import Image
from typing import Optional, Literal
from functions import process_user_input, handle_image_description


from livekit import agents
from livekit import rtc
from livekit.agents import AgentSession, Agent, RoomInputOptions, RunContext, get_job_context
from livekit.plugins import noise_cancellation, silero, azure, google
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
            instructions="""
                You are a helpful voice AI assistant with special tools.
                You MUST prioritize using a tool over answering directly if a tool is relevant.

                - **File Tool:** If the user asks to read, summarize, or get info from a pdf file 
                (e.g., "summarize my report", "read the first PDF"), 
                you MUST call the 'process_file_request' tool.

                - **Vision:** If the user asks about what you see (e.g., "describe me", "what do you see?", "What is this?"), 
                you MUST call 'describe_camera_view' tool.

                - **Time Tool:** If the user asks for the date or time, call 'get_current_date_and_time'.
                
                - **UI/Device Control:** ALWAYS call the 'control_ui_device' tool when the user asks to control a device or UI element, 
                EVEN IF you think the device is already in that state. Do not assume the current state:
                    - "turn on/off camera": call 'control_ui_device' (target: "camera", status: "on"/"off").
                    - "mute/unmute" or "turn on/off microphone": call 'control_ui_device' (target: "microphone", status: "on"/"off").
                    - "open/close chat" or "show/hide chat": call 'control_ui_device' (target: "chat", status: "on"/"off").

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
        new_pairs = self.cache.get_last_n_pairs(LAST_N_PAIRS)
        self.context_pairs = new_pairs

    
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
            return handle_image_description(user_input, base64_image)
        except Exception as e:
            logger.error(f"Error in describe_camera_view: {e}")
            return f"Sorry, an error occurred while analyzing the image: {e}"
    
    @function_tool
    async def control_ui_device(
        self, 
        ctx: RunContext, 
        target: Literal["camera", "microphone", "chat"], 
        status: Literal["on", "off"]
    ) -> str:
        """
        Sends a command to the user's frontend to control UI elements or devices.
        Use this for:
        - "turn on/off camera" 
        - "turn on/off microphone" or "mute/unmute" 
        - "open/close chat" or "show/hide chat"
        """
        logger.info(f"Sending 'control_ui_device' command: {target} -> {status}")
        
        try:
            # Again, take room from RunContext
            room = get_job_context().room

            # Find participant
            participant = next(iter(room.remote_participants.values()), None)
            if not participant:
                logger.warning("No remote participants found to send RPC.")
                return "Error: I can't find you in the room to send the command."

            # create payload for the RPC command. 
            payload = {
                "type": f"control_{target}", # RPC
                "status": status
            }
            
            await room.local_participant.publish_data(
                json.dumps(payload),
                destination_identities=[participant.identity] # just for this participant
            )
            
            logger.info(f"Successfully sent command to {participant.identity}")
            return f"Command to turn {target} {status} has been sent."

        except Exception as e:
            logger.error(f"Error sending RPC 'control_ui_device': {e}")
            return "An error occurred while trying to send the command."


async def entrypoint(ctx: agents.JobContext):
    """Entry point for the agent session. Add history to LLM through ChatContext"""

    username = LOGIN_USERNAME

    async def on_participant_connected(ctx: agents.JobContext, participant: rtc.RemoteParticipant):
        logger.info(f"Participant {participant.identity} joined the room")
        temp_cache = ConversationCache(
            username=participant.identity, pairs_to_flush=int(PAIRS_TO_FLUSH)
        )
        try:
            history_pairs = temp_cache.get_last_n_pairs(LAST_N_PAIRS)
        except Exception as e:
            logger.warning(f"Cannot load history from backend: {e}")
            history_pairs = []
            
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
        assistant.cache = temp_cache
        assistant.context_pairs = history_pairs

        # Nạp vào agent
        await assistant.update_chat_ctx(initial_ctx)
        assistant.update_context(assistant.cache.username)

    def on_participant_disconnected(participant: rtc.RemoteParticipant):
        logger.info(f"Participant disconnected: {participant.identity}")
        if (assistant.cache):
            assistant.cache.flush()   

    ctx.add_participant_entrypoint(entrypoint_fnc=on_participant_connected)
    ctx.room.on("participant_disconnected", on_participant_disconnected)

    if (username is None) or (username.strip() == ""):
        logger.error("AGENT_LOGIN_USERNAME is not set in environment variables.")
        return
    

    if not ensure_user_exists(username):
        logger.error(
            "Cannot initialize assistant because user registration/login failed."
        )
    
    assistant = Assistant()

    google_api_key = os.environ.get("GOOGLE_API_KEY")
    if not google_api_key:
        logger.error("GOOGLE_API_KEY is not set in environment variables.")
        return

    google_model = os.environ.get("GOOGLE_MODEL", "gemini-2.5-flash")

    session = AgentSession(
        stt=azure.STT(
            speech_key=os.environ.get("AZURE_SPEECH_KEY"),
            speech_region=os.environ.get("AZURE_SPEECH_REGION"),
        ),
        llm=google.LLM(
            api_key=google_api_key,
            model=google_model,
        ),
        tts=azure.TTS(
            speech_key=os.environ.get("AZURE_SPEECH_KEY"),
            speech_region=os.environ.get("AZURE_SPEECH_REGION"),
        ),
        vad=silero.VAD.load(min_silence_duration=2.0),
    )

    @session.on("conversation_item_added")
    def on_conversation_item_added(event: ConversationItemAddedEvent):
        # async without blocking main thread
        async def async_handler():
            if assistant.cache is None:
                logger.warning("Conversation cache is not initialized yet; skipping persistence.")
                return
            
            role = event.item.role
            text_contents = event.item.text_content
            print(f"Conversation item added from {role}: {text_contents}. \
                  interrupted: {event.item.interrupted}")

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
    
    # @session.on("close")
    # def on_session_close():
    #     logger.info("Session is closing.")
    #     assistant.cache.flush()


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