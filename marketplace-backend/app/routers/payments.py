from fastapi import APIRouter, HTTPException
from bson import ObjectId
from app.database import db
from datetime import datetime
import uuid, hashlib

payments_col = db.payments

router = APIRouter(prefix="/api/payments", tags=["Paiements"])

OPERATORS = {
    "orange_money": {"name": "Orange Money", "fee_pct": 0.085, "min": 100, "max": 5000000},
    "mpesa": {"name": "M-Pesa", "fee_pct": 0.09, "min": 50, "max": 10000000},
    "airtel_money": {"name": "Airtel Money", "fee_pct": 0.09, "min": 100, "max": 5000000},
}

@router.post("/mobile/initiate")
def initiate_mobile_payment(data: dict):
    amount = float(data.get("amount", 0))
    phone = data.get("phone", "").strip()
    operator = data.get("operator", "").strip()
    user_id = data.get("user_id", "")
    description = data.get("description", "Paiement easy-market")

    if amount <= 0:
        raise HTTPException(400, "Montant invalide")
    if not phone or len(phone) < 8:
        raise HTTPException(400, "Numéro de téléphone invalide")
    if operator not in OPERATORS:
        raise HTTPException(400, f"Opérateur non supporté. Choisir: {', '.join(OPERATORS.keys())}")

    op = OPERATORS[operator]
    if amount < op["min"] or amount > op["max"]:
        raise HTTPException(400, f"Montant hors limite pour {op['name']} ({op['min']}-{op['max']} {op.get('currency', 'FC')})")

    fee = round(amount * op["fee_pct"], 2)
    total = round(amount + fee, 2)
    reference = f"OM-{uuid.uuid4().hex[:12].upper()}"
    pin = hashlib.sha256(f"{reference}{amount}{phone}".encode()).hexdigest()[:6]

    doc = {
        "reference": reference,
        "user_id": user_id,
        "amount": amount,
        "fee": fee,
        "total": total,
        "phone": phone,
        "operator": operator,
        "operator_name": op["name"],
        "description": description,
        "pin": pin,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    result = payments_col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    return {
        "reference": reference,
        "amount": amount,
        "fee": fee,
        "total": total,
        "operator": op["name"],
        "phone": phone,
        "pin": pin,
        "status": "pending",
        "message": f"Demande de paiement {op['name']} envoyée. Code PIN: {pin}",
        "instructions": f"Composez *150*01#{pin}# sur votre téléphone {op['name']} pour confirmer.",
    }

@router.post("/mobile/callback")
def mobile_payment_callback(data: dict):
    reference = data.get("reference", "")
    status = data.get("status", "paid")
    transaction_id = data.get("transaction_id", data.get("provider_reference", ""))

    if not reference:
        raise HTTPException(400, "reference requis")

    existing = payments_col.find_one({"reference": reference})
    if not existing:
        raise HTTPException(404, "Paiement introuvable")

    update = {
        "status": status,
        "transaction_id": transaction_id,
        "updated_at": datetime.utcnow().isoformat(),
    }
    if status == "paid":
        update["paid_at"] = datetime.utcnow().isoformat()

    payments_col.update_one({"reference": reference}, {"$set": update})
    return {"ok": True, "reference": reference, "status": status, "transaction_id": transaction_id}

@router.get("/status/{reference}")
def get_payment_status(reference: str):
    doc = payments_col.find_one({"reference": reference})
    if not doc:
        raise HTTPException(404, "Paiement introuvable")
    doc["_id"] = str(doc["_id"])
    doc.pop("pin", None)
    return doc

@router.get("/history/{user_id}")
def get_payment_history(user_id: str):
    docs = list(payments_col.find({"user_id": user_id}).sort("created_at", -1))
    for d in docs:
        d["_id"] = str(d["_id"])
        d.pop("pin", None)
    return docs

@router.get("/operators")
def list_operators():
    return [
        {"id": k, "name": v["name"], "fee_pct": v["fee_pct"], "min": v["min"], "max": v["max"]}
        for k, v in OPERATORS.items()
    ]
