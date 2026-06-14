from fastapi import APIRouter, HTTPException, Query, Request
from bson import ObjectId
from app.database import db
from datetime import datetime
import json, asyncio
from fastapi.responses import StreamingResponse

articles_col = db.articles
messages_col = db.messages

router = APIRouter(prefix="/api/articles", tags=["Messages"])

@router.post("")
def create_article(data: dict):
    title = data.get("title", "").strip()
    content = data.get("content", "").strip()
    author_id = data.get("author_id", data.get("seller_id", ""))
    author_name = data.get("author_name", "")
    if not title or not content:
        raise HTTPException(400, "title et content requis")
    doc = {
        "title": title,
        "content": content,
        "author_id": author_id,
        "author_name": author_name,
        "images": data.get("images", []),
        "price": float(data.get("price", 0)) if data.get("price") else None,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    result = articles_col.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc["_id"] = doc["id"]
    return doc

@router.get("")
def list_articles(search: str = "", skip: int = 0, limit: int = 20):
    query = {}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}},
        ]
    docs = list(articles_col.find(query).sort("created_at", -1).skip(skip).limit(limit))
    for d in docs:
        d["_id"] = str(d["_id"])
        d["id"] = d["_id"]
    return docs

@router.get("/{article_id}")
def get_article(article_id: str):
    doc = articles_col.find_one({"_id": ObjectId(article_id)})
    if not doc:
        raise HTTPException(404, "Article introuvable")
    doc["_id"] = str(doc["_id"])
    doc["id"] = doc["_id"]
    return doc

@router.delete("/{article_id}")
def delete_article(article_id: str):
    result = articles_col.delete_one({"_id": ObjectId(article_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Article introuvable")
    messages_col.delete_many({"article_id": article_id})
    return {"ok": True}

@router.post("/{article_id}/messages")
def send_message(article_id: str, data: dict):
    content = data.get("content", "").strip()
    sender_id = data.get("sender_id", "")
    sender_name = data.get("sender_name", "")
    if not content:
        raise HTTPException(400, "content requis")
    article = articles_col.find_one({"_id": ObjectId(article_id)})
    if not article:
        raise HTTPException(404, "Article introuvable")
    doc = {
        "article_id": article_id,
        "content": content,
        "sender_id": sender_id,
        "sender_name": sender_name,
        "receiver_id": str(article.get("author_id", "")),
        "article_title": article.get("title", ""),
        "created_at": datetime.utcnow().isoformat(),
    }
    result = messages_col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc["id"] = doc["_id"]
    _notify_clients(doc)
    return doc

@router.get("/messages/inbox")
def get_inbox(user_id: str = Query(...)):
    docs = list(messages_col.find({"receiver_id": user_id}).sort("created_at", -1))
    for d in docs:
        d["_id"] = str(d["_id"])
        d["id"] = d["_id"]
    return docs

@router.get("/messages/outbox")
def get_outbox(user_id: str = Query(...)):
    docs = list(messages_col.find({"sender_id": user_id}).sort("created_at", -1))
    for d in docs:
        d["_id"] = str(d["_id"])
        d["id"] = d["_id"]
    return docs

@router.get("/messages/conversation/{article_id}")
def get_conversation(article_id: str, user_id: str = Query(...)):
    article = articles_col.find_one({"_id": ObjectId(article_id)})
    if not article:
        raise HTTPException(404, "Article introuvable")
    author_id = str(article.get("author_id", ""))
    docs = list(messages_col.find({
        "article_id": article_id,
        "$or": [
            {"sender_id": user_id},
            {"receiver_id": user_id},
        ]
    }).sort("created_at", 1))
    for d in docs:
        d["_id"] = str(d["_id"])
        d["id"] = d["_id"]
    return docs

_clients = []

def _notify_clients(msg):
    for q in _clients:
        q.put_nowait(msg)

@router.get("/messages/stream")
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
