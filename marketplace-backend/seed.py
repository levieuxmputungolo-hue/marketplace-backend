"""Seed sample data into MongoDB."""
from app.database import products, categories, users
from datetime import datetime
import hashlib


def seed():
    if products.count_documents({}) > 0:
        print("Data already exists, dropping and reseeding...")
        products.delete_many({})
        categories.delete_many({})
        users.delete_many({})

    # Categories
    cat_docs = [
        {"name": "Électronique", "slug": "electronique", "description": "Smartphones, ordinateurs, accessoires", "image": "", "created_at": datetime.utcnow().isoformat()},
        {"name": "Mode", "slug": "mode", "description": "Vêtements, chaussures, accessoires", "image": "", "created_at": datetime.utcnow().isoformat()},
        {"name": "Maison", "slug": "maison", "description": "Meubles, décoration, électroménager", "image": "", "created_at": datetime.utcnow().isoformat()},
        {"name": "Sports", "slug": "sports", "description": "Équipement sportif, vêtements de sport", "image": "", "created_at": datetime.utcnow().isoformat()},
        {"name": "Beauté", "slug": "beaute", "description": "Cosmétiques, soins, parfums", "image": "", "created_at": datetime.utcnow().isoformat()},
    ]
    for c in cat_docs:
        categories.insert_one(c)
    print(f"  {len(cat_docs)} categories created")

    # Products
    product_docs = [
        {"name": "iPhone 15 Pro Max", "description": "256 Go, Noir Spatial, neuf", "price": 1299.0, "stock": 15, "category": "Électronique", "category_id": "", "image": "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400", "rating": 4.8, "reviews_count": 234, "seller_name": "TechShop", "status": "active", "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()},
        {"name": "MacBook Air M3", "description": "15 pouces, 16Go RAM, 512Go SSD", "price": 1499.0, "stock": 8, "category": "Électronique", "category_id": "", "image": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400", "rating": 4.9, "reviews_count": 189, "seller_name": "TechShop", "status": "active", "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()},
        {"name": "AirPods Pro 2", "description": "Annulation de bruit active, USB-C", "price": 249.0, "stock": 30, "category": "Électronique", "category_id": "", "image": "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=400", "rating": 4.7, "reviews_count": 567, "seller_name": "TechShop", "status": "active", "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()},
        {"name": "Nike Air Max 270", "description": "Chaussures de sport, taille 42", "price": 150.0, "stock": 25, "category": "Mode", "category_id": "", "image": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400", "rating": 4.5, "reviews_count": 432, "seller_name": "StyleShop", "status": "active", "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()},
        {"name": "Montre connectée Samsung", "description": "Galaxy Watch 6, 44mm, Noir", "price": 299.0, "stock": 12, "category": "Électronique", "category_id": "", "image": "https://images.unsplash.com/photo-1546868871-af0de0ae72e2?w=400", "rating": 4.4, "reviews_count": 156, "seller_name": "TechShop", "status": "active", "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()},
        {"name": "Casque Bose QC45", "description": "Casque sans fil, réduction de bruit", "price": 329.0, "stock": 10, "category": "Électronique", "category_id": "", "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400", "rating": 4.6, "reviews_count": 298, "seller_name": "TechShop", "status": "active", "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()},
        {"name": "Parfum Chanel N°5", "description": "Eau de parfum, 100ml", "price": 135.0, "stock": 20, "category": "Beauté", "category_id": "", "image": "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400", "rating": 4.8, "reviews_count": 876, "seller_name": "BeautéShop", "status": "active", "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()},
        {"name": "Sac à dos Eastpak", "description": "40L, Noir, Garantie 30 ans", "price": 65.0, "stock": 40, "category": "Mode", "category_id": "", "image": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400", "rating": 4.3, "reviews_count": 654, "seller_name": "StyleShop", "status": "active", "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()},
        {"name": "Appareil photo Sony A7IV", "description": "33MP, 4K vidéo, plein format", "price": 2499.0, "stock": 3, "category": "Électronique", "category_id": "", "image": "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400", "rating": 4.9, "reviews_count": 123, "seller_name": "TechShop", "status": "active", "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()},
        {"name": "Ensemble de literie", "description": "Draps en coton égyptien, 300 fils", "price": 89.0, "stock": 18, "category": "Maison", "category_id": "", "image": "https://images.unsplash.com/photo-1522771739018-5cda0a6f2980?w=400", "rating": 4.2, "reviews_count": 89, "seller_name": "MaisonShop", "status": "active", "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()},
    ]
    for p in product_docs:
        products.insert_one(p)
    print(f"  {len(product_docs)} products created")

    # Demo user
    demo_user = {
        "email": "demo@marketplace.com",
        "phone": "+243900000000",
        "name": "Client Test",
        "password_hash": hashlib.sha256("demo123".encode()).hexdigest(),
        "role": "client",
        "avatar": "",
        "address": "Kinshasa",
        "city": "Kinshasa",
        "country": "RDC",
        "verified": True,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    users.insert_one(demo_user)
    print(f"  Demo user created: demo@marketplace.com / demo123")

    print("Seed completed!")


if __name__ == "__main__":
    seed()
