const MONTHS_DE = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

let monthlyChart = null;
let categoryChart = null;
let pendingDeleteId = null;
let editingId = null;

const fmt = (n) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

function getYear() {
  return document.getElementById("yearSelect").value;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Summary ──────────────────────────────────────────────────────────────────

async function loadSummary() {
  const res = await fetch(`/api/summary?year=${getYear()}`);
  const data = await res.json();

  document.getElementById("totalIncome").textContent = fmt(data.income);
  document.getElementById("totalExpense").textContent = fmt(data.expense);
  const balEl = document.getElementById("totalBalance");
  balEl.textContent = fmt(data.balance);
  balEl.className = "fw-bold mb-0 " + (data.balance >= 0 ? "balance-positive" : "balance-negative");

  renderMonthlyChart(data.monthly);
  renderCategoryChart(data.categories);
}

// ── Monthly Bar Chart ─────────────────────────────────────────────────────────

function renderMonthlyChart(monthly) {
  const labels = MONTHS_DE;
  const incomes  = Array.from({length: 12}, (_, i) => (monthly[i + 1]?.income  ?? 0));
  const expenses = Array.from({length: 12}, (_, i) => (monthly[i + 1]?.expense ?? 0));

  if (monthlyChart) monthlyChart.destroy();

  monthlyChart = new Chart(document.getElementById("monthlyChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Einnahmen", data: incomes,  backgroundColor: "rgba(25,135,84,0.7)",  borderRadius: 5 },
        { label: "Ausgaben",  data: expenses, backgroundColor: "rgba(220,53,69,0.7)",  borderRadius: 5 },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "top" },
        tooltip: { callbacks: { label: (ctx) => ` ${fmt(ctx.parsed.y)}` } },
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: (v) => fmt(v) } },
      },
    },
  });
}

// ── Category Pie Chart ────────────────────────────────────────────────────────

function renderCategoryChart(categories) {
  const expenses = categories.filter((c) => c.type === "expense");
  const labels = expenses.map((c) => c.category);
  const values = expenses.map((c) => c.total);

  const palette = [
    "#ef4444","#f97316","#eab308","#22c55e","#06b6d4",
    "#6366f1","#a855f7","#ec4899","#14b8a6","#84cc16",
    "#f43f5e","#8b5cf6","#0ea5e9",
  ];

  if (categoryChart) categoryChart.destroy();

  if (!expenses.length) return;

  categoryChart = new Chart(document.getElementById("categoryChart"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: palette.slice(0, labels.length),
        borderWidth: 2,
        borderColor: "#fff",
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${fmt(ctx.parsed)}` } },
      },
    },
  });
}

// ── Transaction Table ─────────────────────────────────────────────────────────

async function loadTransactions() {
  const year  = getYear();
  const month = document.getElementById("filterMonth").value;
  const type  = document.getElementById("filterType").value;

  let url = `/api/transactions?year=${year}`;
  if (month) url += `&month=${month}`;
  if (type)  url += `&type=${type}`;

  const res = await fetch(url);
  const rows = await res.json();

  const tbody = document.getElementById("transactionTable");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Keine Transaktionen gefunden.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((t) => {
    const isIncome = t.type === "income";
    const sign = isIncome ? "+" : "−";
    const dateStr = new Date(t.date).toLocaleDateString("de-DE");
    return `
      <tr>
        <td class="text-muted small">${dateStr}</td>
        <td>
          <span class="badge rounded-pill ${isIncome ? "badge-income" : "badge-expense"}">
            ${isIncome ? "Einnahme" : "Ausgabe"}
          </span>
        </td>
        <td>${escHtml(t.category)}</td>
        <td class="text-muted small">${escHtml(t.description || "—")}</td>
        <td class="text-end ${isIncome ? "amount-income" : "amount-expense"}">
          ${sign} ${fmt(t.amount)}
        </td>
        <td class="text-center text-nowrap">
          <button class="btn-edit me-1"
            data-id="${t.id}"
            data-type="${escHtml(t.type)}"
            data-amount="${t.amount}"
            data-category="${escHtml(t.category)}"
            data-date="${escHtml(t.date)}"
            data-description="${escHtml(t.description || "")}"
            title="Bearbeiten">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn-delete"
            data-id="${t.id}"
            title="Löschen">
            <i class="bi bi-trash3"></i>
          </button>
        </td>
      </tr>`;
  }).join("");
}

// Event delegation for edit & delete buttons in table
document.getElementById("transactionTable").addEventListener("click", (e) => {
  const editBtn = e.target.closest(".btn-edit");
  if (editBtn) {
    const d = editBtn.dataset;
    openEditModal(parseInt(d.id), d.type, parseFloat(d.amount), d.category, d.date, d.description);
    return;
  }
  const delBtn = e.target.closest(".btn-delete");
  if (delBtn) {
    confirmDelete(parseInt(delBtn.dataset.id));
  }
});

// ── Delete ────────────────────────────────────────────────────────────────────

function confirmDelete(id) {
  pendingDeleteId = id;
  new bootstrap.Modal(document.getElementById("deleteModal")).show();
}

document.getElementById("confirmDelete").addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  await fetch(`/api/transactions/${pendingDeleteId}`, { method: "DELETE" });
  bootstrap.Modal.getInstance(document.getElementById("deleteModal")).hide();
  pendingDeleteId = null;
  refresh();
});

// ── Add Transaction ───────────────────────────────────────────────────────────

async function loadCategories(type) {
  const res = await fetch(`/api/categories?type=${type}`);
  const cats = await res.json();
  const sel = document.getElementById("category");
  sel.innerHTML = cats.map((c) => `<option value="${escHtml(c.name)}">${escHtml(c.name)}</option>`).join("");
}

document.querySelectorAll('input[name="type"]').forEach((radio) => {
  radio.addEventListener("change", () => loadCategories(radio.value));
});

document.getElementById("saveTransaction").addEventListener("click", async () => {
  const errEl = document.getElementById("formError");
  errEl.classList.add("d-none");

  const type        = document.querySelector('input[name="type"]:checked').value;
  const amount      = parseFloat(document.getElementById("amount").value);
  const category    = document.getElementById("category").value;
  const date        = document.getElementById("date").value;
  const description = document.getElementById("description").value.trim();

  if (!amount || amount <= 0 || !category || !date) {
    errEl.textContent = "Bitte alle Pflichtfelder ausfüllen.";
    errEl.classList.remove("d-none");
    return;
  }

  const res = await fetch("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, amount, category, date, description }),
  });

  if (!res.ok) {
    const err = await res.json();
    errEl.textContent = err.error || "Fehler beim Speichern.";
    errEl.classList.remove("d-none");
    return;
  }

  bootstrap.Modal.getInstance(document.getElementById("transactionModal")).hide();
  document.getElementById("transactionForm").reset();
  refresh();
});

document.getElementById("transactionModal").addEventListener("show.bs.modal", () => {
  const type = document.querySelector('input[name="type"]:checked').value;
  loadCategories(type);
  document.getElementById("date").valueAsDate = new Date();
  document.getElementById("formError").classList.add("d-none");
});

// ── Edit Transaction ──────────────────────────────────────────────────────────

async function loadEditCategories(type, selectedCategory) {
  const res = await fetch(`/api/categories?type=${type}`);
  const cats = await res.json();
  const sel = document.getElementById("editCategory");
  sel.innerHTML = cats.map((c) =>
    `<option value="${escHtml(c.name)}" ${c.name === selectedCategory ? "selected" : ""}>${escHtml(c.name)}</option>`
  ).join("");
}

async function openEditModal(id, type, amount, category, date, description) {
  editingId = id;
  document.getElementById(type === "income" ? "editTypeIncome" : "editTypeExpense").checked = true;
  document.getElementById("editAmount").value = amount;
  document.getElementById("editDate").value = date;
  document.getElementById("editDescription").value = description;
  document.getElementById("editFormError").classList.add("d-none");
  await loadEditCategories(type, category);
  new bootstrap.Modal(document.getElementById("editModal")).show();
}

document.querySelectorAll('input[name="editType"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const currentCat = document.getElementById("editCategory").value;
    loadEditCategories(radio.value, currentCat);
  });
});

document.getElementById("saveEditTransaction").addEventListener("click", async () => {
  const errEl = document.getElementById("editFormError");
  errEl.classList.add("d-none");

  const type        = document.querySelector('input[name="editType"]:checked').value;
  const amount      = parseFloat(document.getElementById("editAmount").value);
  const category    = document.getElementById("editCategory").value;
  const date        = document.getElementById("editDate").value;
  const description = document.getElementById("editDescription").value.trim();

  if (!amount || amount <= 0 || !category || !date) {
    errEl.textContent = "Bitte alle Pflichtfelder ausfüllen.";
    errEl.classList.remove("d-none");
    return;
  }

  const res = await fetch(`/api/transactions/${editingId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, amount, category, date, description }),
  });

  if (!res.ok) {
    const err = await res.json();
    errEl.textContent = err.error || "Fehler beim Speichern.";
    errEl.classList.remove("d-none");
    return;
  }

  bootstrap.Modal.getInstance(document.getElementById("editModal")).hide();
  refresh();
});

// ── CSV Export ────────────────────────────────────────────────────────────────

document.getElementById("exportCsv").addEventListener("click", () => {
  const year  = getYear();
  const month = document.getElementById("filterMonth").value;
  const type  = document.getElementById("filterType").value;
  let url = `/api/transactions/export?year=${year}`;
  if (month) url += `&month=${month}`;
  if (type)  url += `&type=${type}`;
  window.location.href = url;
});

// ── Category Management ───────────────────────────────────────────────────────

async function loadCategoryModal() {
  const [incRes, expRes] = await Promise.all([
    fetch("/api/categories?type=income"),
    fetch("/api/categories?type=expense"),
  ]);
  renderCatList("catListIncome",  await incRes.json());
  renderCatList("catListExpense", await expRes.json());
}

function renderCatList(listId, cats) {
  const ul = document.getElementById(listId);
  ul.innerHTML = cats.length
    ? cats.map((c) => `
        <li class="list-group-item d-flex justify-content-between align-items-center px-0 py-1">
          <span>${escHtml(c.name)}</span>
          <button class="btn-cat-delete" data-id="${c.id}" title="Löschen">
            <i class="bi bi-trash3"></i>
          </button>
        </li>`).join("")
    : `<li class="list-group-item text-muted px-0 small">Keine Kategorien</li>`;
}

document.getElementById("categoryModal").addEventListener("show.bs.modal", () => {
  document.getElementById("catError").classList.add("d-none");
  document.getElementById("catSuccess").classList.add("d-none");
  loadCategoryModal();
});

document.getElementById("addCategoryBtn").addEventListener("click", async () => {
  const name  = document.getElementById("newCatName").value.trim();
  const type  = document.getElementById("newCatType").value;
  const errEl = document.getElementById("catError");
  const okEl  = document.getElementById("catSuccess");
  errEl.classList.add("d-none");
  okEl.classList.add("d-none");

  if (!name) {
    errEl.textContent = "Bitte einen Namen eingeben.";
    errEl.classList.remove("d-none");
    return;
  }

  const res = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, type }),
  });

  if (!res.ok) {
    const err = await res.json();
    errEl.textContent = err.error;
    errEl.classList.remove("d-none");
    return;
  }

  document.getElementById("newCatName").value = "";
  okEl.textContent = `Kategorie „${escHtml(name)}" wurde hinzugefügt.`;
  okEl.classList.remove("d-none");
  loadCategoryModal();
});

document.getElementById("categoryModal").addEventListener("click", async (e) => {
  const btn = e.target.closest(".btn-cat-delete");
  if (!btn) return;
  const errEl = document.getElementById("catError");
  errEl.classList.add("d-none");

  const res = await fetch(`/api/categories/${btn.dataset.id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json();
    errEl.textContent = err.error;
    errEl.classList.remove("d-none");
    return;
  }
  loadCategoryModal();
});

// ── Budget Planning ───────────────────────────────────────────────────────────

function initBudgetYearSelect() {
  const sel = document.getElementById("budgetYear");
  const currentYear = parseInt(getYear());
  for (let y = currentYear - 2; y <= currentYear + 1; y++) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    if (y === currentYear) opt.selected = true;
    sel.appendChild(opt);
  }
}

async function loadBudgets() {
  const month = document.getElementById("budgetMonth").value;
  const year  = document.getElementById("budgetYear").value;

  const [catRes, budgetRes] = await Promise.all([
    fetch("/api/categories?type=expense"),
    fetch(`/api/budgets?month=${month}&year=${year}`),
  ]);
  const categories = await catRes.json();
  const budgets    = await budgetRes.json();

  const budgetMap = {};
  budgets.forEach((b) => { budgetMap[b.category] = b; });

  const container = document.getElementById("budgetList");
  if (!categories.length) {
    container.innerHTML = '<p class="text-muted">Keine Ausgabe-Kategorien vorhanden.</p>';
    return;
  }

  container.innerHTML = categories.map((cat) => {
    const b      = budgetMap[cat.name] || { limit_amount: 0, actual: 0 };
    const limit  = b.limit_amount || 0;
    const actual = b.actual || 0;
    const pct    = limit > 0 ? Math.min((actual / limit) * 100, 100) : 0;
    const barClass = pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-success";

    return `
      <div class="budget-row mb-3">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <span class="fw-semibold">${escHtml(cat.name)}</span>
          <span class="text-muted small d-flex align-items-center gap-1">
            ${fmt(actual)} /
            <input type="number" class="budget-limit-input"
                   data-category="${escHtml(cat.name)}"
                   value="${limit > 0 ? limit : ""}"
                   min="0.01" step="0.01"
                   placeholder="Kein Limit" />
            <span>€</span>
          </span>
        </div>
        <div class="progress" style="height:8px">
          <div class="progress-bar ${barClass}" role="progressbar" style="width:${pct}%"></div>
        </div>
        ${limit > 0 && actual > limit
          ? `<small class="text-danger">Budget überschritten um ${fmt(actual - limit)}</small>`
          : ""}
      </div>`;
  }).join("");

  container.querySelectorAll(".budget-limit-input").forEach((input) => {
    input.addEventListener("change", async () => {
      const limitVal = parseFloat(input.value);
      if (isNaN(limitVal) || limitVal <= 0) return;
      await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category:     input.dataset.category,
          month:        parseInt(month),
          year:         parseInt(year),
          limit_amount: limitVal,
        }),
      });
      loadBudgets();
    });
  });
}

document.getElementById("budgetModal").addEventListener("show.bs.modal", () => {
  document.getElementById("budgetMonth").value = new Date().getMonth() + 1;
  loadBudgets();
});

document.getElementById("loadBudgetsBtn").addEventListener("click", loadBudgets);

// ── Filters & Events ──────────────────────────────────────────────────────────

document.getElementById("yearSelect").addEventListener("change", refresh);
document.getElementById("filterMonth").addEventListener("change", loadTransactions);
document.getElementById("filterType").addEventListener("change", loadTransactions);
document.getElementById("resetFilter").addEventListener("click", () => {
  document.getElementById("filterMonth").value = "";
  document.getElementById("filterType").value = "";
  loadTransactions();
});

function refresh() {
  loadSummary();
  loadTransactions();
}

// ── Init ──────────────────────────────────────────────────────────────────────
initBudgetYearSelect();
refresh();
