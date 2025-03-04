import os
import time
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
import config
import utils

router = APIRouter()

@router.post("/upload")
async def upload_file(session_code: str = Form(...), file: UploadFile = File(...)):
    """Sube un archivo al servidor."""
    if session_code != config.SESSION_CODE:
        raise HTTPException(status_code=401, detail="Código de sesión incorrecto")
    file_location = os.path.join(config.FILES_FOLDER, file.filename)
    await utils.save_file_optimized(file, file_location)
    return {"message": f"Archivo '{file.filename}' subido correctamente.", "filename": file.filename}

@router.get("/download")
def download_file(session_code: str, filename: str):
    """Descarga un archivo del servidor."""
    if session_code != config.SESSION_CODE:
        raise HTTPException(status_code=401, detail="Código de sesión incorrecto")
    file_path = os.path.join(config.FILES_FOLDER, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return FileResponse(file_path, media_type='application/octet-stream', filename=filename)

@router.get("/list-files")
def list_files(session_code: str):
    """Listar los archivos disponibles en el servidor."""
    if session_code != config.SESSION_CODE:
        raise HTTPException(status_code=401, detail="Código de sesión incorrecto")
    
    files_list = []
    for filename in os.listdir(config.FILES_FOLDER):
        file_path = os.path.join(config.FILES_FOLDER, filename)
        if os.path.isfile(file_path):
            stats = os.stat(file_path)
            size_bytes = stats.st_size
            modified_time = time.strftime("%Y-%m-%d", time.localtime(stats.st_mtime))
            ext = os.path.splitext(filename)[1].lower()
            file_type = ext[1:].upper() if ext else "Unknown"
            files_list.append({
                "name": filename,
                "size": size_bytes,
                "type": file_type,
                "modified": modified_time
            })
    
    return {"files": files_list}

@router.delete("/delete")
def delete_file(session_code: str, filename: str):
    """Elimina un archivo del servidor."""
    if session_code != config.SESSION_CODE:
        raise HTTPException(status_code=401, detail="Código de sesión incorrecto")
    file_path = os.path.join(config.FILES_FOLDER, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    os.remove(file_path)
    return {"message": f"Archivo '{filename}' eliminado."}
