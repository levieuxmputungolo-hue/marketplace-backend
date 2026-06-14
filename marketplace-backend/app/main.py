from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.routers import products, users, orders, categories, cart, uploads, messages, payments

app = FastAPI(title="Marketplace API (MongoDB)", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
WEB_DIR = BASE_DIR.parent / "marketplace-web"

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.include_router(products.router)
app.include_router(users.router)
app.include_router(orders.router)
app.include_router(categories.router)
app.include_router(cart.router)
app.include_router(uploads.router)
app.include_router(messages.router)
app.include_router(payments.router)


@app.get("/ping")
def ping():
    from app.database import MONGO_URI
    db_type = "atlas" if MONGO_URI else "mongita"
    return {"ok": True, "db": db_type, "status": "connected"}


app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")
