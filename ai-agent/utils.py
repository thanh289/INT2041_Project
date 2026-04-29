import os
import requests
from logger import logger
from const import DOWNLOADS_PATH
from PyPDF2 import PdfReader
from docx import Document
from datetime import datetime, timedelta

BACKEND_BASE = os.getenv("BACKEND_BASE_URL")

def get_next_filename(output_dir: str) -> str:
    """
    Check the output directory for existing audio files and determine the next available filename.
    For example: if the directory contains "1.mp3", "2.mp3", and "3.mp3", 
    the function will return "4.mp3" as the next filename.
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        logger.info(f"Make dir: {output_dir}")

    existing_files = [f for f in os.listdir(output_dir) if f.endswith(".mp3")]

    if existing_files:
        max_num = max(int(f[:-4]) for f in existing_files)
    else:
        max_num = 0

    next_num = max_num + 1
    return os.path.join(output_dir, f"{next_num}.mp3")


def return_text_to_speech(text: str) -> str:
    logger.info("Preparing text for speech...")
    return text.strip()


def find_file_in_downloads(filename: str) -> str:
    for root, _, files in os.walk(DOWNLOADS_PATH):
        for f in files:
            if f.lower() == filename.lower():
                return os.path.join(root, f)
    raise FileNotFoundError(f"File '{filename}' not found in Downloads folder.")


def _deduplicate_lines(text: str) -> str:
    """
    Remove consecutive duplicate lines from extracted PDF text.
    PDFs sometimes embed the same text multiple times in their internal layer structure.
    """
    lines = text.splitlines()
    seen = []
    prev = None
    for line in lines:
        stripped = line.strip()
        # Skip if this line is identical to the previous non-empty line
        if stripped and stripped == prev:
            continue
        seen.append(line)
        if stripped:
            prev = stripped
    return "\n".join(seen)


def read_file_content(filepath: str, max_chars: int = 8000) -> str:
    """
    Read text file safely (supports .txt, .md, .csv, .json, .pdf, .docx).
    Truncates if too large to avoid overloading the model.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")

    ext = os.path.splitext(filepath)[1].lower()
    supported_exts = [".txt", ".md", ".csv", ".json", ".pdf", ".docx"]
    if ext not in supported_exts:
        raise ValueError(f"Unsupported file type '{ext}'. Supported: {supported_exts}")

    # --- Handle PDF ---
    if ext == ".pdf":
        text_content = ""
        try:
            reader = PdfReader(filepath)
            for page in reader.pages:
                page_text = page.extract_text() or ""
                text_content += page_text
                if len(text_content) > max_chars:
                    text_content = text_content[:max_chars]
                    break
        except Exception as e:
            raise ValueError(f"Error reading PDF: {e}")
        return _deduplicate_lines(text_content.strip())

    # --- Handle DOCX ---
    if ext == ".docx":
        text_content = ""
        try:
            doc = Document(filepath)
            for para in doc.paragraphs:
                text_content += para.text + "\n"
                if len(text_content) > max_chars:
                    text_content = text_content[:max_chars]
                    break
        except Exception as e:
            raise ValueError(f"Error reading DOCX: {e}")
        return text_content.strip()

    # --- Handle Plain Text Files ---
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read(max_chars)
    return content.strip()


def find_recent_pdfs_in_downloads(days: int = 7):
    """
    Find all PDF files in the Downloads folder within the last 'days' days.
    Sort them by the most recent modification (or creation) time — the newest file first.
    Return:
    List[dict] — Each element includes:
    {
        "file_name": str,
        "full_path": str,
        "modified_time": datetime
    }
    """
    recent_files = []
    now = datetime.now()
    cutoff_time = now - timedelta(days=days)

    for root, _, files in os.walk(DOWNLOADS_PATH):
        for f in files:
            if f.lower().endswith(".pdf"):
                file_path = os.path.join(root, f)
                try:
                    modified_time = datetime.fromtimestamp(os.path.getmtime(file_path))
                    if modified_time >= cutoff_time:
                        recent_files.append({
                            "file_name": f,
                            "full_path": file_path,
                            "modified_time": modified_time
                        })
                except Exception as e:
                    print(f"Error while accessing {file_path}: {e}")

    recent_files.sort(key=lambda x: x["modified_time"], reverse=True)
    return recent_files


def get_nth_file_info(number: int) -> str:
    recent_files = find_recent_pdfs_in_downloads()
    if 0 < number <= len(recent_files):
        return recent_files[number - 1]
    elif number == 0:
        return recent_files
    else:
        return recent_files[-1]


def ensure_user_exists(username: str):
    """
    Ensure the user exists in backend.
    If not, auto-register the user.
    """
    
    # Try login first
    try:
        resp = requests.post(
            f"{BACKEND_BASE}/api/account/login",
            json={"username": username},
            timeout=5
        )
        if resp.status_code == 200:
            print(f"[INFO] User '{username}' already exists (login OK).")
            return True
    except Exception as e:
        print(f"[WARNING] Login attempt failed: {e}")

    # If login failed → register user
    print(f"[INFO] User '{username}' does NOT exist. Registering...")

    try:
        resp = requests.post(
            f"{BACKEND_BASE}/api/account/register",
            json={"username": username},
            timeout=5
        )

        if 200 <= resp.status_code < 300:
            print(f"[SUCCESS] User '{username}' registered.")
            return True

        print(f"[ERROR] Registration failed: {resp.text}")
        return False

    except Exception as e:
        print(f"[ERROR] Failed to register: {e}")
        return False