"""Database configuration for marketplace.
Supports MongoDB Atlas (via MONGO_URI env) or local mongita fallback."""
import os
from pathlib import Path

MONGO_URI = os.environ.get("MONGO_URI", "").strip()

if MONGO_URI:
    from pymongo import MongoClient

    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    client.admin.command("ping")
    # Use 'marketplace' database - append if not in URI
    if "/?" in MONGO_URI or MONGO_URI.rstrip("/").endswith(".mongodb.net"):
        db = client["marketplace"]
    else:
        db = client.get_database()
else:
    from mongita import MongitaClientDisk

    DATA_DIR = Path(__file__).resolve().parent.parent / "data"
    DATA_DIR.mkdir(exist_ok=True)
    client = MongitaClientDisk(str(DATA_DIR))
    db = client.marketplace

products = db.products
users = db.users
orders = db.orders
categories = db.categories
carts = db.carts