from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, Product, Order, VirtualCard
from app.routers.auth import get_current_user
from app.schemas import (
    ProductCreate,
    ProductResponse,
    BuyRequest,
    OrderResponse,
)
from app.utils import generate_reference

router = APIRouter()


@router.post("/products", response_model=ProductResponse, status_code=201)
def create_product(
    data: ProductCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = Product(
        seller_id=current_user.id,
        name=data.name,
        description=data.description,
        price=data.price,
        stock=data.stock,
        image_url=data.image_url,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return ProductResponse.model_validate(product)


@router.get("/products", response_model=list[ProductResponse])
def list_products(
    search: str = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Product).filter(Product.stock > 0)
    if search:
        q = q.filter(Product.name.ilike(f"%{search}%"))
    products = q.order_by(Product.created_at.desc()).all()
    return [ProductResponse.model_validate(p) for p in products]


@router.get("/products/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: str,
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductResponse.model_validate(product)


@router.post("/buy", response_model=OrderResponse, status_code=201)
def buy_product(
    data: BuyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.seller_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot buy your own product")
    if product.stock < data.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock. Available: {product.stock}",
        )
    total = product.price * data.quantity
    card = db.query(VirtualCard).filter(
        VirtualCard.id == data.card_id, VirtualCard.user_id == current_user.id
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    if card.status != "active":
        raise HTTPException(status_code=400, detail="Card is not active")
    if card.balance < total:
        raise HTTPException(status_code=400, detail="Insufficient card balance")
    card.balance -= total
    seller = db.query(User).filter(User.id == product.seller_id).first()
    seller.balance += total
    product.stock -= data.quantity
    order = Order(
        buyer_id=current_user.id,
        product_id=product.id,
        card_id=card.id,
        quantity=data.quantity,
        total=total,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return OrderResponse.model_validate(order)
