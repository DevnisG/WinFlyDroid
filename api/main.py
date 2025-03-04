import os
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import hypercorn.asyncio
from hypercorn.config import Config
import config
import utils
from routes import file_routes, control_routes

app = FastAPI(

    title="Win Fly Droid API",
    description="API para enviar archivos entre Windows y Android",
    version="1.0.0"
)
# Para produccion desactivar la documentacion codigo:
""" app = FastAPI(docs_url=None,redoc_url=None, openapi_url=None) """


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(control_routes.router)
app.include_router(file_routes.router)

local_ip = utils.get_local_ip()
utils.create_temp_creds_file(config.SESSION_CODE, config.TEMP_CREDS_FILE, local_ip)

if __name__ == '__main__':
    print("[INFO] Levantando el servidor en https://0.0.0.0:3100")
    config_h = Config()
    config_h.bind = ["0.0.0.0:3100"]
    config_h.certfile = config.CERT_FILE
    config_h.keyfile = config.KEY_FILE
    asyncio.run(hypercorn.asyncio.serve(app, config_h))
