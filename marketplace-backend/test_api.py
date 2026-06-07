import urllib.request, json

# Test ping
r = urllib.request.urlopen("http://127.0.0.1:8005/ping")
print("Ping:", json.loads(r.read()))

# Test categories
r = urllib.request.urlopen("http://127.0.0.1:8005/api/categories/")
cats = json.loads(r.read())
print(f"Categories ({len(cats)}):")
for c in cats:
    print(f"  - {c['name']} ({c['slug']})")

# Test products
r = urllib.request.urlopen("http://127.0.0.1:8005/api/products/")
prods = json.loads(r.read())
print(f"\nProducts ({len(prods)}):")
for p in prods[:8]:
    print(f"  - {p['name']}: ${p['price']} [{p['category']}]")
if len(prods) > 8:
    print(f"  ... and {len(prods)-8} more")

# Test login
req = urllib.request.Request(
    "http://127.0.0.1:8005/api/users/login",
    data=json.dumps({"email": "demo@marketplace.com", "password": "demo123"}).encode(),
    headers={"Content-Type": "application/json"},
)
r = urllib.request.urlopen(req)
user = json.loads(r.read())
print(f"\nLogin: {user['name']} ({user['email']}) - role: {user['role']}")

print("\nAll checks passed!")
