from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, Transaction
from app.routers.auth import get_current_user
from app.schemas import (
    DepositRequest,
    WithdrawRequest,
    TransferRequest,
    TransactionResponse,
    MessageResponse,
)
from app.utils import generate_reference

router = APIRouter()


@router.get("/balance", response_model=dict)
def get_balance(current_user: User = Depends(get_current_user)):
    return {"balance": current_user.balance}


@router.post("/deposit", response_model=TransactionResponse)
def deposit(
    data: DepositRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.balance += data.amount
    txn = Transaction(
        from_id=None,
        to_id=current_user.id,
        amount=data.amount,
        type="deposit",
        description=f"Deposit of {data.amount}",
        reference=generate_reference(),
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return TransactionResponse.model_validate(txn)


@router.post("/withdraw", response_model=TransactionResponse)
def withdraw(
    data: WithdrawRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.balance < data.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    current_user.balance -= data.amount
    txn = Transaction(
        from_id=current_user.id,
        amount=data.amount,
        type="withdrawal",
        description=f"Withdrawal of {data.amount}",
        reference=generate_reference(),
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return TransactionResponse.model_validate(txn)


@router.post("/transfer", response_model=TransactionResponse)
def transfer(
    data: TransferRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.balance < data.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    recipient = db.query(User).filter(User.phone == data.to_phone).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    if recipient.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot transfer to yourself")
    current_user.balance -= data.amount
    recipient.balance += data.amount
    txn = Transaction(
        from_id=current_user.id,
        to_id=recipient.id,
        amount=data.amount,
        type="transfer",
        description=f"Transfer to {recipient.name} ({recipient.phone})",
        reference=generate_reference(),
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return TransactionResponse.model_validate(txn)
