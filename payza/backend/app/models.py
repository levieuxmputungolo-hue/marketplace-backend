import uuid
from datetime import datetime

from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.db import Base


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    phone = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=True)
    name = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    date_of_birth = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    balance = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    cards = relationship("VirtualCard", back_populates="owner", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="seller", cascade="all, delete-orphan")


class VirtualCard(Base):
    __tablename__ = "virtual_cards"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    card_number = Column(String, unique=True, nullable=False)
    expiry = Column(String, nullable=False)
    cvv = Column(String, nullable=False)
    status = Column(String, default="active")
    balance = Column(Float, default=0.0)
    daily_limit = Column(Float, default=10000.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="cards")
    transactions = relationship("Transaction", back_populates="card", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=generate_uuid)
    from_id = Column(String, ForeignKey("users.id"), nullable=True)
    to_id = Column(String, ForeignKey("users.id"), nullable=True)
    card_id = Column(String, ForeignKey("virtual_cards.id"), nullable=True)
    amount = Column(Float, nullable=False)
    type = Column(String, nullable=False)
    status = Column(String, default="completed")
    description = Column(Text, nullable=True)
    reference = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    card = relationship("VirtualCard", back_populates="transactions")
    sender = relationship("User", foreign_keys=[from_id])
    receiver = relationship("User", foreign_keys=[to_id])


class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=generate_uuid)
    seller_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    stock = Column(Integer, default=0)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    seller = relationship("User", back_populates="products")


class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, default=generate_uuid)
    buyer_id = Column(String, ForeignKey("users.id"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    card_id = Column(String, ForeignKey("virtual_cards.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    total = Column(Float, nullable=False)
    status = Column(String, default="completed")
    created_at = Column(DateTime, default=datetime.utcnow)
