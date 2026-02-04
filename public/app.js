const API_BASE = location.origin;

let cart = {};
let totalAmount = 0;
let paymentMethod = "";
const cartPanel = document.getElementById("cartPanel");
const cartBackdrop = document.getElementById("cartBackdrop");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const cartCount = document.getElementById("cartCount");
const searchInput = document.getElementById("searchInput");
const toast = document.getElementById("toast");
let currentCategory = "nonveg";
let activeFilters = new Set(["all"]);

/* MENU */
const menuItems = [
  {name:"Telangana Chicken Fry",price:150,category:"nonveg",img:"chicken_fry.jpg",spicy:true,popular:true,veg:false},
  {name:"Boti Fry",price:180,category:"nonveg",img:"boti_fry.jpg",spicy:true,popular:false,veg:false},
  {name:"Chicken Curry",price:160,category:"nonveg",img:"chicken_curry.jpg",spicy:true,popular:true,veg:false},
  {name:"Dum Biriyani",price:200,category:"nonveg",img:"dum_biriyani.jpg",spicy:false,popular:true,veg:false},
  {name:"Fry Piece Biriyani",price:220,category:"nonveg",img:"fry_piece_biriyani.jpg",spicy:true,popular:false,veg:false},
  {name:"Mutton Biriyani",price:260,category:"nonveg",img:"mutton_biriyani.jpg",spicy:true,popular:true,veg:false},

  {name:"Paneer Curry",price:140,category:"veg",img:"paneer.jpg",spicy:false,popular:true,veg:true},
  {name:"Dal Rice",price:120,category:"veg",img:"dal_rice.jpg",spicy:false,popular:false,veg:true},
  {name:"Veg Curry",price:130,category:"veg",img:"veg_curry.jpg",spicy:true,popular:false,veg:true},

  {name:"Samosa",price:20,category:"snacks",img:"samosa.jpg",spicy:true,popular:true,veg:true},
  {name:"Veg Puff",price:25,category:"snacks",img:"veg_puff.jpg",spicy:false,popular:false,veg:true},
  {name:"Chicken Puff",price:30,category:"snacks",img:"chicken_puff.jpg",spicy:false,popular:true,veg:false},

  {name:"Tea",price:15,category:"drinks",img:"tea.jpg",spicy:false,popular:true,veg:true},
  {name:"Coffee",price:25,category:"drinks",img:"coffee.jpg",spicy:false,popular:false,veg:true},
  {name:"Cool Drink",price:25,category:"drinks",img:"cooldrink.jpg",spicy:false,popular:true,veg:true}
];

/* RENDER MENU */
function renderMenu(type){
  const menu=document.getElementById("menu");
  const q = (searchInput?.value || "").trim().toLowerCase();
  menu.innerHTML="";
  const filtered = menuItems.filter(i=>{
    if(i.category!==type) return false;
    if(q && !i.name.toLowerCase().includes(q)) return false;
    if(!activeFilters.has("all")){
      if(activeFilters.has("veg") && !i.veg) return false;
      if(activeFilters.has("spicy") && !i.spicy) return false;
      if(activeFilters.has("popular") && !i.popular) return false;
    }
    return true;
  });

  if(!filtered.length){
    menu.innerHTML = `<div class="empty">No items found</div>`;
    return;
  }

  filtered.forEach(i=>{
    const q=cart[i.name]?.qty||0;
    menu.innerHTML+=`
      <div class="item">
        ${i.popular ? `<div class="badge-popular">Popular</div>` : ""}
        <img src="/images/${i.img}">
        <h4>${i.name}</h4>
        <p>₹${i.price}</p>
        <div>
          ${i.veg ? `<span class="tag">Veg</span>` : ""}
          ${i.spicy ? `<span class="tag spicy">Spicy</span>` : ""}
        </div>
        <div class="qty">
          <button onclick="updateQty('${i.name}',-1)">−</button>
          <span>${q}</span>
          <button onclick="updateQty('${i.name}',1)">+</button>
        </div>
      </div>`;
  });
}
renderMenu("nonveg");

/* TAB SHIFT */
document.querySelectorAll(".tab").forEach(tab=>{
  tab.onclick=()=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    tab.classList.add("active");
    currentCategory = tab.dataset.type;
    renderMenu(currentCategory);
  };
});

document.querySelectorAll(".chip").forEach(chip=>{
  chip.onclick=()=>{
    const f = chip.dataset.filter;
    if(f==="all"){
      activeFilters = new Set(["all"]);
      document.querySelectorAll(".chip").forEach(c=>c.classList.toggle("active", c.dataset.filter==="all"));
    }else{
      activeFilters.delete("all");
      chip.classList.toggle("active");
      if(chip.classList.contains("active")) activeFilters.add(f);
      else activeFilters.delete(f);
      const any = Array.from(document.querySelectorAll(".chip")).some(c=>c.dataset.filter!=="all" && c.classList.contains("active"));
      if(!any){
        activeFilters = new Set(["all"]);
        document.querySelectorAll(".chip").forEach(c=>c.classList.toggle("active", c.dataset.filter==="all"));
      }
    }
    renderMenu(currentCategory);
  };
});

searchInput?.addEventListener("input", () => renderMenu(currentCategory));

/* CART */
function updateQty(name,change){
  const item=menuItems.find(i=>i.name===name);
  cart[name]??={...item,qty:0};
  cart[name].qty+=change;
  if(cart[name].qty<=0)delete cart[name];
  updateTotal();
  if(change>0) showToast(`${name} added`);
}

function updateTotal(){
  totalAmount=0;
  Object.values(cart).forEach(i=>totalAmount+=i.price*i.qty);
  document.getElementById("total").innerText=totalAmount;
  renderCart();
}

function renderCart(){
  if(!cartItems) return;
  const items = Object.values(cart);
  cartItems.innerHTML = items.length
    ? items.map(i=>`
        <div class="cartRow">
          <div>${i.name}</div>
          <div>${i.qty} x ₹${i.price}</div>
        </div>
      `).join("")
    : `<div class="empty">Cart is empty</div>`;

  if(cartTotal) cartTotal.innerText = totalAmount;
  if(cartCount) cartCount.innerText = items.reduce((s,i)=>s+i.qty,0);
}

function toggleCart(){
  if(!cartPanel || !cartBackdrop) return;
  cartPanel.classList.toggle("open");
  cartBackdrop.classList.toggle("show");
  renderCart();
}

let toastTimer = null;
function showToast(text){
  if(!toast) return;
  toast.textContent = text;
  toast.classList.add("show");
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.classList.remove("show"), 1400);
}

/* PAYMENT */
cashBtn.onclick=()=>selectPayment("Cash");
upiBtn.onclick=()=>selectPayment("UPI");

function selectPayment(type){
  paymentMethod=type;
  cashBtn.classList.toggle("active",type==="Cash");
  upiBtn.classList.toggle("active",type==="UPI");
}

/* PLACE ORDER */
function placeOrder(){
  const name=custName.value.trim();
  const phone=custPhone.value.trim();

  if(!name) return alert("Enter your name");
  if(phone.length!==10) return alert("Enter valid phone");
  if(!Object.keys(cart).length) return alert("Select food items");
  if(!paymentMethod) return alert("Select Cash or UPI");

  fetch(`${API_BASE}/order`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      table:1,
      name,phone,
      items:Object.values(cart),
      total:totalAmount,
      payment:paymentMethod
    })
  })
  .then(r=>r.json())
  .then(d=>{
    if(d.success){
      location.href=`/order-status.html?id=${d.orderId}`;
    }else{
      alert("Order failed");
    }
  })
  .catch(()=>alert("Network error"));
}
