from fastapi import APIRouter, HTTPException
from bson import ObjectId
from app.database import products as products_col
from datetime import datetime

router = APIRouter(prefix="/api/products", tags=["Products"])


@router.get("/")
def list_products(search: str = "", category: str = "", min_price: float = 0, max_price: float = 0, skip: int = 0, limit: int = 50):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    if category:
        query["category"] = category
    if min_price > 0 or max_price > 0:
        price_q = {}
        if min_price > 0:
            price_q["$gte"] = min_price
        if max_price > 0:
            price_q["$lte"] = max_price
        query["price"] = price_q

    docs = list(products_col.find(query).sort("created_at", -1).skip(skip).limit(limit))
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


@router.get("/{product_id}")
def get_product(product_id: str):
    doc = products_col.find_one({"_id": ObjectId(product_id)})
    if not doc:
        raise HTTPException(404, "Product not found")
    doc["_id"] = str(doc["_id"])
    return doc


@router.post("/")
def create_product(data: dict):
    required = ["name", "price"]
    for field in required:
        if field not in data or not data[field]:
            raise HTTPException(400, f"{field} is required")

    doc = {
        "name": data["name"],
        "description": data.get("description", ""),
        "price": float(data["price"]),
        "stock": int(data.get("stock", 0)),
        "category": data.get("category", ""),
        "category_id": data.get("category_id", ""),
        "image": data.get("image", ""),
        "images": data.get("images", []),
        "seller_id": data.get("seller_id", ""),
        "seller_name": data.get("seller_name", ""),
        "rating": float(data.get("rating", 0)),
        "reviews_count": int(data.get("reviews_count", 0)),
        "status": data.get("status", "active"),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    result = products_col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


@router.put("/{product_id}")
def update_product(product_id: str, data: dict):
    existing = products_col.find_one({"_id": ObjectId(product_id)})
    if not existing:
        raise HTTPException(404, "Product not found")

    allowed = ["name", "description", "price", "stock", "category", "image", "images", "status", "rating"]
    update = {k: v for k, v in data.items() if k in allowed and v is not None}
    if not update:
        raise HTTPException(400, "No valid fields to update")

    update["updated_at"] = datetime.utcnow().isoformat()
    products_col.update_one({"_id": ObjectId(product_id)}, {"$set": update})
    doc = products_col.find_one({"_id": ObjectId(product_id)})
    doc["_id"] = str(doc["_id"])
    return doc


@router.delete("/{product_id}")
def delete_product(product_id: str):
    result = products_col.delete_one({"_id": ObjectId(product_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Product not found")
    return {"ok": True}
