import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDTPc2pfOydy70qyo2puhxkSpwMWOedK0",
  authDomain: "hisaab-6cd58.firebaseapp.com",
  projectId: "hisaab-6cd58",
  storageBucket: "hisaab-6cd58.firebasestorage.app",
  messagingSenderId: "569723713348",
  appId: "1:569723713348:web:b27bf4457a4f5fdf39c911"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const entriesRef = collection(db, "entries");

const ACCOUNTS = [
  "Charu GPay",
  "Jiya GPay",
  "Cash",
  "Gullak 1 (college fee)",
  "Gullak 2 (saving)",
  "Crochet income"
];

const INCOME_CATEGORIES = [
  "Tuition",
  "Crochet",
  "Mehendi",
  "Gift / Family / Relative",
  "Unknown"
];

const EXPENSE_CATEGORIES = [
  "Essential",
  "Personal",
  "Stationary",
  "Phone recharge",
  "Junk",
  "Maggie",
  "Shopping",
  "Bus pass recharge",
  "Transport",
  "Crochet saman",
  "Mandir saman",
  "Ghar ka saman",
  "Gift/Friends/Relative",
  "Unkown"
];

const TYPES = [
  ["income", "Income"],
  ["expense", "Expense"],
  ["udhar", "Udhar"],
  ["held", "Held for Others"],
  ["transfer", "Transfer"]
];

const $ = id => document.getElementById(id);

const money = n =>
  "₹" + Number(n || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2
  });

function categoryColor(name) {
  const colors = [
    "#F8DCE5",
    "#D8EBFA",
    "#D9F0E2",
    "#FBE4D5",
    "#E8DDF8",
    "#F5EDC9",
    "#D9E9E8",
    "#E7E2D8",
    "#E2E5FA",
    "#F3DFCE"
  ];

  let hash = 0;

  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

const today = () => {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const monthKey = date => String(date || "").slice(0, 7);

const monthLabel = key => {
  if (!key) return "";

  const [y, m] = key.split("-").map(Number);

  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  });
};

function formatDateDisplay(isoDate) {
  if (!isoDate) return "";

  const [year, month, day] = isoDate.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function makeISODate(year, month, day) {
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const d = new Date(year, month - 1, day);

  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseFlexibleDate(value) {
  const input = String(value || "").trim();

  if (!input) return null;

  let match = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (match) {
    return makeISODate(+match[1], +match[2], +match[3]);
  }

  // Accepts DD/MM/YYYY and DD-MM-YYYY
  match = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (match) {
    return makeISODate(+match[3], +match[2], +match[1]);
  }

  // Accepts dates like 3 Oct or 3 Oct 2026
  match = input.match(/^(\d{1,2})[\s/-]+([a-zA-Z]+)(?:[\s,/-]+(\d{4}))?$/);

  if (!match) return null;

  const months = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec"
  ];

  const month =
    months.findIndex(m => m === match[2].toLowerCase().slice(0, 3)) + 1;

  return month
    ? makeISODate(+(match[3] || new Date().getFullYear()), month, +match[1])
    : null;
}

let entries = [];
let unsubscribe = null;

let selectedType = "income";
let selectedSub = "lent";
let selectedAccount = ACCOUNTS[0];
let selectedToAccount = ACCOUNTS[1];
let selectedCategory = INCOME_CATEGORIES[0];
let editingId = null;

let bulkItems = [];
let bulkIdCounter = 0;

function toast(message) {
  const el = $("toast");

  if (!el) return;

  el.textContent = message;
  el.hidden = false;

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    el.hidden = true;
  }, 2600);
}

// PIN lock removed. The app opens directly and starts Firebase sync.
function showApp() {
  if ($("app")) $("app").hidden = false;
  if ($("fab")) $("fab").hidden = false;
  if ($("bulk-entry-btn")) $("bulk-entry-btn").hidden = false;

  startSync();
}

function startSync() {
  if (unsubscribe) return;

  unsubscribe = onSnapshot(
    entriesRef,
    snapshot => {
      entries = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      renderAll();
    },
    error => {
      console.error("Firebase sync error:", error);
      toast("Firebase sync failed. Check Firestore rules.");
    }
  );
}

// FIXED: personal account balance par har entry ka asar.
function signedAmount(e) {
  const amount = Number(e.amount || 0);

  if (e.type === "income") return amount;
  if (e.type === "expense") return -amount;

  if (e.type === "udhar") {
    return e.subType === "repaid" ? amount : -amount;
  }

  if (e.type === "held") {
    // held     -> sirf doosre ka paisa record hota hai, personal balance same
    // used     -> sirf held balance kam hota hai, personal balance same
    //            (expense ne personal balance pehle hi ghata diya hai)
    // restored -> personal balance se paise nikal kar held balance mein wapas jaate hain
    // returned -> paise account se bahar jaate hain, personal balance same
    if (e.subType === "restored") return -amount;
    return 0;
  }

  return 0;
}

function heldBalanceForPerson(person, account = null) {
  return entries
    .filter(e =>
      e.type === "held" &&
      e.person === person &&
      (!account || e.account === account)
    )
    .reduce((sum, e) => {
      const amount = Number(e.amount || 0);

      if (e.subType === "held") return sum + amount;
      if (e.subType === "used") return sum - amount;
      if (e.subType === "restored") return sum + amount;
      if (e.subType === "returned") return sum - amount;

      return sum;
    }, 0);
}

function heldShortfallForPerson(person, account = null) {
  const relevantEntries = entries.filter(e =>
    e.type === "held" &&
    e.person === person &&
    (!account || e.account === account)
  );

  const used = relevantEntries
    .filter(e => e.subType === "used")
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const restored = relevantEntries
    .filter(e => e.subType === "restored")
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return Math.max(0, used - restored);
}

function renderAccounts() {
  const container = $("accounts");
  if (!container) return;

  container.innerHTML = "";

  ACCOUNTS.forEach((account, i) => {
    const card = document.createElement("div");
    card.className = "account-card";

    const icon = document.createElement("div");
    icon.className = "account-icon";
    icon.textContent = ["C", "J", "₹", "1", "2", "🧶"][i];

    const info = document.createElement("div");
    info.className = "account-info";

    const name = document.createElement("div");
    name.className = "account-name";
    name.textContent = account;

    const balance = document.createElement("strong");
    balance.className = "account-amount";
    balance.textContent = money(accountBalance(account));

    info.append(name, balance);

    // Is account mein doosron ki savings alag dikhana
    const people = [
      ...new Set(
        entries
          .filter(e =>
            e.type === "held" &&
            e.account === account &&
            e.person
          )
          .map(e => e.person)
      )
    ];

    people.forEach(person => {
      const heldAmount = heldBalanceForPerson(person, account);
      const shortfall = heldShortfallForPerson(person, account);

      const row = document.createElement("div");
      row.className = "held-account-row";

      const personName = document.createElement("span");
      personName.textContent = shortfall > 0
        ? `${person} (${money(shortfall)} used)`
        : person;

      const personBalance = document.createElement("strong");
      personBalance.textContent = money(heldAmount);

      if (shortfall > 0) {
        personBalance.style.color = "#dc2626";
        personName.style.color = "#dc2626";
      }

      row.append(personName, personBalance);
      info.appendChild(row);
    });

    card.append(icon, info);
    container.appendChild(card);
  });
}

function accountBalance(account) {
  return entries.reduce((total, e) => {
    if (e.type === "transfer") {
      // Old entries mein source account `account` mein ho sakta hai.
      const fromAccount = e.fromAccount || e.account;

      if (fromAccount === account) {
        total -= Number(e.amount || 0);
      }

      if (e.toAccount === account) {
        total += Number(e.amount || 0);
      }

      return total;
    }

    if (e.account === account) {
      total += signedAmount(e);
    }

    return total;
  }, 0);
}

function renderSummary() {
  const key = today().slice(0, 7);
  const list = entries.filter(e => monthKey(e.date) === key);

  const income = list
    .filter(e => e.type === "income")
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  const expense = list
    .filter(e => e.type === "expense")
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  const total = ACCOUNTS.reduce(
    (sum, account) => sum + Math.max(0, accountBalance(account)),
    0
  );

  if ($("total-balance")) $("total-balance").textContent = money(total);

  if ($("total-sub")) {
    $("total-sub").textContent = `${ACCOUNTS.length} accounts · ${monthLabel(key)}`;
  }

  if ($("month-income")) $("month-income").textContent = money(income);
  if ($("month-expense")) $("month-expense").textContent = money(expense);
  if ($("month-name")) $("month-name").textContent = monthLabel(key);
}

function renderOtherMoney() {
  const lent = entries
    .filter(e => e.type === "udhar" && e.subType === "lent")
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  const repaid = entries
    .filter(e => e.type === "udhar" && e.subType === "repaid")
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  // FIXED: sirf "held" aur "returned" gine jaayenge.
  // "used" / "restored" sirf andar ki movement hai, total dena-paisa nahi badalta.
  const held = entries
    .filter(e => e.type === "held" && e.subType === "held")
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  const returned = entries
    .filter(e => e.type === "held" && e.subType === "returned")
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  if ($("udhar-lena")) {
    $("udhar-lena").textContent = money(Math.max(0, lent - repaid));
  }

  if ($("udhar-lena-detail")) {
    $("udhar-lena-detail").textContent = money(Math.max(0, lent - repaid));
  }

  if ($("udhar-dena")) $("udhar-dena").textContent = money(repaid);

  if ($("held-total")) {
    $("held-total").textContent = money(Math.max(0, held - returned));
  }

  const ul = $("udhar-list");

  if (ul) {
    ul.innerHTML = "";

    entries.filter(e => e.type === "udhar").forEach(e => {
      const li = document.createElement("li");

      li.textContent =
        `${e.person || "Unknown"} · ${e.subType === "repaid" ? "Wapas mila" : "Udhar diya"} · ${money(e.amount)}`;

      ul.appendChild(li);
    });

    if (!ul.children.length) {
      ul.textContent = "No udhar entries yet.";
    }
  }

  const hl = $("held-list");

  if (hl) {
    hl.innerHTML = "";

    const heldLabels = {
      held: "Held",
      used: "Used",
      restored: "Restored",
      returned: "Returned"
    };

    entries.filter(e => e.type === "held").forEach(e => {
      const li = document.createElement("li");

      li.textContent =
        `${e.person || "Unknown"} · ${heldLabels[e.subType] || "Held"} · ${money(e.amount)}`;

      hl.appendChild(li);
    });

    if (!hl.children.length) {
      hl.textContent = "No held money yet.";
    }
  }
}

function renderEntries() {
  const container = $("entries");

  if (!container) return;

  container.innerHTML = "";

  const sorted = [...entries].sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || ""))
  );

  if (!sorted.length) {
    container.textContent = "No entries yet. Tap + to add your first entry.";
    return;
  }

  sorted.slice(0, 100).forEach(e => {
    const row = document.createElement("li");
    row.className = "entry-row";

    const main = document.createElement("div");

    const title = document.createElement("div");
    title.className = "entry-title";
    title.textContent =
      e.category ||
      (e.type === "transfer"
        ? "Transfer"
        : e.type === "udhar"
          ? "Udhar"
          : e.type === "held"
            ? "Held for Others"
            : e.type);

    const detail = document.createElement("div");
    detail.className = "entry-meta";
    detail.textContent = [
      e.person,
      e.account,
      e.date ? formatDateDisplay(e.date) : "",
      e.note
    ].filter(Boolean).join(" · ");

    main.append(title, detail);

    const right = document.createElement("div");
    right.style.textAlign = "right";

    const amount = document.createElement("strong");

    amount.textContent =
      `${e.type === "income" ? "+" : e.type === "expense" ? "−" : ""}${money(e.amount)}`;

    amount.className =
      e.type === "income" ? "positive" :
        e.type === "expense" ? "negative" : "";

    right.appendChild(amount);

    const actions = document.createElement("div");
    actions.className = "entry-actions";

    const edit = document.createElement("button");
    edit.className = "small-btn";
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => openForm(e));

    const del = document.createElement("button");
    del.className = "small-btn";
    del.type = "button";
    del.textContent = "Delete";
    del.addEventListener("click", () => removeEntry(e.id));

    actions.append(edit, del);
    right.appendChild(actions);

    row.append(main, right);
    container.appendChild(row);
  });
}

function renderMonthlyBreakdown() {
  const container = $("monthly-breakdown");

  if (!container) return;

  const key = today().slice(0, 7);
  const list = entries.filter(e => monthKey(e.date) === key);

  const income = list
    .filter(e => e.type === "income")
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  const expense = list
    .filter(e => e.type === "expense")
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  container.innerHTML = `
    <div class="section-head">
      <h2>Monthly breakdown</h2>
      <button class="text-btn" id="all-months-btn" type="button">History</button>
    </div>
    <p>${monthLabel(key)} · Income ${money(income)} · Expense ${money(expense)}</p>
  `;

  $("all-months-btn")?.addEventListener("click", openMonthHistory);
}

function openMonthHistory() {
  const modal = $("month-modal");
  const content = $("month-modal-content");

  if (!modal || !content) return;

  if ($("month-modal-title")) {
    $("month-modal-title").textContent = "Monthly history";
  }

  content.innerHTML = "";

  const months = [
    ...new Set(entries.map(e => monthKey(e.date)).filter(Boolean))
  ].sort().reverse();

  if (!months.length) {
    content.textContent = "No monthly history yet.";
  }

  months.forEach(key => {
    const list = entries.filter(e => monthKey(e.date) === key);

    const incomeItems = list.filter(e => e.type === "income");
    const expenseItems = list.filter(e => e.type === "expense");

    const income = incomeItems.reduce(
      (s, e) => s + Number(e.amount || 0), 0
    );

    const expense = expenseItems.reduce(
      (s, e) => s + Number(e.amount || 0), 0
    );

    const section = document.createElement("section");
    section.style.cssText = "padding:14px 0;border-bottom:1px solid #E8E3ED";

    const heading = document.createElement("h3");
    heading.textContent = monthLabel(key);
    section.appendChild(heading);

    const summary = document.createElement("p");
    summary.textContent =
      `Income ${money(income)} · Expense ${money(expense)} · Difference ${money(income - expense)}`;

    section.appendChild(summary);

    const totals = items => items.reduce((acc, e) => {
      const name = e.category || "Other";
      acc[name] = (acc[name] || 0) + Number(e.amount || 0);
      return acc;
    }, {});

    [
      ["Income by category", totals(incomeItems)],
      ["Expense by category", totals(expenseItems)]
    ].forEach(([title, obj]) => {
      if (!Object.keys(obj).length) return;

      const h = document.createElement("h4");
      h.textContent = title;
      section.appendChild(h);

      Object.keys(obj).sort().forEach(name => {
        const line = document.createElement("div");
        line.className = "category-line";
        line.style.setProperty("--category-bg", categoryColor(name));

        const label = document.createElement("span");
        label.textContent = name;

        const amount = document.createElement("strong");
        amount.textContent = money(obj[name]);

        line.append(label, amount);
        section.appendChild(line);
      });
    });

    content.appendChild(section);
  });

  modal.hidden = false;
}

function renderAll() {
  renderSummary();
  renderAccounts();
  renderOtherMoney();
  renderEntries();
  renderMonthlyBreakdown();
}

function closeForm() {
  if ($("backdrop")) $("backdrop").hidden = true;
  if ($("sheet")) $("sheet").hidden = true;
}

function openForm(entry = null) {
  editingId = entry?.id || null;
  selectedType = entry?.type || "income";
  selectedSub = entry?.subType || "lent";
  selectedAccount = entry?.account || ACCOUNTS[0];
  selectedToAccount = entry?.toAccount || entry?.to || ACCOUNTS[1];

  selectedCategory =
    entry?.category ||
    (selectedType === "expense" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);

  if ($("sheet-title")) {
    $("sheet-title").textContent = entry ? "Edit entry" : "Add entry";
  }

  $("f-amount").value = entry?.amount ?? "";
  $("f-person").value = entry?.person || "";
  $("f-note").value = entry?.note || "";

  const date = entry?.date || today();

  $("f-date").value = date;

  if ($("f-date-text")) {
    $("f-date-text").value = formatDateDisplay(date);
  }

  $("form-error").textContent = "";

  $("backdrop").hidden = false;
  $("sheet").hidden = false;

  renderFormOptions();
}

function renderFormOptions() {
  $("type-tabs").innerHTML = "";

  TYPES.forEach(([value, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.classList.toggle("active", selectedType === value);

    b.addEventListener("click", () => {
      selectedType = value;

      if (value === "expense") {
        selectedCategory = EXPENSE_CATEGORIES[0];
      } else if (value === "income") {
        selectedCategory = INCOME_CATEGORIES[0];
      }

      renderFormOptions();
    });

    $("type-tabs").appendChild(b);
  });

  const subs =
    selectedType === "udhar"
      ? [["lent", "Udhar diya"], ["repaid", "Wapas mila"]]
      : selectedType === "held"
        ? [
          ["held", "Received / Saving"],
          ["used", "Used"],
          ["restored", "Restored"],
          ["returned", "Returned"]
        ]
        : [];

  $("sub-tabs").innerHTML = "";
  $("sub-tabs").hidden = !subs.length;

  subs.forEach(([value, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.classList.toggle("active", selectedSub === value);

    b.addEventListener("click", () => {
      selectedSub = value;
      renderFormOptions();
    });

    $("sub-tabs").appendChild(b);
  });

  $("row-category").hidden = !["income", "expense"].includes(selectedType);
  $("row-person").hidden = !["udhar", "held"].includes(selectedType);
  $("row-to").hidden = selectedType !== "transfer";

  const cats =
    selectedType === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  $("category-chips").innerHTML = "";

  cats.forEach(category => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = category;
    b.classList.toggle("active", selectedCategory === category);

    b.addEventListener("click", () => {
      selectedCategory = category;
      renderFormOptions();
    });

    $("category-chips").appendChild(b);
  });

  $("account-chips").innerHTML = "";

  ACCOUNTS.forEach(account => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = account;
    b.classList.toggle("active", selectedAccount === account);

    b.addEventListener("click", () => {
      selectedAccount = account;

      if (selectedToAccount === account) {
        selectedToAccount = ACCOUNTS.find(a => a !== account);
      }

      renderFormOptions();
    });

    $("account-chips").appendChild(b);
  });

  $("to-chips").innerHTML = "";

  ACCOUNTS.filter(a => a !== selectedAccount).forEach(account => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = account;
    b.classList.toggle("active", selectedToAccount === account);

    b.addEventListener("click", () => {
      selectedToAccount = account;
      renderFormOptions();
    });

    $("to-chips").appendChild(b);
  });
}


async function saveEntry(event) {
  event.preventDefault();

  const amount = Number($("f-amount").value);
  const date = parseFlexibleDate(
    $("f-date-text")?.value || $("f-date").value
  );
  const error = $("form-error");

  error.textContent = "";

  if (!Number.isFinite(amount) || amount <= 0) {
    error.textContent = "Please enter an amount greater than zero.";
    return;
  }

  if (!date) {
    error.textContent = "Valid date likho, jaise 3 Oct ya 3 Oct 2026.";
    return;
  }

  if (
    selectedType === "transfer" &&
    selectedToAccount === selectedAccount
  ) {
    error.textContent = "Choose a different destination account.";
    return;
  }

  // Restore ki rakam use hue paise se zyada nahi honi chahiye.
  if (selectedType === "held" && selectedSub === "restored" && !editingId) {
    const person = $("f-person").value.trim();
    const shortfall = heldShortfallForPerson(person, selectedAccount);

    if (amount > shortfall) {
      error.textContent =
        shortfall > 0
          ? `${person} ke sirf ${money(shortfall)} use hue hain. Utna hi restore kar sakti ho.`
          : `${person} ke koi paise use nahi hue, restore ki zaroorat nahi.`;
      return;
    }
  }

  const now = new Date().toISOString();

  const entry = {
    type: selectedType,
    amount,
    date,
    account: selectedAccount,
    note: $("f-note").value.trim(),
    updatedAt: now
  };

  if (["income", "expense"].includes(selectedType)) {
    entry.category = selectedCategory;
  }

  if (["udhar", "held"].includes(selectedType)) {
    entry.subType = selectedSub;
    entry.person = $("f-person").value.trim();

    if (!entry.person) {
      error.textContent = "Please enter the person's name.";
      return;
    }
  }

  if (selectedType === "transfer") {
    entry.fromAccount = selectedAccount;
    entry.toAccount = selectedToAccount;
  }

  let usedEntry = null;

  // Automatically calculate how much held money the expense uses.
<<<<<<< HEAD
  // Agar kisi ke held paise is account mein hain aur poora shortfall cover kar sakte hain,
  // toh automatically "Used" entry banegi. Warna expense normal save hoga
  // aur account balance minus mein ja sakta hai.
=======
>>>>>>> a5c5cfe82b5b56b29d3169b074618d66ed94b8e1
  if (selectedType === "expense" && !editingId) {
    const personalBalance = accountBalance(selectedAccount);
    const shortfall = Math.max(
      0,
      amount - Math.max(0, personalBalance)
    );

    if (shortfall > 0) {
      const people = [
        ...new Set(
          entries
            .filter(e =>
              e.type === "held" &&
              e.account === selectedAccount &&
              e.person
            )
            .map(e => e.person)
        )
      ].filter(person =>
        heldBalanceForPerson(person, selectedAccount) >= shortfall
      );
<<<<<<< HEAD

      if (people.length > 0) {
        let person;

        if (people.length === 1) {
          person = people[0];
        } else {
          const choice = prompt(
            `Personal balance: ${money(personalBalance)}\n` +
            `Expense: ${money(amount)}\n` +
            `Held savings needed: ${money(shortfall)}\n\n` +
            people.map((p, i) =>
              `${i + 1}. ${p} — ` +
              `${money(heldBalanceForPerson(p, selectedAccount))}`
            ).join("\n") +
            "\n\nEnter the number of the person's savings to use:"
          );

          if (choice === null) return;

          person = people[Number(choice) - 1];

          if (!person) {
            error.textContent = "Invalid choice. Entry was not saved.";
            return;
          }
        }

        usedEntry = {
          type: "held",
          subType: "used",
          amount: shortfall,
          date,
          account: selectedAccount,
          person,
          note: `Automatically used for expense: ${entry.note || entry.category || "Expense"}`,
          createdAt: now,
          updatedAt: now
        };
      }
      // people.length === 0 -> koi error nahi, expense normal save hoga (balance minus ho sakta hai)
=======

      if (people.length === 0) {
        error.textContent =
          `Personal balance is insufficient. ${money(shortfall)} ` +
          "is needed from held savings, but no single person's " +
          "available savings can cover the full amount.";
        return;
      }

      let person;

      if (people.length === 1) {
        person = people[0];
      } else {
        const choice = prompt(
          `Personal balance: ${money(personalBalance)}\n` +
          `Expense: ${money(amount)}\n` +
          `Held savings needed: ${money(shortfall)}\n\n` +
          people.map((p, i) =>
            `${i + 1}. ${p} — ` +
            `${money(heldBalanceForPerson(p, selectedAccount))}`
          ).join("\n") +
          "\n\nEnter the number of the person's savings to use:"
        );

        if (choice === null) return;

        person = people[Number(choice) - 1];

        if (!person) {
          error.textContent = "Invalid choice. Entry was not saved.";
          return;
        }
      }

      usedEntry = {
        type: "held",
        subType: "used",
        amount: shortfall,
        date,
        account: selectedAccount,
        person,
        note: `Automatically used for expense: ${entry.note || entry.category || "Expense"
          }`,
        createdAt: now,
        updatedAt: now
      };
>>>>>>> a5c5cfe82b5b56b29d3169b074618d66ed94b8e1
    }
  }

  try {
    if (editingId) {
      // Editing an existing expense does not create another Used entry.
      await updateDoc(doc(db, "entries", editingId), entry);
    } else {
      const batch = writeBatch(db);

      const entryRef = doc(entriesRef);

      batch.set(entryRef, {
        ...entry,
        createdAt: now
      });

      if (usedEntry) {
        const usedRef = doc(entriesRef);
        batch.set(usedRef, usedEntry);
      }

      // Expense and its Used entry save together.
      await batch.commit();
    }

    closeForm();
    toast(editingId ? "Entry updated" : "Entry saved");
  } catch (err) {
    console.error("Save entry failed:", err);
    error.textContent =
      "Could not save. Check Firebase connection and Firestore rules.";
  }
}


async function removeEntry(id) {
  if (!confirm("Delete this entry permanently?")) return;

  try {
    await deleteDoc(doc(db, "entries", id));
    toast("Entry deleted");
  } catch (err) {
    console.error(err);
    toast("Could not delete entry.");
  }
}

/* ROW-BASED BULK ENTRY */

function newBulkItem() {
  return {
    id: ++bulkIdCounter,
    date: today(),
    type: "income",
    category: INCOME_CATEGORIES[0],
    account: ACCOUNTS[0],
    toAccount: ACCOUNTS[1],
    subType: "lent",
    person: "",
    amount: "",
    note: ""
  };
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function bulkChoice(item, field, options, selected, label, display = x => x) {
  return `<div class="bulk-field">
    <span class="bulk-label">${esc(label)}</span>
    <div class="bulk-choices">
      ${options.map(option => `
        <button type="button"
          class="bulk-choice ${option === selected ? "active" : ""}"
          data-bulk-id="${item.id}"
          data-bulk-field="${field}"
          data-bulk-value="${esc(option)}">${esc(display(option))}</button>
      `).join("")}
    </div>
  </div>`;
}


function renderBulkRows() {
  const holder = $("bulk-rows");
  if (!holder) return;

  holder.innerHTML = bulkItems.map((item, index) => {
    if (!item.type) item.type = "income";
    if (!item.account) item.account = ACCOUNTS[0];

    if (!item.toAccount || item.toAccount === item.account) {
      item.toAccount = ACCOUNTS.find(a => a !== item.account);
    }

    const showCategory = ["income", "expense"].includes(item.type);
    const showPerson = ["udhar", "held"].includes(item.type);
    const showTransfer = item.type === "transfer";

    const subs = item.type === "udhar"
      ? [["lent", "Udhar diya"], ["repaid", "Wapas mila"]]
      : item.type === "held"
        ? [
          ["held", "Received / Saving"],
          ["used", "Used"],
          ["restored", "Restored"],
          ["returned", "Returned"]
        ]
        : [];

    if (item.type === "udhar" && !["lent", "repaid"].includes(item.subType)) {
      item.subType = "lent";
    }

    if (item.type === "held" &&
      !["held", "used", "restored", "returned"].includes(item.subType)) {
      item.subType = "held";
    }

    return `
      <article class="bulk-row" data-row="${item.id}">
        <div class="bulk-row-head">
          <strong>Entry ${index + 1}</strong>
          <button type="button" class="bulk-remove"
            data-remove-row="${item.id}">Remove ×</button>
        </div>

        <div class="bulk-field">
          <label class="bulk-label">Date</label>
          <input data-bulk-input="date"
            data-bulk-id="${item.id}"
            type="date" value="${esc(item.date)}" required>
        </div>

        <div class="bulk-field">
          <label class="bulk-label">Type</label>
          <select data-bulk-input="type" data-bulk-id="${item.id}">
            ${TYPES.map(([value, label]) => `
              <option value="${value}"
                ${item.type === value ? "selected" : ""}>
                ${esc(label)}
              </option>
            `).join("")}
          </select>
        </div>

        ${showCategory ? `
          <div class="bulk-field">
            <label class="bulk-label">Category</label>
            <input data-bulk-input="category"
              data-bulk-id="${item.id}"
              value="${esc(item.category)}"
              placeholder="${item.type === "income" ? "e.g. Tuition" : "e.g. Khana"}"
              required>
          </div>
        ` : ""}

        ${showPerson ? `
          <div class="bulk-field">
            <label class="bulk-label">Person</label>
            <input data-bulk-input="person"
              data-bulk-id="${item.id}"
              value="${esc(item.person)}"
              placeholder="Person's name"
              required>
          </div>

          <div class="bulk-field">
            <label class="bulk-label">Entry subtype</label>
            <select data-bulk-input="subType" data-bulk-id="${item.id}">
              ${subs.map(([value, label]) => `
                <option value="${value}"
                  ${item.subType === value ? "selected" : ""}>
                  ${esc(label)}
                </option>
              `).join("")}
            </select>
          </div>
        ` : ""}

        <div class="bulk-field">
          <label class="bulk-label">Account</label>
          <select data-bulk-input="account" data-bulk-id="${item.id}">
            ${ACCOUNTS.map(account => `
              <option value="${esc(account)}"
                ${item.account === account ? "selected" : ""}>
                ${esc(account)}
              </option>
            `).join("")}
          </select>
        </div>

        ${showTransfer ? `
          <div class="bulk-field">
            <label class="bulk-label">Transfer to</label>
            <select data-bulk-input="toAccount" data-bulk-id="${item.id}">
              ${ACCOUNTS.filter(a => a !== item.account).map(account => `
                <option value="${esc(account)}"
                  ${item.toAccount === account ? "selected" : ""}>
                  ${esc(account)}
                </option>
              `).join("")}
            </select>
          </div>
        ` : ""}

        <div class="bulk-field">
          <label class="bulk-label">Amount (₹)</label>
          <input data-bulk-input="amount"
            data-bulk-id="${item.id}"
            type="number" min="0.01" step="0.01"
            value="${esc(item.amount)}"
            placeholder="Amount" required>
        </div>

        <div class="bulk-field">
          <label class="bulk-label">Note (optional)</label>
          <input data-bulk-input="note"
            data-bulk-id="${item.id}"
            value="${esc(item.note)}"
            placeholder="Optional note">
        </div>
      </article>
    `;
  }).join("");

  if ($("bulk-count")) {
    $("bulk-count").textContent =
      `${bulkItems.length} ${bulkItems.length === 1 ? "entry" : "entries"}`;
  }
}


function renderBulkPreview() {
  const previewList = document.getElementById("bulk-preview-list");
  if (!previewList) return;

  if (!bulkItems.length) {
    previewList.innerHTML = "<p>No entries added yet.</p>";
    return;
  }

  const sortedItems = [...bulkItems].sort((a, b) => {
    return String(b.date || "").localeCompare(String(a.date || ""));
  });

  previewList.innerHTML = sortedItems.map((item) => {
    const amount = Number(item.amount) || 0;
    const type = item.type || "income";

    const typeLabels = {
      income: "Income",
      expense: "Expense",
      udhar: "Udhar",
      held: "Held",
      transfer: "Transfer"
    };

    const escapeHTML = (value) =>
      String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);

    let details = [
      item.category,
      item.account
    ].filter(Boolean).map(escapeHTML).join(" · ");

    if (type === "transfer" && item.toAccount) {
      details += ` → ${escapeHTML(item.toAccount)}`;
    }

    if ((type === "udhar" || type === "held") && item.person) {
      details += ` · ${escapeHTML(item.person)}`;
    }

    if (item.note) {
      details += ` · ${escapeHTML(item.note)}`;
    }

    return `
      <div class="bulk-preview-item">
        <div class="bulk-preview-top">
          <strong>${escapeHTML(typeLabels[type] || type)}</strong>
          <strong>₹${amount.toLocaleString("en-IN")}</strong>
        </div>

        <div class="bulk-preview-details">
          ${details || "Details not selected"}
        </div>

        <div class="bulk-preview-bottom">
          <span>${escapeHTML(item.date || "No date")}</span>
          <span class="${amount > 0 ? "preview-ready" : "preview-pending"}">
            ${amount > 0 ? "Amount added" : "Amount pending"}
          </span>
        </div>
      </div>
    `;
  }).join("");
}

function openBulkEntry() {
  if ($("bulk-error")) {
    $("bulk-error").textContent = "";
  }

  if ($("bulk-text")) {
    $("bulk-text").value = "";
  }

  if ($("bulk-count")) {
    $("bulk-count").textContent = "0 lines";
  }

  if ($("bulk-modal")) {
    $("bulk-modal").hidden = false;
  }

  $("bulk-text")?.focus();
}

function closeBulkEntry() {
  if ($("bulk-modal")) {
    $("bulk-modal").hidden = true;
  }
}

function setBulkChoice(item, field, value) {
  item[field] = value;

  if (field === "type") {
    if (value === "income" && !INCOME_CATEGORIES.includes(item.category)) {
      item.category = INCOME_CATEGORIES[0];
    }

    if (value === "expense" && !EXPENSE_CATEGORIES.includes(item.category)) {
      item.category = EXPENSE_CATEGORIES[0];
    }

    if (value === "transfer" && item.account === item.toAccount) {
      item.toAccount = ACCOUNTS.find(a => a !== item.account);
    }
  }

  if (field === "account" && item.account === item.toAccount) {
    item.toAccount = ACCOUNTS.find(a => a !== item.account);
  }

  renderBulkRows();
}


async function saveBulkEntries() {
  const errorEl = $("bulk-error");
  const button = $("bulk-save");
  const textArea = $("bulk-text");

  if (!errorEl || !button || !textArea) return;

  errorEl.textContent = "";

  const lines = textArea.value
    .split(/\r?\n/)
    .map((line, index) => ({ text: line.trim(), number: index + 1 }))
    .filter(line => line.text && !line.text.startsWith("#"));

  if (!lines.length) {
    errorEl.textContent = "Pehle entries likho.";
    return;
  }

  if (lines.length > 450) {
    errorEl.textContent = "Ek baar mein maximum 450 entries save karo.";
    return;
  }

  const prepared = [];
  const errors = [];
  const validTypes = ["income", "expense", "udhar", "held", "transfer"];

  for (const line of lines) {
    const parts = line.text.split("|").map(value => value.trim());

    if (parts.length < 5 || parts.length > 6) {
      errors.push(
        `Line ${line.number}: 5 ya 6 fields chahiye — Date | Category | Type | Amount | Account | Note`
      );
      continue;
    }

    const [rawDate, category, rawType, rawAmount, account, note = ""] = parts;
    const type = rawType.toLowerCase();
    const date = parseFlexibleDate(rawDate);
    const amount = Number(rawAmount.replace(/,/g, ""));

    if (!date) {
      errors.push(`Line ${line.number}: Date sahi nahi hai.`);
      continue;
    }

    if (!validTypes.includes(type)) {
      errors.push(
        `Line ${line.number}: Type income, expense, udhar, held ya transfer hona chahiye.`
      );
      continue;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`Line ${line.number}: Amount valid nahi hai.`);
      continue;
    }

    if (!ACCOUNTS.includes(account)) {
      errors.push(
        `Line ${line.number}: Account "${account}" list mein nahi mila.`
      );
      continue;
    }

    if (["income", "expense"].includes(type) && !category) {
      errors.push(`Line ${line.number}: Category enter karo.`);
      continue;
    }

    const now = new Date().toISOString();

    const data = {
      type,
      amount,
      date,
      account,
      note,
      createdAt: now,
      updatedAt: now
    };

    if (["income", "expense"].includes(type)) {
      data.category = category;
    }

    if (type === "transfer") {
      const destination = category;

      if (!ACCOUNTS.includes(destination) || destination === account) {
        errors.push(
          `Line ${line.number}: Transfer ke liye Category field mein valid destination account likho, jo source account se alag ho.`
        );
        continue;
      }

      data.fromAccount = account;
      data.toAccount = destination;
    }

    if (["udhar", "held"].includes(type)) {
      errors.push(
        `Line ${line.number}: ${type} ke liye person aur subtype fields bhi chahiye. Is type ka format next update mein add karenge.`
      );
      continue;
    }

    prepared.push(data);
  }

  if (errors.length) {
    errorEl.textContent = errors.join("\n");
    return;
  }

  if (!prepared.length) {
    errorEl.textContent = "Koi valid entry nahi mili.";
    return;
  }

  button.disabled = true;
  button.textContent = "Saving...";

  try {
    const batch = writeBatch(db);

    prepared.forEach(data => {
      batch.set(doc(entriesRef), data);
    });

    await batch.commit();

    textArea.value = "";
    if ($("bulk-count")) $("bulk-count").textContent = "0 lines";

    closeBulkEntry();
    toast(`${prepared.length} entries saved`);
  } catch (err) {
    console.error("Bulk save failed:", err);
    errorEl.textContent =
      "Save fail hua. Firebase connection/rules check karo. Retry se pehle entries verify kar lena.";
  } finally {
    button.disabled = false;
    button.textContent = "Save All Entries";
  }
}


function showPersonRequired(item) {
  return ["udhar", "held"].includes(item.type);
}

function setupEvents() {
  // Lock button event removed because PIN lock has been removed.

  $("fab")?.addEventListener("click", () => openForm());

  $("sheet-close")?.addEventListener("click", closeForm);
  $("backdrop")?.addEventListener("click", closeForm);

  $("entry-form")?.addEventListener("submit", saveEntry);

  $("date-toggle")?.addEventListener("click", () => {
    const input = $("f-date");

    if (input?.showPicker) {
      input.showPicker();
    } else {
      input?.click();
    }
  });

  $("f-date")?.addEventListener("change", () => {
    if ($("f-date-text") && $("f-date").value) {
      $("f-date-text").value = formatDateDisplay($("f-date").value);
    }
  });

  $("f-date-text")?.addEventListener("blur", () => {
    const parsed = parseFlexibleDate($("f-date-text").value);

    if (parsed) {
      $("f-date").value = parsed;
      $("f-date-text").value = formatDateDisplay(parsed);
    }
  });

  $("month-modal-close")?.addEventListener("click", () => {
    if ($("month-modal")) {
      $("month-modal").hidden = true;
    }
  });

  $("month-modal")?.addEventListener("click", e => {
    if (e.target === $("month-modal")) {
      $("month-modal").hidden = true;
    }
  });

  // Bulk Entry events
  $("bulk-entry-btn")?.addEventListener("click", openBulkEntry);

  $("bulk-close")?.addEventListener("click", closeBulkEntry);

  $("bulk-save")?.addEventListener("click", saveBulkEntries);

  // Update line count while typing
  $("bulk-text")?.addEventListener("input", () => {
    const textArea = $("bulk-text");
    if (!textArea) return;

    const count = textArea.value
      .split(/\r?\n/)
      .filter(line => line.trim() && !line.trim().startsWith("#"))
      .length;

    if ($("bulk-count")) {
      $("bulk-count").textContent =
        `${count} ${count === 1 ? "line" : "lines"}`;
    }
  });

  // Close Bulk Entry when clicking outside its card
  $("bulk-modal")?.addEventListener("click", e => {
    if (e.target === $("bulk-modal")) {
      closeBulkEntry();
    }
  });
}

// Initialize the app without requiring a PIN.
setupEvents();
showApp();