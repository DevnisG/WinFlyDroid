import os
import sys
from utils import generate_session_code

if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
    CERT_DIR = os.path.join(sys._MEIPASS, "certs")
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    CERT_DIR = os.path.join(BASE_DIR, "certs")

FILES_FOLDER = os.path.join(BASE_DIR, "f_folder")
CERT_FILE = os.path.join(CERT_DIR, "cert.crt")
KEY_FILE = os.path.join(CERT_DIR, "cert.key")
TEMP_CREDS_FILE = os.path.join(BASE_DIR, "temp_creds.json")

if not os.path.exists(FILES_FOLDER):
    os.makedirs(FILES_FOLDER)

SESSION_CODE = generate_session_code()
READY = False
