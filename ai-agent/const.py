import pathlib

MODEL = "gemini-2.5-flash"
OUTPUT_DIR = "speech_output"
DOWNLOADS_PATH = str(pathlib.Path.home() / "Downloads")
PAIRS_TO_FLUSH = 5
LAST_N_PAIRS = 5