import os
import time
import json
import random
import string
import socket
import aiofiles

def generate_session_code():
    """Genera un codigo de 4 digitos para la sesion."""
    return ''.join(random.choices(string.digits, k=4))

def get_chunk_size(file_size):
    """Calcula el Chuck en base a el tamano del archivo."""
    if file_size:
        chunk = file_size // 100
        min_chunk = 1 * 1024 * 1024   
        max_chunk = 64 * 1024 * 1024  
        if chunk < min_chunk:
            return min_chunk
        elif chunk > max_chunk:
            return max_chunk
        return chunk
    return 8 * 1024 * 1024

async def save_file_optimized(file, destination, chunk_size=None):
    if chunk_size is None:
        chunk_size = get_chunk_size(file.size)
    async with aiofiles.open(destination, "wb") as out_file:
        while True:
            data = await file.read(chunk_size)
            if not data:
                break
            await out_file.write(data)

def get_local_ip():
    """Obtiene la IP local para indicarle al Servidor donde corre la API."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

def create_temp_creds_file(session_code, file_path, local_ip):
    """Crea un archivo temporal con las credenciales que se pasan por json a node.js."""
    creds = {"ip": local_ip, "session_code": session_code}
    try:
        with open(file_path, "w") as f:
            json.dump(creds, f)
    except Exception as e:
        print(f"[ERROR] No se pudo crear {file_path}: {e}")
