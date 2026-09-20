import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyDTPc2pfOydy70q3yo2puhxkSpwMWOedK0",
  authDomain: "hisaab-6cd58.firebaseapp.com",
  projectId: "hisaab-6cd58",
  storageBucket: "hisaab-6cd58.firebasestorage.app",
  messagingSenderId: "569723713348",
  appId: "1:569723713348:web:b27bf4457a4f5fdf39c911"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const entriesRef = collection(db, "entries");
const ACCOUNTS = [
  "Charu's Google account", "My Google account", "Cash", "Gullak 1 (college fee)", "Gullak 2 (saving)", "Crochet income"
];
const INCOME_CATEGORIES = ["Tuition", "Crochet", "Mehendi", "Gift / Family / Relative"];
const EXPENSE_CATEGORIES = ["Bus pass recharge", "Phone recharge", "Mummy / Papa ko diya", "Khana", "Transport (auto)", "Order", "Crochet saman", "Mandir saman", "Ghar ka saman", "Other"];
const TYPES = ["income", "expense", "udhar", "held", "transfer"];
const TYPE_LABELS = { income: "Income", expense: "Expense", udhar: "Udhar", held: "Held", transfer: "Transfer" };
const KEY_PIN = "hisaab_pin_v2";
let entries = [];
let pin = localStorage.getItem(KEY_PIN) || "";
let pinInput = "", pinStep = pin ? "login" : "create", editingId = null;
let formState = { type: "income", sub: "lent", category: INCOME_CATEGORIES[0], account: ACCOUNTS[0], to: ACCOUNTS[1] };
const $ = id => document.getElementById(id);
const money = n => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const monthKey = d => String(d).slice(0, 7);
const monthLabel = k => new Date(k + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function showLock() {
  $("lock-screen").hidden = false; $("app").hidden = true; $("fab").hidden = true;
  pinInput = ""; updateDots();
  $("lock-title").textContent = pin ? "PIN daalo" : "PIN banao";
  $("lock-hint").textContent = pin ? "4 digit PIN enter karo" : pinStep === "confirm" ? "Same PIN dobara enter karo" : "4 digit PIN enter karo";
  $("lock-error").textContent = "";
}
function updateDots() {
  [...$("pin-dots").children].forEach((x, i) => x.classList.toggle("filled", i < pinInput.length));
}
function unlock() {
  if (pinStep === "create") {
    if (pinInput.length !== 4) return;
    window._newPin = pinInput; pinInput = ""; pinStep = "confirm"; showLock(); return;
  }
  if (pinStep === "confirm") {
    if (pinInput.length !== 4) return;
    if (pinInput !== window._newPin) { $("lock-error").textContent = "PIN match nahi hua. Dobara banao."; pinInput = ""; updateDots(); pinStep = "create"; return }
    pin = window._newPin; localStorage.setItem(KEY_PIN, pin); openApp(); return;
  }
  if (pinInput === pin) openApp();
  else { $("lock-error").textContent = "Wrong PIN. Dobara try karo."; pinInput = ""; updateDots() }
}
function openApp() {
  $("lock-screen").hidden = true; $("app").hidden = false; $("fab").hidden = false;
  startFirebaseSync(); renderAll();
}
$("keypad").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return; const k = b.dataset.key;
  if (k === "back") pinInput = pinInput.slice(0, -1); else if (/^\d$/.test(k) && pinInput.length < 4) pinInput += k;
  updateDots(); $("lock-error").textContent = ""; if (pinInput.length === 4) setTimeout(unlock, 120);
});
$("lock-btn").onclick = () => showLock();
function startFirebaseSync() {
  onSnapshot(entriesRef, snapshot => {
    entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  }, error => {
    console.error("Firebase sync failed:", error);
    toast("Firebase sync nahi ho paya.");
  });
}
async function addEntryToFirebase(data) {
  const cleanData = { ...data };
  delete cleanData.id;
  await addDoc(entriesRef, cleanData);
}
async function updateEntryInFirebase(id, data) {
  const cleanData = { ...data };
  delete cleanData.id;
  await updateDoc(doc(db, "entries", id), cleanData);
}
async function deleteEntryFromFirebase(id) {
  await deleteDoc(doc(db, "entries", id));
}
$("type-tabs").onclick = null;
function typeButtons() {
  $("type-tabs").innerHTML = TYPES.map(t => `<button type="button" class="type-tab ${t} ${formState.type === t ? "active" : ""}" data-type="${t}">${TYPE_LABELS[t]}</button>`).join("");
  $("type-tabs").onclick = e => { const b = e.target.closest("[data-type]"); if (b) { formState.type = b.dataset.type; renderForm(); } };
}
function chips(id, items, selected, key) {
  $(id).innerHTML = items.map(x => `<button type="button" class="chip ${x === selected ? "active" : ""}" data-value="${encodeURIComponent(x)}">${x}</button>`).join("");
  $(id).onclick = e => { const b = e.target.closest("[data-value]"); if (!b) return; formState[key] = decodeURIComponent(b.dataset.value); renderForm(); };
}
function renderForm() {
  typeButtons();
  const t = formState.type;
  $("row-category").hidden = !(t === "income" || t === "expense");
  $("row-person").hidden = !(t === "udhar" || t === "held");
  $("row-to").hidden = t !== "transfer";
  $("sub-tabs").hidden = t !== "udhar" && t !== "held";
  if (t === "udhar") {
    chips("sub-tabs", ["Udhar diya", "Udhar wapas mila"], formState.sub === "lent" ? "Udhar diya" : "Udhar wapas mila", "_dummy");
    [...$("sub-tabs").children].forEach((b, i) => b.onclick = () => { formState.sub = i === 0 ? "lent" : "repaid"; renderForm() });
    $("person-label").textContent = formState.sub === "lent" ? "Kis ko diya?" : "Kisne wapas diya?";
  } else if (t === "held") {
    chips("sub-tabs", ["Kisi ke liye rakha", "Wapas de diya"], formState.sub === "hold" ? "Kisi ke liye rakha" : "Wapas de diya", "_dummy");
    [...$("sub-tabs").children].forEach((b, i) => b.onclick = () => { formState.sub = i === 0 ? "hold" : "returned"; renderForm() });
    $("person-label").textContent = formState.sub === "hold" ? "Kiske paise?" : "Kisko wapas diye?";
  }
  if (t === "income" || t === "expense") chips("category-chips", t === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES, formState.category, "category");
  chips("account-chips", ACCOUNTS, formState.account, "account");
  if (t === "transfer") chips("to-chips", ACCOUNTS, formState.to, "to");
  $("f-person").value = formState.person || "";
  $("f-date").value = formState.date || today();
  $("date-text").textContent = formState.date && formState.date !== today() ? new Date(formState.date + "T12:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Aaj";
}
function openSheet(id = null) {
  editingId = id;
  const e = id ? entries.find(x => x.id === id) : null;
  formState = e ? { ...e } : { type: "income", sub: "lent", category: INCOME_CATEGORIES[0], account: ACCOUNTS[0], to: ACCOUNTS[1], date: today(), person: "" };
  $("sheet-title").textContent = e ? "Entry edit karo" : "Nayi entry";
  $("f-amount").value = e ? e.amount : ""; $("f-note").value = e ? e.note || "" : "";
  renderForm(); $("backdrop").hidden = false; $("sheet").hidden = false;
}
function closeSheet() { $("backdrop").hidden = true; $("sheet").hidden = true; editingId = null }
$("fab").onclick = () => openSheet(); $("sheet-close").onclick = closeSheet; $("backdrop").onclick = closeSheet;
$("date-toggle").onclick = () => { $("f-date").hidden = !$("f-date").hidden; if (!$("f-date").hidden) $("f-date").focus() };
$("f-date").onchange = () => { formState.date = $("f-date").value; renderForm() };
$("entry-form").onsubmit = async e => {
  e.preventDefault();
  const amount = Number($("f-amount").value.replace(/,/g, ""));
  if (!amount || amount <= 0) { $("form-error").textContent = "Valid amount likho."; return }
  const data = { ...formState, amount, date: $("f-date").value || today(), note: $("f-note").value.trim(), person: $("f-person").value.trim() };
  delete data._dummy;
  if (data.type === "transfer" && data.account === data.to) { $("form-error").textContent = "Dono accounts alag hone chahiye."; return }
  try {
    if (editingId) await updateEntryInFirebase(editingId, data); else await addEntryToFirebase(data);
    closeSheet(); toast(editingId ? "Entry update ho gayi" : "Entry save ho gayi");
  } catch (error) {
    console.error("Firebase save failed:", error);
    $("form-error").textContent = "Entry save nahi ho payi.";
  }
};
function signedBalanceForAccount(account) {
  return entries.reduce((sum, e) => {
    if (e.type === "income" && e.account === account) return sum + e.amount;
    if (e.type === "expense" && e.account === account) return sum - e.amount;
    if (e.type === "udhar") {
      if (e.account === account) return sum + (e.sub === "repaid" ? e.amount : -e.amount);
    }
    if (e.type === "held") {
      if (e.account === account) return sum + (e.sub === "returned" ? e.amount : -e.amount);
    }
    if (e.type === "transfer") {
      if (e.account === account) return sum - e.amount;
      if (e.to === account) return sum + e.amount;
    }
    return sum;
  }, 0);
}
function accountIcon(account) {
  if (account === "Charu's Google account") return `<div class="account-icon google-charu">🟣</div>`;
  if (account === "My Google account") return `<div class="account-icon google-me">🔵</div>`;
  if (account === "Cash") return `<div class="account-icon">💵</div>`;
  if (account === "Gullak 1 (college fee)") return `<div class="account-icon">▯</div>`;
  if (account === "Gullak 2 (saving)") return `<div class="account-icon">🐷</div>`;
  if (account === "Crochet income") return `<div class="account-icon">🧶</div>`;
  return `<div class="account-icon">💰</div>`;
}
function accountDisplayName(account) {
  if (account === "Charu's Google account") return "Charu's Google";
  if (account === "My Google account") return "My Google";
  if (account === "Gullak 1 (college fee)") return "Gullak 1";
  if (account === "Gullak 2 (saving)") return "Gullak 2";
  return account;
}
function renderAccounts() {
  $("accounts").innerHTML = ACCOUNTS.map(a => `
    <div class="account-card">
      ${accountIcon(a)}
      <div class="account-info">
        <div class="account-name">${accountDisplayName(a)}</div>
        <strong class="account-amount">${money(signedBalanceForAccount(a))}</strong>
      </div>
    </div>
  `).join("");
}
function renderDashboard() {
  const balances = ACCOUNTS.reduce((s, a) => s + signedBalanceForAccount(a), 0);
  $("total-balance").textContent = money(balances);
  const mk = monthKey(today()), m = entries.filter(e => monthKey(e.date) === mk);
  const inc = m.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const exp = m.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  $("month-income").textContent = money(inc); $("month-expense").textContent = money(exp);
  $("month-name").textContent = monthLabel(mk);
}
function renderLoans() {
  let lena = 0, dena = 0, held = 0; const people = {};
  entries.forEach(e => {
    if (e.type === "udhar") { const delta = e.sub === "lent" ? e.amount : -e.amount; if (e.sub === "lent") lena += e.amount; else dena += e.amount; people[e.person || "Unknown"] = (people[e.person || "Unknown"] || 0) + delta }
    if (e.type === "held") held += e.sub === "hold" ? e.amount : -e.amount;
  });
  $("udhar-lena").textContent = money(lena); $("udhar-lena-detail").textContent = money(lena); $("udhar-dena").textContent = money(dena); $("held-total").textContent = money(held);
  $("udhar-list").innerHTML = Object.entries(people).filter(([, v]) => v !== 0).map(([p, v]) => `<li class="person-row"><div><b>${p}</b><div class="person-meta">${v > 0 ? "Mujhe lena hai" : "Mujhe dena hai"}</div></div><strong class="${v > 0 ? "positive" : "negative"}">${money(Math.abs(v))}</strong></li>`).join("") || `<li class="muted">Abhi koi udhar nahi.</li>`;
  const hp = {}; entries.filter(e => e.type === "held").forEach(e => hp[e.person || "Unknown"] = (hp[e.person || "Unknown"] || 0) + (e.sub === "hold" ? e.amount : -e.amount));
  $("held-list").innerHTML = Object.entries(hp).filter(([, v]) => v !== 0).map(([p, v]) => `<li class="person-row"><div><b>${p}</b></div><strong>${money(v)}</strong></li>`).join("") || `<li class="muted">Abhi kisi aur ke paise nahi.</li>`;
}
function entryTitle(e) {
  if (e.type === "transfer") return `Transfer → ${e.to}`;
  if (e.type === "udhar") return e.sub === "lent" ? `Udhar diya · ${e.person || "Unknown"}` : `Udhar wapas · ${e.person || "Unknown"}`;
  if (e.type === "held") return e.sub === "hold" ? `Held for · ${e.person || "Unknown"}` : `Held returned · ${e.person || "Unknown"}`;
  return e.category;
}
function renderEntries() {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 20);
  $("entries").innerHTML = sorted.map(e => {
    const sign = e.type === "expense" || e.type === "udhar" && e.sub === "lent" || e.type === "held" && e.sub === "hold" ? "-" : "+";
    const cls = sign === "-" ? "negative" : "positive";
    return `<li class="entry-row"><div><div class="entry-title">${entryTitle(e)}</div><div class="entry-meta">${e.date} · ${e.account}${e.note ? " · " + e.note : ""}</div></div><div style="text-align:right"><strong class="${cls}">${sign}${money(e.amount)}</strong><div class="entry-actions"><button class="small-btn" data-edit="${e.id}">Edit</button><button class="small-btn" data-delete="${e.id}">Delete</button></div></div></li>`;
  }).join("") || `<li class="muted">Abhi koi entry nahi hai.</li>`;
  $("entries").querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openSheet(b.dataset.edit));
  $("entries").querySelectorAll("[data-delete]").forEach(b => b.onclick = async () => {
    if (confirm("Ye entry delete karni hai?")) {
      try { await deleteEntryFromFirebase(b.dataset.delete); toast("Entry delete ho gayi") }
      catch (error) { console.error("Firebase delete failed:", error); toast("Entry delete nahi ho payi.") }
    }
  });
}
function monthlyData() {
  const map = {}; entries.forEach(e => {
    const k = monthKey(e.date); if (!map[k]) map[k] = { income: 0, expense: 0, udharLent: 0, udharRepaid: 0, held: 0, heldReturned: 0, cats: {}, items: [] }; const m = map[k]; m.items.push(e);
    if (e.type === "income") m.income += e.amount;
    if (e.type === "expense") { m.expense += e.amount; m.cats[e.category] = (m.cats[e.category] || 0) + e.amount }
    if (e.type === "udhar") e.sub === "lent" ? m.udharLent += e.amount : m.udharRepaid += e.amount;
    if (e.type === "held") e.sub === "hold" ? m.held += e.amount : m.heldReturned += e.amount;
  }); return map;
}
function renderMonthly() {
  const data = monthlyData(), keys = Object.keys(data).sort().reverse();
  $("monthly-breakdown").innerHTML = keys.map(k => { const m = data[k], net = m.income - m.expense; return `<div class="month-row-item" data-month="${k}"><div><b>${monthLabel(k)}</b><div class="month-stats"><span>Income ${money(m.income)}</span><span>Expense ${money(m.expense)}</span></div></div><strong class="${net >= 0 ? "positive" : "negative"}">${net >= 0 ? "+" : ""}${money(net)}</strong></div>` }).join("") || `<p class="muted">Entries add karoge to monthly history yahan dikhegi.</p>`;
  document.querySelectorAll("[data-month]").forEach(x => x.onclick = () => openMonth(x.dataset.month));
}
function openMonth(k) {
  const m = monthlyData()[k]; if (!m) return;
  const cats = Object.entries(m.cats).sort((a, b) => b[1] - a[1]);
  const items = [...m.items].sort((a, b) => b.date.localeCompare(a.date));
  $("month-modal-title").textContent = monthLabel(k);
  $("month-modal-content").innerHTML = `<div class="detail-summary"><div class="detail-box"><small>Income</small><strong class="positive">${money(m.income)}</strong></div><div class="detail-box"><small>Expense</small><strong class="negative">${money(m.expense)}</strong></div><div class="detail-box"><small>Net</small><strong>${money(m.income - m.expense)}</strong></div></div>
  <div class="card"><h2>Category breakdown</h2>${cats.map(([c, v]) => `<div class="category-line"><span>${c}</span><b>${money(v)}</b></div>`).join("") || `<p class="muted">No expense category.</p>`}</div>
  <div class="card"><h2>Udhar &amp; Held</h2><div class="category-line"><span>Udhar diya</span><b>${money(m.udharLent)}</b></div><div class="category-line"><span>Udhar wapas mila</span><b>${money(m.udharRepaid)}</b></div><div class="category-line"><span>Held for others</span><b>${money(m.held)}</b></div><div class="category-line"><span>Held returned</span><b>${money(m.heldReturned)}</b></div></div>
  <div class="card"><h2>All transactions</h2>${items.map(e => `<div class="category-line"><span>${e.date} · ${entryTitle(e)}</span><b>${money(e.amount)}</b></div>`).join("")}</div>`;
  $("month-modal").hidden = false;
}
$("month-modal-close").onclick = () => $("month-modal").hidden = true; $("all-months-btn").onclick = () => { const keys = Object.keys(monthlyData()).sort().reverse(); if (keys[0]) openMonth(keys[0]); else toast("Pehle entry add karo") };
function renderAll() { renderDashboard(); renderAccounts(); renderLoans(); renderEntries(); renderMonthly() }
function toast(msg) { $("toast").textContent = msg; $("toast").hidden = false; setTimeout(() => $("toast").hidden = true, 1800) }
showLock();