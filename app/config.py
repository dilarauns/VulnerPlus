import os
from dotenv import load_dotenv

load_dotenv()

FALCO_LOG_PATH = os.getenv("FALCO_LOG_PATH", "/var/log/falco.log")
