const API_BASE = location.origin;

let cart = {};
let totalAmount = 0;
let paymentMethod = "";

/* MENU (UNCHANGED AS YOU ASKED) */
const menuItems = [
  {name:"Telangana Chicken Fry",price:150,category:"nonveg",img:"chicken_fry.jpg"},
  {name:"Boti Fry",price:180,category:"nonveg",img:"boti_fry.jpg"},
  {name:"Chicken Curry",price:160,category:"nonveg",img:"chicken_curry.jpg"},
  {name:"Dum Biriyani",price:200,category:"nonveg",img:"dum_biriyani.jpg"},
  {name:"Fry Piece Biriyani",price:220,category:"nonveg",img:"fry_piece_biriyani.jpg"},
  {name:"Mutton Biriyani",price:260,category:"nonveg",img:"mutton_biriyani.jpg"},

  {name:"Paneer Curry",price:140,category:"veg",img:"paneer.jpg"},
  {name:"Dal Rice",price:120,category:"veg",img:"dal_rice.jpg"},
  {name:"Veg Curry",price:130,category:"veg",img:"veg_curry.jpg"},

  {name:"Samosa",price:20,category:"snacks",img:"samosa.jpg"},
  {name:"Veg Puff",price:25,category:"snacks",img:"veg_puff.jpg"},
  {name:"Chicken Puff",price:30,category:"snacks",img:"chicken_puff.jpg"},

  {name:"Tea",price:15,category:"drinks",img:"tea.jpg"},
  {name:"Coffee",price:25,category:"drinks",img:"coffee.jpg"},
  {name:"Cool Drink",price:25,category:"drinks",img:"cooldrink.jpg"}
];

/* RENDER MENU */
function renderMenu(type){
  const menu=document.getElementById("menu");
  menu.innerHTML="";
  menuItems.filter(i=>i.category===type).forEach(i=>{
    const q=cart[i.name]?.qty||0;
    menu.innerHTML+=`
      <div class="item">
        <img src="/images/${i.img}">
        <h4>${i.name}</h4>
        <p>₹${i.price}</p>
        <div class="qty">
          <button onclick="updateQty('${i.name}',-1)">−</button>
          <span>${q}</span>
          <button onclick="updateQty('${i.name}',1)">+</button>
        </div>
      </div>`;
  });
}
renderMenu("nonveg");

/* TAB SHIFT FIX */
document.querySelectorAll(".tab").forEach(tab=>{
  tab.onclick=()=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    tab.classList.add("active");
    renderMenu(tab.dataset.type);
  };
});

/* CART */
function updateQty(name,change){
  const item=menuItems.find(i=>i.name===name);
  cart[name]??={...item,qty:0};
  cart[name].qty+=change;
  if(cart[name].qty<=0)delete cart[name];
  updateTotal();
}

function updateTotal(){
  totalAmount=0;
  Object.values(cart).forEach(i=>totalAmount+=i.price*i.qty);
  document.getElementById("total").innerText=totalAmount;
}

/* PAYMENT FIX */
cashBtn.onclick=()=>selectPayment("Cash");
upiBtn.onclick=()=>selectPayment("UPI");

function selectPayment(type){
  paymentMethod=type;
  cashBtn.classList.toggle("active",type==="Cash");
  upiBtn.classList.toggle("active",type==="UPI");
}

/* PLACE ORDER (STRICT VALIDATION) */
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
