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
app.get("/health", (_, res) => res.json({ ok: true }));

/* ========== AUTH ========== */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user || req.session.user.role !== role) {
      return res.status(401).json({ success: false });
    }
    next();
  };
}

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get(
    "SELECT * FROM staff WHERE username=? AND password=?",
    [username, password],
    (e, user) => {
      if (!user) return res.json({ success: false });
      req.session.user = user;
      res.json({ success: true, role: user.role });
    }
  );
});

/* ========== PLACE ORDER ========== */
app.post("/order", (req, res) => {
  const { table, name, phone, items, total, payment } = req.body;

  if (!items || !items.length) {
    return res.json({ success: false });
  }

  const now = new Date();

  db.run(
    `INSERT INTO orders
     (table_no, customer_name, customer_phone, items, total, payment,
      time, date, datetime, can_modify_until)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      table,
      name,
      phone,
      JSON.stringify(items),
      total,
      payment,
      now.toLocaleTimeString(),
      now.toLocaleDateString("en-CA"),
      now.toISOString(),
      Date.now() + 60000
    ],
    function (err) {
      if (err) return res.status(500).json({ success: false });
      res.json({ success: true, orderId: this.lastID });
    }
  );
});

/* ========== CUSTOMER ========== */
app.get("/order/:id", (req, res) => {
  db.get(
    "SELECT * FROM orders WHERE id=?",
    [req.params.id],
    (e, row) => res.json(row || {})
  );
});

app.post("/order/complaint", (req, res) => {
  db.run(
    "UPDATE orders SET complaint=? WHERE id=?",
    [req.body.text, req.body.id],
    () => res.json({ success: true })
  );
});

/* ========== KITCHEN ========== */
app.get("/orders", requireRole("kitchen"), (req, res) => {
  db.all("SELECT * FROM orders ORDER BY datetime DESC", [], (e, rows) =>
    res.json(rows || [])
  );
});

app.post("/order/status", (req, res) => {
  db.run(
    "UPDATE orders SET status=? WHERE id=?",
    [req.body.status, req.body.id],
    () => res.json({ success: true })
  );
});

app.post("/order/reply", (req, res) => {
  db.run(
    "UPDATE orders SET kitchen_reply=? WHERE id=?",
    [req.body.reply, req.body.id],
    () => res.json({ success: true })
  );
});

/* ========== ADMIN ========== */
app.get("/admin/report", requireRole("admin"), (req, res) => {
  db.all("SELECT * FROM orders ORDER BY datetime DESC", [], (e, rows) =>
    res.json(rows || [])
  );
});

/* ========== START ========== */
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
