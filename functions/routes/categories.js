const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  const db = getDb();
  const docs = await db.collection("categories").find({}).toArray();
  docs.forEach((d) => (d._id = String(d._id)));
  res.json(docs);
});

router.post("/", async (req, res) => {
  const { name, description, image } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });
  const db = getDb();
  const existing = await db.collection("categories").findOne({ name });
  if (existing) return res.status(400).json({ error: "Category exists" });
  const doc = {
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    description: description || "",
    image: image || "",
    created_at: new Date().toISOString(),
  };
  const result = await db.collection("categories").insertOne(doc);
  doc._id = String(result.insertedId);
  res.status(201).json(doc);
});

router.delete("/:id", async (req, res) => {
  const db = getDb();
  const result = await db
    .collection("categories")
    .deleteOne({ _id: new ObjectId(req.params.id) });
  if (result.deletedCount === 0)
    return res.status(404).json({ error: "Category not found" });
  res.json({ ok: true });
});

module.exports = router;
