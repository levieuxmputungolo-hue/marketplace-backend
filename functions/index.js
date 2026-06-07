const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const { connect } = require("./db");

// Routes
const productsRouter = require("./routes/products");
const categoriesRouter = require("./routes/categories");
const usersRouter = require("./routes/users");
const ordersRouter = require("./routes/orders");

admin.initializeApp();

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Health check
app.get("/ping", (req, res) => {
  res.json({ ok: true, db: "mongodb", status: "connected" });
});

// Mount routes
app.use("/api/products", productsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/users", usersRouter);
app.use("/api/orders", ordersRouter);

// MongoDB connect on first call
let connected = false;
app.use(async (req, res, next) => {
  if (!connected) {
    try {
      await connect();
      connected = true;
    } catch (err) {
      console.error("MongoDB connection failed:", err.message);
    }
  }
  next();
});

exports.api = functions.https.onRequest(app);
