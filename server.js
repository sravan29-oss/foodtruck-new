const express = require("express");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

/* ========= MIDDLEWARE ========= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "food-secret",
    resave: false,
    saveUninitialized: false
  })
);

/* ========= STATIC FILES (FIXED) ========= */
const PUBLIC_DIR = path.join(process.cwd(), "public");
app.use(express.static(PUBLIC_DIR));

/* ========= HOME ROUTE (FIXED) ========= */
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

/* ========= DATABASE ========= */
const DB_PATH = path.join(process.cwd(), "orders.db");

const db = new sqlite3.Database(DB_PATH, err => {
  if (err) console.error("DB error", err);
  else console.log("✅ SQLite connected");
});

/* ========= HEALTH ========= */
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

/* ========= ORDER ========= */
app.post("/order", (req, res) => {
  res.json({ success: true });
});

/* ========= START ========= */
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
