const express = require("express");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* ========== MIDDLEWARE ========== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "food-secret",
    resave: false,
    saveUninitialized: false
  })
);

/* ========== STATIC FILES ========== */
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

/* ✅ FIX: Explicit home route */
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

/* ========== DATABASE ========== */
const DB_PATH = path.join(__dirname, "orders.db");

const db = new sqlite3.Database(DB_PATH, err => {
  if (err) console.error(err);
  else console.log("✅ SQLite connected");
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_no INTEGER,
      customer_name TEXT,
      customer_phone TEXT,
      items TEXT,
      total INTEGER,
      payment TEXT,
      status TEXT DEFAULT 'Pending',
      time TEXT,
      date TEXT,
      datetime TEXT,
      can_modify_until INTEGER,
      complaint TEXT,
      kitchen_reply TEXT,
      cancelled INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    )
  `);

  db.run(`INSERT OR IGNORE INTO staff VALUES (1,'admin','admin123','admin')`);
  db.run(`INSERT OR IGNORE INTO staff VALUES (2,'kitchen','kitchen123','kitchen')`);
});

/* ========== HEALTH CHECK ========== */
app.get("/health", (_, res) => res.json({ status: "OK" }));

/* ========== START ========== */
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
