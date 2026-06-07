from fastapi import APIRouter, HTTPException
from bson import ObjectId
from app.database import orders as orders_col, products as products_col
from datetime import datetime

router = APIRouter(prefix="/api/orders", tags=["Orders"])


@router.get("/")
def list_orders(buyer_id: str = "", seller_id: str = ""):
    query = {}
    if buyer_id:
        query["buyer_id"] = buyer_id
    if seller_id:
        query["seller_id"] = seller_id
    docs = list(orders_col.find(query).sort("created_at", -1))
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


@router.get("/{order_id}")
def get_order(order_id: str):
    doc = orders_col.find_one({"_id": ObjectId(order_id)})
    if not doc:
        raise HTTPException(404, "Order not found")
    doc["_id"] = str(doc["_id"])
    return doc


@router.post("/")
def create_order(data: dict):
    required = ["buyer_id", "items", "total"]
    for field in required:
        if field not in data:
            raise HTTPException(400, f"{field} is required")

    items = data["items"]
    for item in items:
        product_id = item.get("product_id")
        if product_id:
            try:
                product = products_col.find_one({"_id": ObjectId(product_id)})
                if product and product.get("stock", 0) >= item.get("quantity", 1):
                    products_col.update_one(
                        {"_id": ObjectId(product_id)},
                        {"$inc": {"stock": -item.get("quantity", 1)}}
                    )
            except Exception:
                pass

    doc = {
        "buyer_id": data["buyer_id"],
        "buyer_name": data.get("buyer_name", ""),
        "seller_id": data.get("seller_id", ""),
        "items": items,
        "total": float(data["total"]),
        "status": data.get("status", "pending"),
        "shipping_address": data.get("shipping_address", {}),
        "payment_method": data.get("payment_method", ""),
        "payment_status": data.get("payment_status", "unpaid"),
        "notes": data.get("notes", ""),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    result = orders_col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


@router.put("/{order_id}/status")
def update_order_status(order_id: str, data: dict):
    status = data.get("status")
    if not status:
        raise HTTPException(400, "Status required")
    result = orders_col.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"status": status, "updated_at": datetime.utcnow().isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Order not found")
    return {"ok": True, "status": status}
