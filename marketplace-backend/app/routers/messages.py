from fastapi import APIRouter, HTTPException, Query
from bson import ObjectId
from app.database import db
from datetime import datetime, timezone
import json, asyncio
from fastapi.responses import StreamingResponse

messages_col = db.messages
conversations_col = db.conversations

router = APIRouter(prefix="/api/messages", tags=["Messages"])


# ===== Conversations =====

@router.get("/conversations")
def list_conversations(user_id: str = Query(...)):
    docs = list(conversations_col.find({
        "participants": user_id
    }).sort("last_message_at", -1))
    for d in docs:
        d["_id"] = str(d["_id"])
        unread = d.get("unread_count", {})
        d["unread"] = unread.get(user_id, 0)
    return docs


@router.get("/conversations/{conv_id}")
def get_conversation(conv_id: str, user_id: str = Query(...)):
    conv = conversations_col.find_one({"_id": ObjectId(conv_id), "participants": user_id})
    if not conv:
        raise HTTPException(404, "Conversation introuvable")
    conv["_id"] = str(conv["_id"])
    conv["unread"] = conv.get("unread_count", {}).get(user_id, 0)
    return conv


@router.post("/conversations")
def create_or_get_conversation(data: dict):
    buyer_id = data.get("buyer_id", "").strip()
    seller_id = data.get("seller_id", "").strip()
    product_id = data.get("product_id", "")
    if not buyer_id or not seller_id:
        raise HTTPException(400, "buyer_id et seller_id requis")
    # Store participant names
    buyer_name = data.get("buyer_name", "").strip() or "Acheteur"
    seller_name = data.get("seller_name", "").strip() or "Vendeur"
    participant_names = {buyer_id: buyer_name, seller_id: seller_name}
    existing = conversations_col.find_one({
        "participants": {"$all": [buyer_id, seller_id], "$size": 2},
        "$or": [{"product_id": product_id}, {"product_id": {"$exists": False}}]
    }) if product_id else conversations_col.find_one({
        "participants": {"$all": [buyer_id, seller_id], "$size": 2},
        "product_id": {"$exists": False}
    })
    if existing:
        # Update names
        conversations_col.update_one({"_id": existing["_id"]}, {"$set": {f"participant_names.{buyer_id}": buyer_name, f"participant_names.{seller_id}": seller_name}})
        existing["_id"] = str(existing["_id"])
        existing["unread"] = existing.get("unread_count", {}).get(buyer_id, 0)
        existing["participant_names"] = existing.get("participant_names", participant_names)
        return existing
    doc = {
        "participants": [buyer_id, seller_id],
        "participant_names": participant_names,
        "product_id": product_id,
        "product_name": data.get("product_name", ""),
        "product_price": data.get("product_price"),
        "product_image": data.get("product_image", ""),
        "last_message": "",
        "last_message_at": datetime.now(timezone.utc).isoformat(),
        "last_sender_id": "",
        "unread_count": {buyer_id: 0, seller_id: 0},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = conversations_col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc["unread"] = 0
    return doc


# ===== Canned responses (static routes BEFORE param routes) =====

CANNED_RESPONSES = [
    {"id": "delivery", "text": "Le délai de livraison est de 3 à 7 jours ouvrés selon votre localisation."},
    {"id": "price", "text": "Le tarif est celui affiché sur l'annonce. Nous avons des promotions régulières, n'hésitez pas à suivre notre boutique."},
    {"id": "address", "text": "Pourriez-vous me communiquer votre adresse complète pour établir le devis de livraison ?"},
    {"id": "stock", "text": "Oui, le produit est actuellement en stock. Je peux vous réserver un exemplaire."},
    {"id": "payment", "text": "Nous acceptons Orange Money, M-Pesa et Airtel Money. Paiement sécurisé."},
]

@router.get("/canned-responses")
def get_canned_responses():
    return CANNED_RESPONSES


# ===== SSE real-time (static route BEFORE param routes) =====

_clients = []

def _notify_clients(msg):
    for q in _clients:
        q.put_nowait(msg)

@router.get("/stream")
async def stream_messages(user_id: str = Query(...)):
    queue = asyncio.Queue()
    _clients.append(queue)
    async def event_stream():
        try:
            while True:
                msg = await queue.get()
                if msg.get("receiver_id") == user_id or msg.get("sender_id") == user_id:
                    yield f"data: {json.dumps(msg, default=str)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            if queue in _clients:
                _clients.remove(queue)
    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ===== Vendor dashboard stats =====

@router.get("/stats/{seller_id}")
def messaging_stats(seller_id: str):
    convs = list(conversations_col.find({"participants": seller_id}))
    total = len(convs)
    unanswered = 0
    total_response_time = 0
    response_count = 0
    for conv in convs:
        msgs = list(messages_col.find({"conversation_id": str(conv["_id"])}).sort("created_at", 1))
        if msgs:
            first = msgs[0]
            if first.get("sender_id") != seller_id:
                response_time = datetime.fromisoformat(msgs[1]["created_at"]) - datetime.fromisoformat(first["created_at"]) if len(msgs) > 1 else None
                if response_time:
                    total_response_time += response_time.total_seconds()
                    response_count += 1
            if len(msgs) == 1 and msgs[0].get("receiver_id") == seller_id:
                unanswered += 1
    return {
        "total_conversations": total,
        "unanswered": unanswered,
        "avg_response_time_sec": round(total_response_time / response_count) if response_count else 0,
        "total_messages": messages_col.count_documents({"$or": [{"sender_id": seller_id}, {"receiver_id": seller_id}]}),
    }


# ===== Messages (param routes — must be defined AFTER static routes) =====

@router.get("/{conv_id}")
def get_messages(conv_id: str, user_id: str = Query(...), limit: int = 50, before: str = ""):
    conv = conversations_col.find_one({"_id": ObjectId(conv_id), "participants": user_id})
    if not conv:
        raise HTTPException(404, "Conversation introuvable")
    query = {"conversation_id": conv_id}
    if before:
        query["created_at"] = {"$lt": before}
    docs = list(messages_col.find(query).sort("created_at", -1).limit(limit))
    docs.reverse()
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


@router.post("/{conv_id}")
def send_message(conv_id: str, data: dict):
    content = data.get("content", "").strip()
    sender_id = data.get("sender_id", "").strip()
    sender_name = data.get("sender_name", "").strip()
    msg_type = data.get("type", "text")
    if not content and msg_type == "text":
        raise HTTPException(400, "content requis")
    conv = conversations_col.find_one({"_id": ObjectId(conv_id)})
    if not conv:
        raise HTTPException(404, "Conversation introuvable")
    if sender_id not in conv.get("participants", []):
        raise HTTPException(403, "Non autorisé")
    receiver_id = [p for p in conv["participants"] if p != sender_id][0]
    doc = {
        "conversation_id": conv_id,
        "content": content,
        "type": msg_type,
        "sender_id": sender_id,
        "sender_name": sender_name,
        "receiver_id": receiver_id,
        "product_id": conv.get("product_id", ""),
        "product_name": conv.get("product_name", ""),
        "file_url": data.get("file_url", ""),
        "media_type": data.get("media_type", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read_at": None,
    }
    result = messages_col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    unread = conv.get("unread_count", {})
    unread[receiver_id] = unread.get(receiver_id, 0) + 1
    conversations_col.update_one(
        {"_id": ObjectId(conv_id)},
        {"$set": {
            "last_message": content or "[Fichier]",
            "last_message_at": doc["created_at"],
            "last_sender_id": sender_id,
            "last_sender_name": sender_name,
            "unread_count": unread,
        }}
    )
    _notify_clients(doc)
    return doc


@router.post("/{conv_id}/read")
def mark_as_read(conv_id: str, data: dict):
    user_id = data.get("user_id", "").strip()
    if not user_id:
        raise HTTPException(400, "user_id requis")
    messages_col.update_many(
        {"conversation_id": conv_id, "receiver_id": user_id, "read_at": None},
        {"$set": {"read_at": datetime.now(timezone.utc).isoformat()}}
    )
    conv = conversations_col.find_one({"_id": ObjectId(conv_id)})
    if conv:
        unread = conv.get("unread_count", {})
        if unread.get(user_id, 0) > 0:
            unread[user_id] = 0
            conversations_col.update_one(
                {"_id": ObjectId(conv_id)},
                {"$set": {"unread_count": unread}}
            )
    return {"ok": True}


# ===== Welcome message =====

@router.post("/{conv_id}/welcome")
def send_welcome(conv_id: str, data: dict):
    sender_id = data.get("seller_id", "").strip()
    sender_name = data.get("seller_name", "").strip()
    conv = conversations_col.find_one({"_id": ObjectId(conv_id)})
    if not conv:
        raise HTTPException(404, "Conversation introuvable")
    buyer_id = [p for p in conv["participants"] if p != sender_id][0]
    welcome_msg = (
        f"Bonjour, je suis {sender_name}. "
        "Ce produit est en stock. Puis-je vous envoyer un devis ?"
    )
    doc = {
        "conversation_id": conv_id,
        "content": welcome_msg,
        "type": "welcome",
        "sender_id": sender_id,
        "sender_name": sender_name,
        "receiver_id": buyer_id,
        "product_id": conv.get("product_id", ""),
        "product_name": conv.get("product_name", ""),
        "file_url": "", "media_type": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read_at": None,
    }
    result = messages_col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    unread = conv.get("unread_count", {})
    unread[buyer_id] = unread.get(buyer_id, 0) + 1
    conversations_col.update_one(
        {"_id": ObjectId(conv_id)},
        {"$set": {
            "last_message": welcome_msg, "last_message_at": doc["created_at"],
            "last_sender_id": sender_id, "last_sender_name": sender_name,
            "unread_count": unread,
        }}
    )
    _notify_clients(doc)
    return doc


# ===== Evaluation =====

@router.post("/{conv_id}/evaluate")
def evaluate_conversation(conv_id: str, data: dict):
    user_id = data.get("user_id", "").strip()
    rating = data.get("rating", 0)
    if not user_id or not rating:
        raise HTTPException(400, "user_id et rating requis")
    if rating < 1 or rating > 5:
        raise HTTPException(400, "rating entre 1 et 5")
    conversations_col.update_one(
        {"_id": ObjectId(conv_id)},
        {"$set": {f"evaluations.{user_id}": {"rating": rating, "comment": data.get("comment", ""), "created_at": datetime.now(timezone.utc).isoformat()}}}
    )
    return {"ok": True, "rating": rating}
