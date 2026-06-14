from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import uuid, shutil

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

router = APIRouter(prefix="/api", tags=["Uploads"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"}
MAX_SIZE = 5 * 1024 * 1024

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Type {file.content_type} non autorisé. Utilisez JPEG, PNG, WebP, GIF ou SVG.")
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "Fichier trop volumineux (max 5 Mo)")
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    path = UPLOAD_DIR / filename
    path.write_bytes(content)
    return {"url": f"/uploads/{filename}", "filename": filename}

@router.get("/uploads/{filename}")
def get_upload(filename: str):
    path = UPLOAD_DIR / filename
    if not path.exists():
        raise HTTPException(404, "Fichier introuvable")
    from fastapi.responses import FileResponse
    return FileResponse(path)
