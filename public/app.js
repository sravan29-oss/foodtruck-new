/* ================= API BASE (FINAL FIX) ================= */
const API_BASE =
  location.hostname === "localhost"
    ? "http://localhost:3000"
    : location.origin;

console.log("API_BASE =", API_BASE);

/* ================= LANGUAGE ================= */
let lang = "EN";

const TEXT = {
  EN: {
    total: "Total",
    placeOrder: "Place Order",
    cash: "CASH",
    upi: "UPI"
  },
  TE: {
    total: "మొత్తం",
    placeOrder: "ఆర్డర్ పెట్టండి",
    cash: "నగదు",
    upi: "యూపీఐ"
  }
};

function toggleLang() {
  lang = lang === "EN" ? "TE" : "EN";
  applyLang();
}

function applyLang() {
  document.getElementById("totalLabel").innerText = TEXT[lang].total;
  document.getElementById("orderBtn").innerText = TEXT[lang].placeOrder;
  document.getElementById("cashBtn").innerText = TEXT[lang].cash;
  document.getElementById("upiBtn").innerText = TEXT[lang].upi;
}

console.log("✅ app.js loaded");

/* ================= GLOBALS ================= */
let cart = {};
let paymentMethod = "Cash";
let totalAmount = 0;

const TABLE_NO =
  new URLSearchParams(location.search).get("table") || 1;

/* ================= MENU DATA ================= */
const menuItems = [
  { name: "Telangana Chicken Fry", price: 150, category: "nonveg", img: "chicken_fry.jpg" },
  { name: "Boti Fry", price: 180, category: "nonveg", img: "boti_fry.jpg" },
  { name: "Chicken Curry", price: 160, category: "nonveg", img: "chicken_curry.jpg" },
  { name: "Dum Biriyani", price: 200, category: "nonveg", img: "dum_biriyani.jpg" },
  { name: "Fry Piece Biriyani", price: 220, category: "nonveg", img: "fry_piece_biriyani.jpg" },
  { name: "Mutton Biriyani", price: 260, category: "nonveg", img: "mutton_biriyani.jpg" },

  { name: "Paneer Curry", price: 140, category: "veg", img: "paneer.jpg" },
  { name: "Dal Rice", price: 120, category: "veg", img: "dal_rice.jpg" },
  { name: "Veg Curry", price: 130, category: "veg", img: "veg_curry.jpg" },

  { name: "Samosa", price: 20, category: "snacks", img: "samosa.jpg" },
  { name: "Veg Puff", price: 25, category: "snacks", img: "veg_puff.jpg" },
  { name: "Chicken Puff", price: 30, category: "snacks", img: "chicken_puff.jpg" },

  { name: "Tea", price: 15, category: "drinks", img: "tea.jpg" },
  { name: "Coffee", price: 25, category: "drinks", img: "coffee.jpg" },
  { name: "Cool Drink", price: 25, category: "drinks", img: "cooldrink.jpg" }
];

/* ================= RENDER MENU ================= */
function renderMenu(filter = "all") {
  const menu = document.getElementById("menu");
  menu.innerHTML = "";

  menuItems
    .filter(i => filter === "all" || i.category === filter)
    .forEach(item => {
      const qty = cart[item.name]?.qty || 0;

      const div = document.createElement("div");
      div.className = "item";

      div.innerHTML = `
        <img src="/images/${item.img}" loading="lazy">
        <h4>${item.name}</h4>
        <p>₹${item.price}</p>
        <div class="qty">
          <button onclick="updateQty('${item.name}', -1)">−</button>
          <span>${qty}</span>
          <button onclick="updateQty('${item.name}', 1)">+</button>
        </div>
      `;

      menu.appendChild(div);
    });
}

renderMenu();

/* ================= FILTER ================= */
function filterMenu(type, btn) {
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderMenu(type);
}

/* ================= CART ================= */
function updateQty(name, change) {
  if (!cart[name]) {
    const item = menuItems.find(i => i.name === name);
    cart[name] = { ...item, qty: 0 };
  }

  cart[name].qty += change;
  if (cart[name].qty <= 0) delete cart[name];

  updateTotal();
  renderMenu(
    document.querySelector(".tab.active")?.dataset.type || "all"
  );
}

function updateTotal() {
  totalAmount = 0;
  Object.values(cart).forEach(i => {
    totalAmount += i.price * i.qty;
  });
  document.getElementById("total").innerText = totalAmount;
}

/* ================= PAYMENT ================= */
function selectPayment(type) {
  paymentMethod = type;

  document.getElementById("cashBtn").classList.remove("active");
  document.getElementById("upiBtn").classList.remove("active");

  if (type === "Cash") document.getElementById("cashBtn").classList.add("active");
  if (type === "UPI") document.getElementById("upiBtn").classList.add("active");
}

/* ================= PLACE ORDER (WORKING) ================= */
function placeOrder() {
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();

  if (!name) return alert("Please enter your name");
  if (!phone || phone.length !== 10)
    return alert("Please enter valid 10-digit phone number");

  const itemsArray = Object.values(cart);
  if (itemsArray.length === 0)
    return alert("Please select at least one item");

  fetch(`${API_BASE}/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table: TABLE_NO,
      name,
      phone,
      items: itemsArray,
      total: totalAmount,
      payment: paymentMethod
    })
  })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        location.href = `/order-status.html?id=${d.orderId}`;
      } else {
        alert("Order failed");
      }
    })
    .catch(err => {
      console.error(err);
      alert("Network error");
    });
}
