const express = require("express");
const { ObjectId } = require("mongodb");
const crypto = require("crypto");
const { getDb } = require("../db");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { email, phone, name, password, role } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });
  const db = getDb();
  const existing = await db
    .collection("users")
    .findOne({ $or: [{ email }, { phone }] });
  if (existing) return res.status(400).json({ error: "User exists" });
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  const doc = {
    email: email.toLowerCase().trim(),
    phone: (phone || "").trim(),
    name: (name || "").trim(),
    password_hash: hash,
    role: role || "client",
    verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const result = await db.collection("users").insertOne(doc);
  doc._id = String(result.insertedId);
  delete doc.password_hash;
  res.status(201).json(doc);
});

router.post("/login", async (req, res) => {
  const { email, phone, password } = req.body;
  if (!password) return res.status(400).json({ error: "Password required" });
  const db = getDb();
  const query = email ? { email: email.toLowerCase().trim() } : { phone: (phone || "").trim() };
  const user = await db.collection("users").findOne(query);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  if (user.password_hash !== hash)
    return res.status(401).json({ error: "Invalid credentials" });
  user._id = String(user._id);
  delete user.password_hash;
  res.json(user);
});

router.get("/:id", async (req, res) => {
  const db = getDb();
  let user;
  try {
    user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(req.params.id) });
  } catch {
    user = await db.collection("users").findOne({ email: req.params.id });
  }
  if (!user) return res.status(404).json({ error: "User not found" });
  user._id = String(user._id);
  delete user.password_hash;
  res.json(user);
});

router.put("/:id", async (req, res) => {
  const db = getDb();
  const allowed = ["name", "phone", "address", "city", "country", "role"];
  const update = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) update[k] = req.body[k];
  }
  if (!Object.keys(update).length)
    return res.status(400).json({ error: "No valid fields" });
  update.updated_at = new Date().toISOString();
  const result = await db
    .collection("users")
    .updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
  if (result.matchedCount === 0)
    return res.status(404).json({ error: "User not found" });
  const user = await db
    .collection("users")
    .findOne({ _id: new ObjectId(req.params.id) });
  user._id = String(user._id);
  delete user.password_hash;
  res.json(user);
});

module.exports = router;
