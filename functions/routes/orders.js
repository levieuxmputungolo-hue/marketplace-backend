const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  const { buyer_id, seller_id } = req.query;
  const db = getDb();
  const query = {};
  if (buyer_id) query.buyer_id = buyer_id;
  if (seller_id) query.seller_id = seller_id;
  const docs = await db
    .collection("orders")
    .find(query)
    .sort({ created_at: -1 })
    .toArray();
  docs.forEach((d) => (d._id = String(d._id)));
  res.json(docs);
});

router.get("/:id", async (req, res) => {
  const db = getDb();
  try {
    const doc = await db
      .collection("orders")
      .findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).json({ error: "Order not found" });
    doc._id = String(doc._id);
    res.json(doc);
  } catch {
    res.status(400).json({ error: "Invalid order ID" });
  }
});

router.post("/", async (req, res) => {
  const { buyer_id, items, total, shipping_address, payment_method, notes } = req.body;
  if (!buyer_id || !items || total == null)
    return res.status(400).json({ error: "buyer_id, items, total required" });
  const db = getDb();
  for (const item of items) {
    if (item.product_id) {
      try {
        await db.collection("products").updateOne(
          { _id: new ObjectId(item.product_id) },
          { $inc: { stock: -(item.quantity || 1) } }
        );
      } catch {
        /* skip */
      }
    }
  }
  const doc = {
    buyer_id,
    items,
    total: parseFloat(total),
    status: "pending",
    shipping_address: shipping_address || {},
    payment_method: payment_method || "",
    payment_status: "unpaid",
    notes: notes || "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const result = await db.collection("orders").insertOne(doc);
  doc._id = String(result.insertedId);
  res.status(201).json(doc);
});

router.put("/:id/status", async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "Status required" });
  const db = getDb();
  const result = await db.collection("orders").updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { status, updated_at: new Date().toISOString() } }
  );
  if (result.matchedCount === 0)
    return res.status(404).json({ error: "Order not found" });
  res.json({ ok: true, status });
});

module.exports = router;
