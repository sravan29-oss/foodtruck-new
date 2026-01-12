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

/* ========= STATIC FILES ========= */
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

/* ========= HOME ========= */
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

/* ========= DATABASE ========= */
const db = new sqlite3.Database(
  path.join(process.cwd(), "orders.db"),
  err => {
    if (err) console.error(err);
    else console.log("✅ SQLite connected");
  }
);

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
