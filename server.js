const express = require("express");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------- MIDDLEWARE ---------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "food-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 1000 * 60 * 60 * 6
    }
  })
);

/* ---------- STATIC FILES ---------- */
const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR));

/* ---------- DATABASE ---------- */
const db = new sqlite3.Database(
  path.join(__dirname, "orders.db")
);

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

  // Safe migrations
  db.run("ALTER TABLE orders ADD COLUMN complaint TEXT", () => {});
  db.run("ALTER TABLE orders ADD COLUMN kitchen_reply TEXT", () => {});
  db.run("ALTER TABLE orders ADD COLUMN cancelled INTEGER DEFAULT 0", () => {});

  db.run(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    )
  `);

  db.run(
    `INSERT OR IGNORE INTO staff (username,password,role)
     VALUES ('admin','admin123','admin')`
  );
  db.run(
    `INSERT OR IGNORE INTO staff (username,password,role)
     VALUES ('kitchen','kitchen123','kitchen')`
  );
});

/* ---------- AUTH ---------- */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user || req.session.user.role !== role) {
      return res.redirect("/login.html");
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

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

/* ---------- ORDERS ---------- */
app.post("/order", (req, res) => {
  const { table, name, phone, items, total, payment } = req.body;
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
    function () {
      res.json({ success: true, orderId: this.lastID });
    }
  );
});

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

app.post("/order/complaint", (req, res) => {
  const { id, text } = req.body;
  if (!text) return res.json({ success: false });

  db.run(
    "UPDATE orders SET complaint=? WHERE id=?",
    [text.trim(), id],
    () => res.json({ success: true })
  );
});

app.post("/order/reply", (req, res) => {
  const { id, reply } = req.body;
  db.run(
    "UPDATE orders SET kitchen_reply=? WHERE id=?",
    [reply, id],
    () => res.json({ success: true })
  );
});

app.get("/admin/report", requireRole("admin"), (req, res) => {
  db.all("SELECT * FROM orders ORDER BY datetime DESC", [], (e, rows) =>
    res.json(rows || [])
  );
});

/* ---------- START ---------- */
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
