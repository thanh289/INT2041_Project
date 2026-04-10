import pathlib

MODEL = "gpt-4o-mini"
MODEL_TTS = "gpt-4o-mini-tts"
OUTPUT_DIR = "speech_output"
DOWNLOADS_PATH = str(pathlib.Path.home() / "Downloads")
PAIRS_TO_FLUSH = 5
LAST_N_PAIRS = 5