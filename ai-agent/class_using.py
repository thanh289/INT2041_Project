from typing import Optional, Literal
from pydantic import BaseModel, Field

# Use Pydantic models to define the structure of the data being passed between the agent and the functions it calls. 
# User input -> Request Type -> File Content (if applicable) -> Agent Response

class RequestType(BaseModel):
    """Router LLM call: Dertermine if user wants to summarize or read raw text."""
    
    # remove "describe image" and "normal chat" since they will be handled in agent.py
    # not through process_user_input() in function.py
    request_type: Literal["read file and summary", "read raw text", "unsupported"] = Field(
        description="Type of request being made"
    )
    confidence_score: float = Field(description="Confidence score between 0 and 1")
    description: str = Field(description="Cleaned description of the request")
    file_name: Optional[str] = Field(description="Name of the file if applicable")  # if client request involves a file, extract the file name
    nth_file: Optional[int] = Field(description="Nth file if applicable")           # if client request involves a file but does not specify the name, extract the nth file in the Downloads folder (e.g. first file, second file, etc.)

class Summarize(BaseModel):
    """Response model for text summarization."""
    
    raw_text: str = Field(description="Original text to be summarized")
    summary: str = Field(description="Summarized text")

class TTS(BaseModel):
    """Response model for text-to-speech."""
    
    raw_text: str = Field(description="Original text to be converted to speech") # Text after filtering out the request part
    audio_direction: Optional[str] = Field(description="Path to the saved audio file")

class FileContent(BaseModel):
    """Response model for file content reading."""
    
    file_name: str = Field(description="Name of the file intent reading")
    content: str = Field(description="Content of the file")
    summary: Optional[Summarize] = Field(description="Summary of the file content if applicable")

class AgentResponse(BaseModel):
    """Response from the agent: either completed or needs more info."""

    status: Literal["need_input", "done", "unsupported"] = Field(
        description="Status of the agent's response"
    )
    message: str = Field(
        description="Message from the agent"
    )
    audio: Optional[TTS] = Field(
        default=None,
        description="Path to the audio file if text-to-speech was performed"
    )
    raw_text: Optional[str] = Field(
        default=None,
        description="Raw text if read file was performed"
    )
    summary: Optional[Summarize] = Field(
        default=None,
        description="Summary text if summarization was performed"
    )
    intent: Literal["read raw text", "read file and summary", "unsupported"] = Field(
        description="The intent understood by the agent"
    )