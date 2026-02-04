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

/* ========= PAGE ROUTES ========= */
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

  db.all("PRAGMA table_info(orders)", (err, cols) => {
    if (err || !Array.isArray(cols)) return;
    const existing = new Set(cols.map(c => c.name));
    const addCol = (name, type, def) => {
      if (existing.has(name)) return;
      const sql = `ALTER TABLE orders ADD COLUMN ${name} ${type}${def ? ` DEFAULT ${def}` : ""}`;
      db.run(sql);
    };
    addCol("complaint", "TEXT");
    addCol("kitchen_reply", "TEXT");
    addCol("cancelled", "INTEGER", "0");
  });
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

/* ========= LOGOUT ========= */
app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
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

/* ========= ORDER DETAILS (BY PARAM) ========= */
app.get("/order/:id", (req, res) => {
  const id = req.params.id;
  db.get("SELECT * FROM orders WHERE id=?", [id], (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: "not_found" });
    }

    let canModifyUntil = 0;
    if (row.status === "Pending" && !row.cancelled && row.datetime) {
      const t = Date.parse(row.datetime);
      if (!Number.isNaN(t)) canModifyUntil = t + 5 * 60 * 1000;
    }

    res.json({ ...row, can_modify_until: canModifyUntil });
  });
});

/* ========= ORDER DETAILS (BY QUERY fallback) ========= */
app.get("/order", (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "missing_id" });
  db.get("SELECT * FROM orders WHERE id=?", [id], (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: "not_found" });
    }
    let canModifyUntil = 0;
    if (row.status === "Pending" && !row.cancelled && row.datetime) {
      const t = Date.parse(row.datetime);
      if (!Number.isNaN(t)) canModifyUntil = t + 5 * 60 * 1000;
    }
    res.json({ ...row, can_modify_until: canModifyUntil });
  });
});

/* ========= ORDER STATUS UPDATE (KITCHEN) ========= */
app.post("/order/status", (req, res) => {
  if (!req.session.user || req.session.user.role !== "kitchen") {
    return res.status(401).json({ success: false });
  }

  const { id, status } = req.body;
  if (!id || !status) return res.json({ success: false });

  db.run(
    "UPDATE orders SET status=? WHERE id=? AND (cancelled=0 OR cancelled IS NULL)",
    [status, id],
    function (err) {
      res.json({ success: !err && this.changes > 0 });
    }
  );
});

/* ========= ORDER CANCEL ========= */
app.post("/order/cancel", (req, res) => {
  const { id } = req.body;
  if (!id) return res.json({ success: false });

  db.run(
    "UPDATE orders SET status='Cancelled', cancelled=1 WHERE id=? AND status='Pending' AND (cancelled=0 OR cancelled IS NULL)",
    [id],
    function (err) {
      res.json({ success: !err && this.changes > 0 });
    }
  );
});

/* ========= ORDER COMPLAINT ========= */
app.post("/order/complaint", (req, res) => {
  const { id, text } = req.body;
  if (!id || !text) return res.json({ success: false });

  db.run(
    "UPDATE orders SET complaint=? WHERE id=?",
    [text, id],
    function (err) {
      res.json({ success: !err && this.changes > 0 });
    }
  );
});

/* ========= KITCHEN REPLY ========= */
app.post("/order/reply", (req, res) => {
  if (!req.session.user || req.session.user.role !== "kitchen") {
    return res.status(401).json({ success: false });
  }

  const { id, reply } = req.body;
  if (!id || !reply) return res.json({ success: false });

  db.run(
    "UPDATE orders SET kitchen_reply=? WHERE id=?",
    [reply, id],
    function (err) {
      res.json({ success: !err && this.changes > 0 });
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

/* ========= DIAGNOSTICS ========= */
app.get("/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/whoami", (req, res) => {
  res.json({ session: req.session.user || null });
});

/* ========= START ========= */
app.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
});
