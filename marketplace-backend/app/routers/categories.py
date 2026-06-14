from fastapi import APIRouter, HTTPException
from bson import ObjectId
from app.database import categories as categories_col
from datetime import datetime

router = APIRouter(prefix="/api/categories", tags=["Categories"])


@router.get("/")
def list_categories():
    docs = list(categories_col.find({}))
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


@router.post("/")
def create_category(data: dict):
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(400, "Category name required")
    existing = categories_col.find_one({"name": name})
    if existing:
        raise HTTPException(400, "Category already exists")
    doc = {
        "name": name,
        "slug": name.lower().replace(" ", "-"),
        "description": data.get("description", ""),
        "image": data.get("image", ""),
        "created_at": datetime.utcnow().isoformat(),
    }
    result = categories_col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


@router.get("/{category_id}")
def get_category(category_id: str):
    doc = categories_col.find_one({"_id": ObjectId(category_id)})
    if not doc:
        raise HTTPException(404, "Category not found")
    doc["_id"] = str(doc["_id"])
    return doc


@router.put("/{category_id}")
def update_category(category_id: str, data: dict):
    existing = categories_col.find_one({"_id": ObjectId(category_id)})
    if not existing:
        raise HTTPException(404, "Category not found")
    allowed = ["name", "description", "image"]
    update = {}
    for k in allowed:
        if k in data and data[k] is not None:
            update[k] = data[k]
    if not update:
        raise HTTPException(400, "No valid fields")
    if "name" in update:
        update["slug"] = update["name"].lower().replace(" ", "-")
    update["updated_at"] = datetime.utcnow().isoformat()
    categories_col.update_one({"_id": ObjectId(category_id)}, {"$set": update})
    doc = categories_col.find_one({"_id": ObjectId(category_id)})
    doc["_id"] = str(doc["_id"])
    return doc


@router.delete("/{category_id}")
def delete_category(category_id: str):
    result = categories_col.delete_one({"_id": ObjectId(category_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Category not found")
    return {"ok": True}
