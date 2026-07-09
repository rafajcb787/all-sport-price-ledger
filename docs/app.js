const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
const number = new Intl.NumberFormat("en-US");
const STORAGE_KEY = "all-sport-price-ledger-static-v1";
let seed = [];
let items = [];
let history = [];
let selectedId = "";
let editingId = "";
let page = 1;
let pageSize = 50;
let view = "overview";

const $ = (selector) => document.querySelector(selector);
const margin = (item) => item.price > 0 ? ((item.price - item.cost) / item.price) * 100 : 0;
const initials = (id) => String(id).replace(/[^a-z0-9]/gi, "").slice(-2).toUpperCase().padStart(2, "0");
const changedIds = () => new Set(history.map((entry) => entry.itemId));

function loadLocalState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.items) items = seed.map((item) => saved.items[item.id] === undefined ? item : { ...item, price: Number(saved.items[item.id]) });
    if (saved?.history) history = Array.isArray(saved.history) ? saved.history : [];
  } catch { items = seed.slice(); history = []; }
}

function persist() {
  const source = Object.fromEntries(items.filter((item, index) => item.price !== seed[index]?.price).map((item) => [item.id, item.price]));
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: source, history }));
}

function showToast(message) {
  $("#toast-text").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { $("#toast").hidden = true; }, 2800);
}

function setView(next) {
  view = next;
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === next));
  document.querySelectorAll(".view-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `${next}-view`));
  $("#summary-shell").style.display = next === "about" ? "none" : "block";
  $("#page-title").textContent = next === "about" ? "About the ledger" : next === "history" ? "Change history" : next === "catalog" ? "Master catalog" : "Price intelligence dashboard";
  if (next === "catalog") renderCatalog();
  if (next === "history") renderHistory();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderMetrics() {
  const average = items.reduce((sum, item) => sum + margin(item), 0) / Math.max(items.length, 1);
  const retail = items.reduce((sum, item) => sum + item.price, 0);
  $("#metrics").innerHTML = `<div class="metric-card"><div class="metric-icon blue">#</div><div><span class="metric-label">Catalog items</span><strong>${number.format(items.length)}</strong><small>All active SKUs</small></div></div><div class="metric-card"><div class="metric-icon coral">+</div><div><span class="metric-label">Average margin</span><strong>${average.toFixed(1)}%</strong><small>Price less cost / price</small></div></div><div class="metric-card"><div class="metric-icon navy">$</div><div><span class="metric-label">Retail value</span><strong>${money(retail)}</strong><small>Across full catalog</small></div></div><div class="metric-card"><div class="metric-icon sand">~</div><div><span class="metric-label">Changes logged</span><strong>${number.format(history.length)}</strong><small>${history.length ? "Since this browser" : "No changes yet"}</small></div></div>`;
}

function renderOverview() {
  const healthy = items.filter((item) => margin(item) >= 25).length;
  const rate = items.length ? healthy / items.length * 100 : 0;
  const average = items.reduce((sum, item) => sum + margin(item), 0) / Math.max(items.length, 1);
  $("#focus-foot").innerHTML = `<span><strong>${number.format(healthy)}</strong> healthy-margin items</span><span><strong>${rate.toFixed(0)}%</strong> catalog health</span>`;
  $("#health-score").textContent = `${rate.toFixed(0)}%`;
  $("#avg-margin").innerHTML = `${average.toFixed(1)}<small>avg margin</small>`;
  $("#health-ring").style.setProperty("--rate", rate);
  $("#health-bars").innerHTML = `<div><span>Healthy  -  25%+</span><strong>${number.format(healthy)}</strong></div><div class="bar"><i style="width:${rate}%"></i></div><div><span>Needs review</span><strong>${number.format(items.length - healthy)}</strong></div><div class="bar review"><i style="width:${100 - rate}%"></i></div>`;
  const recent = history.slice().sort((a, b) => b.changedAt.localeCompare(a.changedAt)).slice(0, 5);
  const watchlist = items.slice().sort((a, b) => margin(a) - margin(b)).slice(0, 5);
  $("#pulse-title").textContent = recent.length ? "Latest changes" : "Margin watchlist";
  $("#pulse-link").innerHTML = recent.length ? "View all <span>></span>" : "Review items <span>></span>";
  $("#pulse-link").onclick = () => setView(recent.length ? "history" : "catalog");
  $("#pulse-list").innerHTML = (recent.length ? recent.map((entry) => `<button class="pulse-row" data-item="${escapeHtml(entry.itemId)}"><span class="pulse-icon">+</span><span><strong>${escapeHtml(entry.itemId)}</strong><small>${escapeHtml(entry.reason)}</small></span><b>${money(entry.to)}</b></button>`).join("") : watchlist.map((item) => `<button class="pulse-row" data-item="${escapeHtml(item.id)}"><span class="pulse-icon warning">!</span><span><strong>${escapeHtml(item.id)}</strong><small>${margin(item).toFixed(1)}% margin  -  review recommended</small></span><b>${money(item.price)}</b></button>`).join(""));
  document.querySelectorAll("#pulse-list [data-item]").forEach((button) => button.onclick = () => { selectedId = button.dataset.item; setView("catalog"); });
}

function filteredItems() {
  const needle = $("#search-input").value.trim().toLowerCase();
  const filter = $("#filter-select").value;
  const changed = changedIds();
  return items.filter((item) => (!needle || item.id.toLowerCase().includes(needle)) && (filter === "all" || (filter === "changed" ? changed.has(item.id) : margin(item) < 25)));
}

function renderCatalog() {
  const filtered = filteredItems();
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  page = Math.min(page, totalPages);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const changed = changedIds();
  $("#result-count").textContent = number.format(filtered.length);
  $("#catalog-body").innerHTML = visible.map((item) => `<tr class="${selectedId === item.id ? "selected-row" : ""}" data-select="${escapeHtml(item.id)}"><td><div class="item-cell"><span class="item-avatar">${initials(item.id)}</span><div><strong>${escapeHtml(item.id)}</strong><small>SKU ${String(item.index).padStart(4, "0")}</small></div></div></td><td class="muted-number">${money(item.cost)}</td><td><strong class="price">${money(item.price)}</strong></td><td><span class="margin-badge ${margin(item) < 25 ? "low" : "healthy"}">${margin(item).toFixed(1)}%</span></td><td class="activity">${changed.has(item.id) ? '<span class="activity-dot"></span> Updated' : '<span class="muted">Workbook seed</span>'}</td><td><button class="edit-button" data-edit="${escapeHtml(item.id)}">Edit price <span>></span></button></td></tr>`).join("");
  $("#empty-state").hidden = visible.length !== 0;
  $("#pagination-label").innerHTML = `Showing <strong>${filtered.length ? (page - 1) * pageSize + 1 : 0}-${Math.min(page * pageSize, filtered.length)}</strong> of <strong>${number.format(filtered.length)}</strong>`;
  $("#page-label").textContent = `${page} / ${totalPages}`;
  $("#prev-page").disabled = page <= 1; $("#next-page").disabled = page >= totalPages;
  document.querySelectorAll("#catalog-body [data-select]").forEach((row) => row.onclick = () => { selectedId = row.dataset.select; renderCatalog(); });
  document.querySelectorAll("#catalog-body [data-edit]").forEach((button) => button.onclick = (event) => { event.stopPropagation(); openEdit(button.dataset.edit); });
  renderDetail();
}

function renderDetail() {
  const item = items.find((entry) => entry.id === selectedId) || items[0];
  if (!item) return;
  selectedId = item.id;
  const itemHistory = history.filter((entry) => entry.itemId === item.id).sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  $("#detail-card").innerHTML = `<div class="detail-top"><div><div class="section-kicker">Item detail</div><h3>${escapeHtml(item.id)}</h3><p>SKU ${String(item.index).padStart(4, "0")}  -  ${itemHistory.length ? "Has price history" : "Workbook baseline"}</p></div><span class="item-avatar large">${initials(item.id)}</span></div><div class="price-hero"><span>Current price</span><strong>${money(item.price)}</strong><button data-detail-edit="${escapeHtml(item.id)}">Edit price <span>></span></button></div><div class="detail-stats"><div><span>Unit cost</span><strong>${money(item.cost)}</strong></div><div><span>Gross margin</span><strong class="${margin(item) < 25 ? "warn-text" : "good-text"}">${margin(item).toFixed(1)}%</strong></div><div><span>Markup</span><strong>${item.cost ? ((item.price / item.cost - 1) * 100).toFixed(1) : "0.0"}%</strong></div></div><div class="history-head"><div><div class="section-kicker">Audit trail</div><h4>Price history</h4></div><span class="history-count">${itemHistory.length}</span></div><div class="history-list">${itemHistory.length ? itemHistory.map((entry) => `<div class="history-entry"><span class="timeline-line"></span><div class="history-dot"></div><div class="history-copy"><strong>${money(entry.from)} <span>></span> ${money(entry.to)}</strong><p>${escapeHtml(entry.reason)}</p><small>${new Date(entry.changedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}  -  ${escapeHtml(entry.changedBy || "You")}</small></div></div>`).join("") : '<div class="history-empty"><span>~</span><p>Price changes for this item will appear here with the reason and timestamp.</p></div>'}</div>`;
  $("[data-detail-edit]").onclick = () => openEdit(item.id);
}

function renderHistory() {
  const sorted = history.slice().sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  $("#history-total").textContent = number.format(sorted.length);
  $("#history-content").innerHTML = sorted.length ? `<div class="history-table">${sorted.map((entry) => `<button class="history-table-row" data-history-item="${escapeHtml(entry.itemId)}"><span class="history-table-icon">+</span><span class="history-table-item"><strong>${escapeHtml(entry.itemId)}</strong><small>${new Date(entry.changedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}  -  ${escapeHtml(entry.changedBy || "You")}</small></span><span class="history-table-reason">${escapeHtml(entry.reason)}</span><span class="history-table-price"><strong>${money(entry.from)} <i>></i> ${money(entry.to)}</strong><small>price update</small></span></button>`).join("")}</div>` : '<div class="empty-history"><span>~</span><h3>No changes yet</h3><p>Once you update an item price, its full audit trail will appear here.</p><button class="primary-button" data-view="catalog">Browse catalog <span>></span></button></div>';
  document.querySelectorAll("[data-history-item]").forEach((button) => button.onclick = () => { selectedId = button.dataset.historyItem; setView("catalog"); });
  document.querySelectorAll("#history-content [data-view]").forEach((button) => button.onclick = () => setView(button.dataset.view));
}

function openEdit(id) {
  const item = items.find((entry) => entry.id === id); if (!item) return;
  editingId = id; $("#edit-title").textContent = id; $("#edit-subtitle").innerHTML = `Current price <strong>${money(item.price)}</strong>  -  Cost ${money(item.cost)}`; $("#new-price").value = item.price.toFixed(2); $("#change-reason").value = ""; $("#edit-modal").hidden = false; $("#new-price").focus();
}

function saveEdit() {
  const item = items.find((entry) => entry.id === editingId); if (!item) return;
  const next = Number.parseFloat($("#new-price").value); const reason = $("#change-reason").value.trim();
  if (!Number.isFinite(next) || next < 0) return showToast("Enter a valid price before saving.");
  if (!reason) return showToast("Add a reason so the audit trail stays useful.");
  if (Math.abs(next - item.price) < .005) return showToast("No price change to save.");
  const entry = { id: `${item.id}-${Date.now()}`, itemId: item.id, from: item.price, to: next, reason, changedBy: "You", changedAt: new Date().toISOString() };
  item.price = next; history.unshift(entry); selectedId = item.id; persist(); $("#edit-modal").hidden = true; renderMetrics(); renderOverview(); if (view === "catalog") renderCatalog(); if (view === "history") renderHistory(); showToast(`Price for ${item.id} updated and logged.`);
}

function exportCsv() {
  const rows = ["Item,Cost,Price,Margin %", ...items.map((item) => [item.id, item.cost.toFixed(2), item.price.toFixed(2), margin(item).toFixed(1)].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))];
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" })); link.download = "all-sport-price-ledger.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); showToast("Catalog exported as CSV.");
}

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character])); }

document.addEventListener("DOMContentLoaded", async () => {
  try { seed = await fetch("inventory.json").then((response) => response.json()); items = seed.slice(); loadLocalState(); selectedId = items[0]?.id || ""; renderMetrics(); renderOverview(); }
  catch { showToast("Could not load inventory.json. Keep it beside index.html on Tiiny Host."); }
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $("#search-input").addEventListener("input", () => { page = 1; renderCatalog(); }); $("#filter-select").addEventListener("change", () => { page = 1; renderCatalog(); }); $("#page-size").addEventListener("change", (event) => { pageSize = Number(event.target.value); page = 1; renderCatalog(); }); $("#prev-page").onclick = () => { page -= 1; renderCatalog(); }; $("#next-page").onclick = () => { page += 1; renderCatalog(); }; $("#export-button").onclick = exportCsv; $("#quick-export").onclick = exportCsv;
  $("#close-modal").onclick = () => $("#edit-modal").hidden = true; $("#cancel-edit").onclick = () => $("#edit-modal").hidden = true; $("#save-edit").onclick = saveEdit; $("#edit-modal").addEventListener("mousedown", (event) => { if (event.target.id === "edit-modal") $("#edit-modal").hidden = true; });
  document.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setView("catalog"); $("#search-input").focus(); } if (event.key === "Escape") $("#edit-modal").hidden = true; });
});

