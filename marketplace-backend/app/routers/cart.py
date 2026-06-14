from fastapi import APIRouter, HTTPException
from bson import ObjectId
from app.database import carts as cart_col, products as products_col, orders as orders_col
from datetime import datetime

router = APIRouter(prefix="/api/cart", tags=["Cart"])


@router.get("/{user_id}")
def get_cart(user_id: str):
    docs = list(cart_col.find({"buyer_id": user_id}))
    for d in docs:
        d["_id"] = str(d["_id"])
        prod = products_col.find_one({"_id": ObjectId(d["product_id"])})
        if prod:
            d["price"] = prod.get("price", 0)
            d["name"] = prod.get("name", "")
    return docs


@router.post("/{user_id}/add")
def add_to_cart(user_id: str, data: dict):
    product_id = data.get("product_id", "").strip()
    quantity = int(data.get("quantity", 1))
    if not product_id:
        raise HTTPException(400, "product_id required")

    existing = cart_col.find_one({"buyer_id": user_id, "product_id": product_id})
    if existing:
        new_qty = (existing.get("quantity", 1) or 1) + quantity
        cart_col.update_one(
            {"_id": existing["_id"]},
            {"$set": {"quantity": new_qty, "updated_at": datetime.utcnow().isoformat()}}
        )
        existing["_id"] = str(existing["_id"])
        existing["quantity"] = new_qty
        return existing

    doc = {
        "buyer_id": user_id,
        "product_id": product_id,
        "quantity": quantity,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    result = cart_col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


@router.put("/{user_id}/item/{product_id}")
def update_cart_item(user_id: str, product_id: str, data: dict):
    quantity = data.get("quantity")
    if not quantity:
        raise HTTPException(400, "quantity required")
    item = cart_col.find_one({"buyer_id": user_id, "product_id": product_id})
    if not item:
        raise HTTPException(404, "Item not found")
    cart_col.update_one(
        {"_id": item["_id"]},
        {"$set": {"quantity": int(quantity), "updated_at": datetime.utcnow().isoformat()}}
    )
    return {"ok": True}


@router.delete("/{user_id}/item/{product_id}")
def remove_from_cart(user_id: str, product_id: str):
    item = cart_col.find_one({"buyer_id": user_id, "product_id": product_id})
    if not item:
        raise HTTPException(404, "Item not found")
    cart_col.delete_one({"_id": item["_id"]})
    return {"ok": True}


@router.delete("/{user_id}")
def clear_cart(user_id: str):
    cart_col.delete_many({"buyer_id": user_id})
    return {"ok": True}


@router.post("/{user_id}/checkout")
def checkout(user_id: str, data: dict = {}):
    items = list(cart_col.find({"buyer_id": user_id}))
    if not items:
        raise HTTPException(400, "Cart is empty")

    total = 0.0
    order_items = []
    for item in items:
        pid = item["product_id"]
        qty = item.get("quantity", 1)
        prod = products_col.find_one({"_id": ObjectId(pid)})
        price = prod.get("price", 0) if prod else 0
        total += price * qty
        order_items.append({"product_id": pid, "quantity": qty})
        if prod and prod.get("stock", 0) > 0:
            products_col.update_one(
                {"_id": ObjectId(pid)},
                {"$inc": {"stock": -qty}}
            )

    order = {
        "buyer_id": user_id,
        "items": order_items,
        "total": round(total, 2),
        "status": "pending",
        "shipping_address": data.get("shipping_address", {}),
        "payment_method": data.get("payment_method", ""),
        "payment_status": "unpaid",
        "notes": data.get("notes", ""),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    result = orders_col.insert_one(order)
    order["_id"] = str(result.inserted_id)
    cart_col.delete_many({"buyer_id": user_id})
    return order
