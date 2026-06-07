from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, VirtualCard, Transaction
from app.routers.auth import get_current_user
from app.schemas import PayRequest, TransactionResponse
from app.utils import generate_reference

router = APIRouter()


@router.post("/pay", response_model=TransactionResponse)
def pay(
    data: PayRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(VirtualCard).filter(
        VirtualCard.id == data.card_id, VirtualCard.user_id == current_user.id
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    if card.status != "active":
        raise HTTPException(status_code=400, detail="Card is not active")
    if card.balance < data.amount:
        raise HTTPException(status_code=400, detail="Insufficient card balance")
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_spent = db.query(Transaction).filter(
        Transaction.card_id == card.id,
        Transaction.created_at >= today_start,
        Transaction.status == "completed",
    ).all()
    total_today = sum(t.amount for t in today_spent)
    if total_today + data.amount > card.daily_limit:
        raise HTTPException(status_code=400, detail="Daily limit exceeded")
    card.balance -= data.amount
    txn = Transaction(
        from_id=current_user.id,
        card_id=card.id,
        amount=data.amount,
        type="payment",
        description=data.description or f"Payment to {data.merchant}",
        reference=generate_reference(),
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return TransactionResponse.model_validate(txn)


@router.get("/history", response_model=list[TransactionResponse])
def payment_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    txns = (
        db.query(Transaction)
        .filter(
            (Transaction.from_id == current_user.id)
            | (Transaction.to_id == current_user.id)
        )
        .order_by(Transaction.created_at.desc())
        .all()
    )
    return [TransactionResponse.model_validate(t) for t in txns]


@router.get("/{txn_id}", response_model=TransactionResponse)
def get_payment(
    txn_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    txn = (
        db.query(Transaction)
        .filter(
            Transaction.id == txn_id,
            (Transaction.from_id == current_user.id)
            | (Transaction.to_id == current_user.id),
        )
        .first()
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return TransactionResponse.model_validate(txn)
