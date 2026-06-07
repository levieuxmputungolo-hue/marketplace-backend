from fastapi import APIRouter, HTTPException
from bson import ObjectId
from app.database import users as users_col
from datetime import datetime
import hashlib

router = APIRouter(prefix="/api/users", tags=["Users"])


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


@router.post("/register")
def register(data: dict):
    email = data.get("email", "").strip().lower()
    phone = data.get("phone", "").strip()
    name = data.get("name", "").strip()
    password = data.get("password", "")

    if not email or not password:
        raise HTTPException(400, "Email and password required")

    existing = users_col.find_one({"$or": [{"email": email}, {"phone": phone}]})
    if existing:
        raise HTTPException(400, "User already exists")

    doc = {
        "email": email,
        "phone": phone,
        "name": name,
        "password_hash": _hash_password(password),
        "role": data.get("role", "client"),
        "avatar": data.get("avatar", ""),
        "address": data.get("address", ""),
        "city": data.get("city", ""),
        "country": data.get("country", ""),
        "verified": False,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    result = users_col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc.pop("password_hash", None)
    return doc


@router.post("/login")
def login(data: dict):
    email = data.get("email", "").strip().lower()
    phone = data.get("phone", "").strip()
    password = data.get("password", "")

    if not password:
        raise HTTPException(400, "Password required")

    query = {}
    if email:
        query["email"] = email
    elif phone:
        query["phone"] = phone
    else:
        raise HTTPException(400, "Email or phone required")

    user = users_col.find_one(query)
    if not user or user.get("password_hash") != _hash_password(password):
        raise HTTPException(401, "Invalid credentials")

    user["_id"] = str(user["_id"])
    user.pop("password_hash", None)
    return user


@router.get("/{user_id}")
def get_user(user_id: str):
    try:
        user = users_col.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = users_col.find_one({"email": user_id})
    if not user:
        raise HTTPException(404, "User not found")
    user["_id"] = str(user["_id"])
    user.pop("password_hash", None)
    return user


@router.put("/{user_id}")
def update_user(user_id: str, data: dict):
    existing = users_col.find_one({"_id": ObjectId(user_id)})
    if not existing:
        raise HTTPException(404, "User not found")

    allowed = ["name", "phone", "avatar", "address", "city", "country", "role"]
    update = {k: v for k, v in data.items() if k in allowed and v is not None}
    if not update:
        raise HTTPException(400, "No valid fields to update")

    update["updated_at"] = datetime.utcnow().isoformat()
    users_col.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    user = users_col.find_one({"_id": ObjectId(user_id)})
    user["_id"] = str(user["_id"])
    user.pop("password_hash", None)
    return user
