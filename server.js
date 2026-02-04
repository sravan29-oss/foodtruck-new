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
    name: "foodtruck.sid",
    secret: process.env.SESSION_SECRET || "food-secret",
    resave: false,
    saveUninitialized: false
  })
);

/* ========= STATIC FILES ========= */
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

/* ========= PAGE ROUTES (FIX) ========= */
app.get("/", (req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "index.html"))
);

app.get("/login", (req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "login.html"))
);

app.get("/kitchen", (req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "kitchen.html"))
);

app.get("/admin", (req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "admin.html"))
);

/* ========= DATABASE ========= */
const db = new sqlite3.Database(
  path.join(process.cwd(), "orders.db")
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
      datetime TEXT
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

/* ========= AUTH ========= */
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.get(
    "SELECT * FROM staff WHERE username=? AND password=?",
    [username, password],
    (err, user) => {
      if (!user) return res.json({ success: false });
      req.session.user = user;
      res.json({ success: true, role: user.role });
    }
  );
});

/* ========= KITCHEN ORDERS ========= */
app.get("/orders", (req, res) => {
  if (!req.session.user || req.session.user.role !== "kitchen") {
    return res.status(401).json([]);
  }

  db.all(
    "SELECT * FROM orders ORDER BY datetime DESC",
    [],
    (e, rows) => res.json(rows || [])
  );
});

/* ========= PLACE ORDER ========= */
app.post("/order", (req, res) => {
  const { table, name, phone, items, total, payment } = req.body;
  const now = new Date();

  if (!items || !items.length) {
    return res.json({ success: false });
  }

  db.run(
    `INSERT INTO orders
     (table_no, customer_name, customer_phone, items, total, payment, time, date, datetime)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      table,
      name,
      phone,
      JSON.stringify(items),
      total,
      payment,
      now.toLocaleTimeString(),
      now.toLocaleDateString("en-CA"),
      now.toISOString()
    ],
    function () {
      res.json({ success: true, orderId: this.lastID });
    }
  );
});

/* ========= ADMIN REPORT ========= */
app.get("/admin/report", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(401).json([]);
  }

  db.all(
    "SELECT * FROM orders ORDER BY datetime DESC",
    [],
    (e, rows) => res.json(rows || [])
  );
});

/* ========= START ========= */
app.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
});
