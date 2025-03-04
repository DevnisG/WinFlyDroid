import os
import time
import signal
import asyncio
from fastapi import APIRouter, HTTPException, Form, Request, BackgroundTasks
from fastapi.responses import JSONResponse, HTMLResponse
import config
import utils

router = APIRouter()

@router.get("/accepted", response_class=HTMLResponse)
def accept():
    """Endpoint para aceptar el certificado."""
    config.ACCEPT = True
    html_content = """
  <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Certificado Aceptado</title>
        <!-- Google Fonts -->
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --primary: #2f3951;
            --accent: #55687a;
            --background: #1d1f29;
            --surface: rgba(47, 57, 81, 0.25);
            --text: #f0f0f0;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Roboto', sans-serif;
            background: linear-gradient(135deg, var(--primary), var(--accent));
            background-size: 200% 200%;
            animation: gradientAnimation 10s ease infinite;
            color: var(--text);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 1rem;
          }
          @keyframes gradientAnimation {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .glass-panel {
            background: var(--surface);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            padding: 2rem;
            max-width: 500px;
            width: 90%;
            text-align: center;
          }
          h1 {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 1rem;
          }
          p {
            font-size: 1.1rem;
            margin-bottom: 1.5rem;
            color: var(--text);
          }
          .button {
            display: inline-block;
            background: var(--primary);
            color: #fff;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            text-decoration: none;
            font-size: 1rem;
            transition: background 0.3s ease, transform 0.2s ease;
          }
          .button:hover {
            background: var(--accent);
            transform: translateY(-2px);
          }
          @media (max-width: 600px) {
            .glass-panel { padding: 1.5rem; }
            h1 { font-size: 1.5rem; }
            p { font-size: 1rem; }
            .button { padding: 10px 20px; font-size: 0.9rem; }
          }
        </style>
      </head>
      <body>
        <div class="glass-panel">
          <h1>Certificado Aceptado</h1>
          <p>El certificado ha sido aceptado correctamente.</p>
          <a href="https://winflydroid.netlify.app" class="button">Regresar a WinFlyDroid</a>
        </div>
      </body>
    </html>
    """
    return html_content

@router.get("/status")
def status():
    """Verifica el estado del servidor."""
    return {"message": "Server:✅ Hello from WinFlyDroid!"}

@router.post("/shutdown")
async def shutdown(request: Request, session_code: str = Form(...), background_tasks: BackgroundTasks = BackgroundTasks()):
    """Apaga el servidor de forma segura."""
    if session_code != config.SESSION_CODE:
        raise HTTPException(status_code=401, detail="Código de sesión incorrecto")
    
    def stop_server():
        time.sleep(1)
        os.kill(os.getpid(), signal.SIGTERM)
    
    background_tasks.add_task(stop_server)
    return JSONResponse(content={"message": "Server:🛑 WinFlyDroid is Off"})

@router.get("/areuready")
def is_ready():
    """Consulta el estado 'ready'."""
    return {"ready": config.READY}

@router.post("/imready")
async def set_ready(session_code: str = Form(...)):
    """Notifica que el móvil está listo."""
    if session_code != config.SESSION_CODE:
        raise HTTPException(status_code=401, detail="Código de sesión incorrecto")
    config.READY = True
    return {"message": "Mobile is ready"}
