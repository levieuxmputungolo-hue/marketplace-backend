const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  const { search, category, min_price, max_price, skip, limit } = req.query;
  const db = getDb();
  const query = {};
  if (search) {
    const re = new RegExp(search, "i");
    query.$or = [{ name: re }, { description: re }];
  }
  if (category) query.category = category;
  if (min_price || max_price) {
    const priceQ = {};
    if (min_price) priceQ.$gte = parseFloat(min_price);
    if (max_price) priceQ.$lte = parseFloat(max_price);
    query.price = priceQ;
  }
  const docs = await db
    .collection("products")
    .find(query)
    .sort({ created_at: -1 })
    .skip(parseInt(skip) || 0)
    .limit(parseInt(limit) || 50)
    .toArray();
  docs.forEach((d) => (d._id = String(d._id)));
  res.json(docs);
});

router.get("/:id", async (req, res) => {
  const db = getDb();
  try {
    const doc = await db
      .collection("products")
      .findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).json({ error: "Product not found" });
    doc._id = String(doc._id);
    res.json(doc);
  } catch {
    res.status(400).json({ error: "Invalid product ID" });
  }
});

router.post("/", async (req, res) => {
  const { name, price, description, stock, category, image } = req.body;
  if (!name || price == null)
    return res.status(400).json({ error: "name and price required" });
  const db = getDb();
  const doc = {
    name,
    price: parseFloat(price),
    description: description || "",
    stock: parseInt(stock) || 0,
    category: category || "",
    image: image || "",
    rating: 0,
    reviews_count: 0,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const result = await db.collection("products").insertOne(doc);
  doc._id = String(result.insertedId);
  res.status(201).json(doc);
});

router.put("/:id", async (req, res) => {
  const db = getDb();
  const allowed = [
    "name",
    "description",
    "price",
    "stock",
    "category",
    "image",
    "status",
  ];
  const update = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) update[k] = req.body[k];
  }
  if (!Object.keys(update).length)
    return res.status(400).json({ error: "No valid fields" });
  update.updated_at = new Date().toISOString();
  const result = await db
    .collection("products")
    .updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
  if (result.matchedCount === 0)
    return res.status(404).json({ error: "Product not found" });
  const doc = await db
    .collection("products")
    .findOne({ _id: new ObjectId(req.params.id) });
  doc._id = String(doc._id);
  res.json(doc);
});

router.delete("/:id", async (req, res) => {
  const db = getDb();
  const result = await db
    .collection("products")
    .deleteOne({ _id: new ObjectId(req.params.id) });
  if (result.deletedCount === 0)
    return res.status(404).json({ error: "Product not found" });
  res.json({ ok: true });
});

module.exports = router;
