const session = require("express-session");
const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = 3000;

/* ---------- MIDDLEWARE ---------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "food-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,     // true only if HTTPS forced
      maxAge: 1000 * 60 * 60 * 6
    }
  })
);


const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR));

/* ---------- DATABASE ---------- */
const path = require("path");

const db = new sqlite3.Database(
  path.join(__dirname, "orders.db")
);


db.serialize(() => {

  /* ORDERS TABLE */
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

  /* SAFE MIGRATIONS (won’t crash if already exists) */
  db.run("ALTER TABLE orders ADD COLUMN customer_name TEXT", ()=>{});
  db.run("ALTER TABLE orders ADD COLUMN customer_phone TEXT", ()=>{});
  db.run("ALTER TABLE orders ADD COLUMN can_modify_until INTEGER", ()=>{});
  db.run("ALTER TABLE orders ADD COLUMN complaint TEXT", ()=>{});
  db.run("ALTER TABLE orders ADD COLUMN kitchen_reply TEXT", ()=>{});
  db.run("ALTER TABLE orders ADD COLUMN cancelled INTEGER DEFAULT 0", ()=>{});
  db.run("ALTER TABLE orders ADD COLUMN complaint TEXT", ()=>{});
  db.run("ALTER TABLE orders ADD COLUMN kitchen_reply TEXT", ()=>{});


  /* STAFF */
  db.run(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS staff_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      action TEXT,
      time TEXT
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

/* ---------- HELPERS ---------- */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user || req.session.user.role !== role) {
      return res.redirect("/login.html");
    }
    next();
  };
}

/* ---------- AUTH ---------- */
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

/* ---------- PLACE ORDER ---------- */
app.post("/order", (req, res) => {
  const { table, name, phone, items, total, payment } = req.body;

  if (!items || Object.keys(items).length === 0) {
    return res.json({ success: false });
  }

  const now = new Date();
  const time = now.toLocaleTimeString();
  const date = now.toLocaleDateString("en-CA");
  const datetime = now.toISOString();
  const canModifyUntil = Date.now() + 60 * 1000;

  db.run(
    `INSERT INTO orders
     (table_no, customer_name, customer_phone, items, total, payment,
      status, time, date, datetime, can_modify_until)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      table,
      name,
      phone,
      JSON.stringify(items),
      total,
      payment,
      "Pending",
      time,
      date,
      datetime,
      canModifyUntil
    ],
    function (err) {
      if (err) {
        console.error(err);
        return res.json({ success: false });
      }
      res.json({ success: true, orderId: this.lastID });
    }
  );
});

/* ---------- KITCHEN ORDERS ---------- */
app.get("/orders", requireRole("kitchen"), (req, res) => {
  db.all(
    "SELECT * FROM orders ORDER BY datetime DESC",
    [],
    (e, rows) => res.json(rows || [])
  );
});

/* ---------- SINGLE ORDER ---------- */
app.get("/order/:id", (req, res) => {
  db.get(
    "SELECT * FROM orders WHERE id=?",
    [req.params.id],
    (e, row) => {
      if (!row) return res.status(404).json({ success: false });
      res.json(row);
    }
  );
});

/* ---------- UPDATE STATUS ---------- */
app.post("/order/status", (req, res) => {
  db.run(
    "UPDATE orders SET status=? WHERE id=?",
    [req.body.status, req.body.id],
    () => res.json({ success: true })
  );
});

/* ---------- CANCEL ORDER ---------- */
app.post("/order/cancel", (req, res) => {
  const { id } = req.body;

  db.get(
    "SELECT can_modify_until,status FROM orders WHERE id=?",
    [id],
    (e, row) => {
      if (!row || row.status !== "Pending") {
        return res.json({ success: false });
      }
      if (Date.now() > row.can_modify_until) {
        return res.json({ success: false });
      }

      db.run(
        "UPDATE orders SET cancelled=1,status='Cancelled' WHERE id=?",
        [id],
        () => res.json({ success: true })
      );
    }
  );
});

/* ---------- CUSTOMER COMPLAINT ---------- */
app.post("/order/complaint", (req, res) => {
  const { id, text } = req.body;

  if (!text || !text.trim()) {
    return res.json({ success: false });
  }

  db.run(
    "UPDATE orders SET complaint=? WHERE id=?",
    [text.trim(), id],
    () => res.json({ success: true })
  );
});

/* ---------- KITCHEN REPLY ---------- */
app.post("/order/reply", (req, res) => {
  const { id, reply } = req.body;

  db.run(
    "UPDATE orders SET kitchen_reply=? WHERE id=?",
    [reply, id],
    () => res.json({ success: true })
  );
});


/* ---------- ADMIN REPORT ---------- */
app.get("/admin/report", requireRole("admin"), (req, res) => {
  db.all(
    `SELECT * FROM orders ORDER BY datetime DESC`,
    [],
    (e, rows) => res.json(rows || [])
  );
});

/* ---------- PAGES ---------- */
app.get("/admin.html", requireRole("admin"), (req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "admin.html"))
);

app.get("/kitchen.html", requireRole("kitchen"), (req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "kitchen.html"))
);

/* ---------- START ---------- */
app.listen(PORT, () => {
  console.log("✅ Server running on http://localhost:3000");
});
