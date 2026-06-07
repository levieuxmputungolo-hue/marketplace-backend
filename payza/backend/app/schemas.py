from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserRegister(BaseModel):
    phone: str
    email: Optional[str] = None
    name: str
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    password: str


class UserLogin(BaseModel):
    phone: str
    password: str


class UserResponse(BaseModel):
    id: str
    phone: str
    email: Optional[str] = None
    name: str
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    balance: float
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class DepositRequest(BaseModel):
    amount: float = Field(gt=0)


class WithdrawRequest(BaseModel):
    amount: float = Field(gt=0)


class TransferRequest(BaseModel):
    to_phone: str
    amount: float = Field(gt=0)


class CardCreate(BaseModel):
    daily_limit: Optional[float] = 10000.0


class CardResponse(BaseModel):
    id: str
    user_id: str
    card_number: str
    expiry: str
    cvv: str
    status: str
    balance: float
    daily_limit: float
    created_at: datetime

    class Config:
        from_attributes = True


class CardSetLimit(BaseModel):
    daily_limit: float = Field(gt=0)


class PayRequest(BaseModel):
    card_id: str
    amount: float = Field(gt=0)
    merchant: str
    description: Optional[str] = None


class TransactionResponse(BaseModel):
    id: str
    from_id: Optional[str] = None
    to_id: Optional[str] = None
    card_id: Optional[str] = None
    amount: float
    type: str
    status: str
    description: Optional[str] = None
    reference: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float = Field(gt=0)
    stock: int = Field(ge=0)
    image_url: Optional[str] = None


class ProductResponse(BaseModel):
    id: str
    seller_id: str
    name: str
    description: Optional[str] = None
    price: float
    stock: int
    image_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BuyRequest(BaseModel):
    product_id: str
    card_id: str
    quantity: int = Field(ge=1)


class OrderResponse(BaseModel):
    id: str
    buyer_id: str
    product_id: str
    card_id: str
    quantity: int
    total: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    message: str
