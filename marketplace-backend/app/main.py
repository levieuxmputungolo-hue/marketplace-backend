from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.routers import products, users, orders, categories

app = FastAPI(title="Marketplace API (MongoDB)", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(users.router)
app.include_router(orders.router)
app.include_router(categories.router)


@app.get("/ping")
def ping():
    return {"ok": True, "db": "mongita", "status": "connected"}
