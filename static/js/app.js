const MONTHS_DE = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

let monthlyChart = null;
let categoryChart = null;
let pendingDeleteId = null;

const fmt = (n) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

function getYear() {
  return document.getElementById("yearSelect").value;
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
        tooltip: {
          callbacks: { label: (ctx) => ` ${fmt(ctx.parsed.y)}` },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => fmt(v) },
        },
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

  if (!expenses.length) {
    const ctx = document.getElementById("categoryChart").getContext("2d");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }

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
        tooltip: {
          callbacks: { label: (ctx) => ` ${ctx.label}: ${fmt(ctx.parsed)}` },
        },
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
        <td class="text-center">
          <button class="btn-delete" onclick="confirmDelete(${t.id})" title="Löschen">
            <i class="bi bi-trash3"></i>
          </button>
        </td>
      </tr>`;
  }).join("");
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

// ── Filters & Events ──────────────────────────────────────────────────────────

document.getElementById("yearSelect").addEventListener("change", refresh);
document.getElementById("filterMonth").addEventListener("change", loadTransactions);
document.getElementById("filterType").addEventListener("change", loadTransactions);
document.getElementById("resetFilter").addEventListener("click", () => {
  document.getElementById("filterMonth").value = "";
  document.getElementById("filterType").value = "";
  loadTransactions();
});

// Reload categories when modal opens
document.getElementById("transactionModal").addEventListener("show.bs.modal", () => {
  const type = document.querySelector('input[name="type"]:checked').value;
  loadCategories(type);
  document.getElementById("date").valueAsDate = new Date();
  document.getElementById("formError").classList.add("d-none");
});

function refresh() {
  loadSummary();
  loadTransactions();
}

// ── Init ──────────────────────────────────────────────────────────────────────
refresh();
