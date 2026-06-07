from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import Base, engine
from app.routers import auth, wallet, cards, payments, marketplace

app = FastAPI(title="Payza API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(wallet.router, prefix="/wallet", tags=["Wallet"])
app.include_router(cards.router, prefix="/cards", tags=["Cards"])
app.include_router(payments.router, prefix="/payments", tags=["Payments"])
app.include_router(marketplace.router, prefix="/marketplace", tags=["Marketplace"])


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
