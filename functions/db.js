const { MongoClient } = require("mongodb");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/easy-market";
const DB_NAME = process.env.MONGO_DB_NAME || "easy-market";

let client = null;
let db = null;

async function connect() {
  if (db) return db;
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log(`MongoDB connected: ${DB_NAME}`);
  return db;
}

function getDb() {
  if (!db) throw new Error("Database not connected. Call connect() first.");
  return db;
}

async function close() {
  if (client) await client.close();
}

module.exports = { connect, getDb, close };
