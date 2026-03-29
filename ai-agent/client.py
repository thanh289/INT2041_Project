from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

# Create an only client instance of OpenAI. 
# Other files can import this client to call OpenAI API without creating new instances.
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))