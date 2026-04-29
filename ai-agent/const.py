import pathlib

MODEL = "gemini-2.5-flash"
OUTPUT_DIR = "speech_output"
DOWNLOADS_PATH = str(pathlib.Path.home() / "Downloads")
PAIRS_TO_FLUSH = 2
LAST_N_PAIRS = 2