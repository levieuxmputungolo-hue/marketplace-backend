from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, VirtualCard
from app.routers.auth import get_current_user
from app.schemas import CardCreate, CardResponse, CardSetLimit, MessageResponse
from app.utils import generate_card_number, generate_cvv, generate_expiry

router = APIRouter()


@router.post("/create", response_model=CardResponse, status_code=201)
def create_card(
    data: CardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card_number = generate_card_number()
    while db.query(VirtualCard).filter(VirtualCard.card_number == card_number).first():
        card_number = generate_card_number()
    card = VirtualCard(
        user_id=current_user.id,
        card_number=card_number,
        expiry=generate_expiry(),
        cvv=generate_cvv(),
        daily_limit=data.daily_limit,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return CardResponse.model_validate(card)


@router.get("", response_model=list[CardResponse])
def list_cards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cards = db.query(VirtualCard).filter(VirtualCard.user_id == current_user.id).all()
    return [CardResponse.model_validate(c) for c in cards]


@router.get("/{card_id}", response_model=CardResponse)
def get_card(
    card_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(VirtualCard).filter(
        VirtualCard.id == card_id, VirtualCard.user_id == current_user.id
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return CardResponse.model_validate(card)


@router.post("/{card_id}/block", response_model=MessageResponse)
def block_card(
    card_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(VirtualCard).filter(
        VirtualCard.id == card_id, VirtualCard.user_id == current_user.id
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    if card.status == "blocked":
        raise HTTPException(status_code=400, detail="Card is already blocked")
    card.status = "blocked"
    db.commit()
    return {"message": "Card blocked successfully"}


@router.post("/{card_id}/set-limit", response_model=CardResponse)
def set_card_limit(
    card_id: str,
    data: CardSetLimit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(VirtualCard).filter(
        VirtualCard.id == card_id, VirtualCard.user_id == current_user.id
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    card.daily_limit = data.daily_limit
    db.commit()
    db.refresh(card)
    return CardResponse.model_validate(card)
