import sys
import os
if getattr(sys, 'frozen', False):  
    sys.path.insert(0, sys._MEIPASS)
else:
    sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

import config as config
import main  
import asyncio
import hypercorn.asyncio
from hypercorn.config import Config

if __name__ == '__main__':
    print("[INFO] Levantando el servidor en https://0.0.0.0:3100")
    config_h = Config()
    config_h.bind = ["0.0.0.0:3100"]
    config_h.certfile = config.CERT_FILE
    config_h.keyfile = config.KEY_FILE
    asyncio.run(hypercorn.asyncio.serve(main.app, config_h))
