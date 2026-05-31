import os
import base64
import asyncio
import io
import json
import uuid
from storage import ConversationCache
from dotenv import load_dotenv
from datetime import datetime
from logger import logger
from const import PAIRS_TO_FLUSH, LAST_N_PAIRS
from utils import ensure_user_exists
from PIL import Image
from typing import Optional, Literal
from functions import process_user_input, handle_image_description, get_weather_info, identify_currency_global, send_emergency_sos

from livekit import agents
from livekit import rtc
from livekit.agents import AgentSession, Agent, RunContext, get_job_context
from livekit.agents.voice.room_io.types import RoomOptions, AudioInputOptions
from livekit.plugins import noise_cancellation, silero, azure, openai
from livekit.agents.llm import function_tool
from livekit.agents import ConversationItemAddedEvent
from livekit.agents.llm import ImageContent, AudioContent
from livekit.agents.llm import ChatContext

load_dotenv(".env")

LOGIN_USERNAME = os.getenv("AGENT_LOGIN_USERNAME")

class Assistant(Agent):
    """A voice AI assistant agent."""
    
    def __init__(self, chat_ctx: Optional[ChatContext] = None) -> None:
        super().__init__(
            instructions="""
                You are a helpful voice AI assistant with special tools.
                You MUST prioritize using a tool over answering directly if a tool is relevant.
                When a tool returns a camera result, answer directly using that result.
                Never output raw tool calls such as <function=...>, JSON tool syntax, or XML-like tags.
                Always respond in plain text only. Do not use Markdown formatting such as **bold**, *italic*, backticks, headings, or bullet markers.

                - **Page/Mode Control:** If the user asks to switch screens, open a feature, or says a feature name, 
                you MUST call the 'set_frontend_mode' tool first:
                    - "object detection", "detect objects", "camera mode", "what do you see": mode "object_detection".
                    - "chat", "chatbox", "ask question", "assistant": mode "chat".
                    - "read files", "file reader", "summarize file", "read my pdf": mode "files".
                    - "sos", "sos tab", "emergency", "emergency tab": mode "emergency".

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

                - **Weather Tool:** If the user asks about the weather or temperature (e.g., "what is the weather in Hanoi?", "how's the weather?"), 
                you MUST call the 'get_weather' tool.

                - **Currency Tool:** If the user asks to identify money or a bill, call 'identify_currency'
                
                - **SOS Tool**: If the user is in danger or needs immediate help, call 'trigger_emergency_sos'.

                **CRITICAL RULE:** Do NOT ask the user to "upload a file." 
                The 'process_file_request' tool handles file access. 
                For all other general chat, respond normally.
            """,
            chat_ctx=chat_ctx,
        )
        self.context_pairs = []
        self.cache = None
        self.latest_coords = None

    def update_context(self, username: str):
        if not self.cache: # just initialize once
            self.cache = ConversationCache(username=username, pairs_to_flush=int(PAIRS_TO_FLUSH))
        new_pairs = self.cache.get_last_n_pairs(LAST_N_PAIRS)
        self.context_pairs = new_pairs

    
    @function_tool
    async def set_frontend_mode(
        self,
        ctx: RunContext,
        mode: Literal["object_detection", "chat", "files", "emergency"],
    ) -> str:
        """
        Sends a command to the user's frontend to switch between focused pages.
        Use this when the user asks for object detection, chat/chatbox, read files, or emergency/SOS.
        """
        logger.info(f"Sending 'set_frontend_mode' command: {mode}")

        try:
            room = get_job_context().room
            participant = next(iter(room.remote_participants.values()), None)
            if not participant:
                logger.warning("No remote participants found to send frontend mode.")
                return "Error: I can't find you in the room to switch screens."

            payload = {
                "type": "set_ui_mode",
                "mode": mode,
            }

            await room.local_participant.publish_data(
                json.dumps(payload),
                destination_identities=[participant.identity],
            )

            return f"Switched to {mode.replace('_', ' ')} mode."
        except Exception as e:
            logger.error(f"Error sending frontend mode command: {e}")
            return "An error occurred while trying to switch screens."

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
            logger.info("Calling Gemini Vision API...")

            vision_prompt = f"""
            You are analyzing a real camera frame from the user's live video feed.
            Answer the user's question using only the image.
            If the image is unclear, say it is unclear.
            Do not mention tools, APIs, functions, XML, or JSON.

            User question: {user_input}
            """.strip()

            vision_result = handle_image_description(vision_prompt, base64_image)
            logger.info(f"[VISION RESULT] {vision_result}")

            if vision_result.startswith("VISION_TEMPORARILY_UNAVAILABLE"):
                return "I received the camera image, but the vision model is temporarily overloaded. Please try again in a moment."

            if vision_result.startswith("VISION_ERROR"):
                return "I received the camera image, but I could not analyze it right now."

            return f"Based on the camera image: {vision_result}"
        except Exception as e:
            logger.error(f"Error in describe_camera_view: {e}")
            return f"Sorry, an error occurred while analyzing the image"
    
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
        
    @function_tool
    async def get_weather(self, ctx: RunContext, location: str) -> str:
        """
        Get the current weather for a specific city.
        Use this when the user asks about weather, temperature, or climate in a location.
        """
        logger.info(f"Tool 'get_weather' called for: {location}")
        try:
            result = get_weather_info(location)
            return result
        except Exception as e:
            logger.error(f"Error in get_weather tool: {e}")
            return f"I'm sorry, I couldn't fetch the weather for {location} right now."

    @function_tool
    async def identify_currency(self, ctx: RunContext) -> str:
        """
        Identify the value of the currency note currently shown to the camera.
        Use this when the user asks 'how much is this?', 'what is this bill?', or 'identify this money'.
        """
        logger.info("Tool 'identify_currency' called.")
        
        room = get_job_context().room
        participant = next(iter(room.remote_participants.values()), None)
        if not participant: return "I can't see you."

        video_track_pub = next((pub for pub in participant.track_publications.values()
                               if pub.track and pub.track.kind == rtc.TrackKind.KIND_VIDEO), None)
        if not video_track_pub: return "Please turn on your camera."

        video_stream = rtc.VideoStream(video_track_pub.track)
        try:
            event = await asyncio.wait_for(anext(video_stream), timeout=2.0)
            rgb_frame = event.frame.convert(rtc.VideoBufferType.RGB24)
            img = Image.frombytes("RGB", (rgb_frame.width, rgb_frame.height), rgb_frame.data)
            
            buf = io.BytesIO()
            img.save(buf, format="JPEG")
            base64_image = base64.b64encode(buf.getvalue()).decode("utf-8")

            return identify_currency_global(base64_image)
        finally:
            await video_stream.aclose()

    @function_tool
    async def trigger_emergency_sos(self, ctx: RunContext) -> str:
        """
        Activates emergency mode and sends the user's location to their family via email.
        Use this tool when the user says "Help me", "SOS", "I need help", or "Emergency".
        """
        logger.info("Emergency Tool activated via voice.")
        return send_emergency_sos(precise_coords=self.latest_coords)
    

# Phase 1 — Startup (runs once when the agent process boots)
    # entrypoint() is called by LiveKit. It registers the user with the backend, creates an empty Assistant object, 
    # and starts the AgentSession wiring together DeepSeek, Azure STT, Azure TTS, and Silero VAD. Nothing is talking yet.

# Phase 2 — Participant joins (runs once per user connection)
    # When a user connects to the LiveKit room, on_participant_connected fires. 
    # It creates a ConversationCache for that user, fetches their past conversation history from the backend, 
    # and injects it into a ChatContext so DeepSeek starts the conversation already knowing what was said before.

# Phase 3 — Conversation loop (runs every time the user speaks)
    # Azure STT transcribes the user's voice. DeepSeek reads the transcript and decides: 
    # does this need a tool, or can I answer directly? If a tool is needed (file, camera, time, UI control),
    # it calls it and feeds the result back to itself. Either way, DeepSeek produces a text response which Azure TTS speaks back to the user.
# Phase 4 — Persistence (after every response)
    # on_conversation_item_added saves both the user message and agent reply to ConversationCache. 
    # Once 5 pairs accumulate, it flushes them to the backend — then the loop waits for the next thing the user says.
async def entrypoint(ctx: agents.JobContext):
    """Entry point for the agent session. Add history to LLM through ChatContext"""

    username = LOGIN_USERNAME

    async def on_participant_connected(ctx: agents.JobContext, participant: rtc.RemoteParticipant):
        logger.info(f"Participant {participant.identity} joined the room")
        
        # Đảm bảo user (frontend) đã tồn tại trong DB để có thể đăng nhập/lưu lịch sử
        if not ensure_user_exists(participant.identity):
            logger.warning(f"Could not register or login participant {participant.identity}.")

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

        @ctx.room.on("data_received")
        def on_data_received(data: rtc.DataPacket):
            try:
                payload = json.loads(data.data)
                if payload.get("type") == "location_update":
                    assistant.latest_coords = payload.get("data")
                    logger.info(f"[SUCCESS] Received GPS coordinates: {assistant.latest_coords}")
                    return

                if payload.get("type") == "sos_trigger":
                    if payload.get("data"):
                        assistant.latest_coords = payload.get("data")
                    logger.info("[ALERT] SOS trigger received from frontend.")
                    asyncio.create_task(asyncio.to_thread(
                        send_emergency_sos,
                        precise_coords=assistant.latest_coords,
                    ))
                    return
            except Exception as e:
                logger.error(f"Error parsing frontend data: {e}")

    def on_participant_disconnected(participant: rtc.RemoteParticipant):
        logger.info(f"Participant disconnected: {participant.identity}")
        if (assistant.cache):
            assistant.cache.flush()   

    ctx.add_participant_entrypoint(entrypoint_fnc=on_participant_connected)
    ctx.room.on("participant_disconnected", on_participant_disconnected)
    
    assistant = Assistant()
    
    deepseek_api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not deepseek_api_key:
        logger.error("DEEPSEEK_API_KEY is not set in environment variables.")
        return

    voice_model = (
        os.environ.get("DEEPSEEK_VOICE_MODEL")
        or os.environ.get("DEEPSEEK_MODEL")
        or "deepseek-chat"
    )
    lowered_voice_model = voice_model.lower()
    if "reasoner" in lowered_voice_model or lowered_voice_model.startswith("deepseek-v4"):
        logger.warning(
            f"Model '{voice_model}' can trigger thinking-mode incompatibilities; switching voice model to 'deepseek-chat'."
        )
        voice_model = "deepseek-chat"

    session = AgentSession(
        stt=azure.STT(
            speech_key=os.environ.get("AZURE_SPEECH_KEY"),
            speech_region=os.environ.get("AZURE_SPEECH_REGION"),
        ),
        llm=openai.LLM(
            base_url="https://api.deepseek.com",
            api_key=deepseek_api_key,
            model=voice_model,
        ),
        tts=azure.TTS(
            speech_key=os.environ.get("AZURE_SPEECH_KEY"),
            speech_region=os.environ.get("AZURE_SPEECH_REGION"),
        ),
        vad=silero.VAD.load(min_silence_duration=0.8),
    )

    @session.on("conversation_item_added")
    def on_conversation_item_added(event: ConversationItemAddedEvent):
        # async without blocking main thread
        async def async_handler():
            if assistant.cache is None:
                room = get_job_context().room
                participant = next(iter(room.remote_participants.values()), None)
                if participant:
                    assistant.cache = ConversationCache(
                        username=participant.identity,
                        pairs_to_flush=int(PAIRS_TO_FLUSH),
                    )
                    assistant.update_context(participant.identity)
                    logger.info(
                        f"Conversation cache initialized lazily for {participant.identity}."
                    )
                else:
                    logger.debug(
                        "Skipping persistence because no remote participant is connected yet."
                    )
                    return
            
            role = event.item.role
            text_contents = event.item.text_content
            print(f"Conversation item added from {role}: {text_contents}. \
                  interrupted: {event.item.interrupted}")

            # NOTE: Do NOT manually update chat_ctx here.
            # LiveKit's AgentSession already manages chat_ctx internally.
            # Doing so causes every message to be appended twice, producing duplicated responses.
            # This handler is only for persistence (cache + backend).

            async def send_user_transcript_to_frontend(text: str) -> None:
                try:
                    room = get_job_context().room
                    participant = next(iter(room.remote_participants.values()), None)
                    if not participant:
                        return

                    payload = {
                        "type": "user_transcript",
                        "id": str(uuid.uuid4()),
                        "text": text,
                        "timestamp": int(datetime.now().timestamp() * 1000),
                    }

                    await room.local_participant.publish_data(
                        json.dumps(payload),
                        destination_identities=[participant.identity],
                    )
                except Exception as e:
                    logger.error(f"Error sending user transcript to frontend: {e}")

            # to iterate over all types of content:
            for content in event.item.content:
                if isinstance(content, str):
                    if role == "user":
                        # USER input text
                        logger.info(f"[USER] {content}")
                        assistant.cache.add_user_message(content[:800])
                        await send_user_transcript_to_frontend(content)
                    elif role == "assistant":
                        # AGENT response text
                        logger.info(f"[AGENT] {content}")
                        assistant.cache.add_agent_message(content[:800])
                elif isinstance(content, ImageContent):
                    print(f" - image: {content.image}")
                elif isinstance(content, AudioContent):
                    print(
                        f" - audio: {content.frame}, transcript: {content.transcript}"
                    )
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
        room_options=RoomOptions(
            video_input=True,
            audio_input=AudioInputOptions(
                noise_cancellation=noise_cancellation.BVC(),
            ),
        ),
    )

    # username = ctx.room.local_participant.identity
    # assistant.update_context(username=username)