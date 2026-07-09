"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import catalog from "./items.json";

type CatalogItem = { id: string; cost: number; price: number; index: number };
type HistoryEntry = { id: string; itemId: string; from: number; to: number; reason: string; changedBy: string; changedAt: string };
type View = "overview" | "catalog" | "history" | "about";

const seedItems = catalog as CatalogItem[];
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const number = new Intl.NumberFormat("en-US");
const STORAGE_KEY = "all-sport-price-ledger-v1";

function money(value: number) { return currency.format(value || 0); }
function margin(cost: number, price: number) { return price > 0 ? ((price - cost) / price) * 100 : 0; }
function initials(id: string) { return id.replace(/[^a-z0-9]/gi, "").slice(-2).toUpperCase().padStart(2, "0"); }

export default function Home() {
  const [items, setItems] = useState<CatalogItem[]>(seedItems);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "changed" | "margin">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedId, setSelectedId] = useState(seedItems[0]?.id ?? "");
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [draftPrice, setDraftPrice] = useState("");
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("overview");

  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (saved?.items) setItems(seedItems.map((item) => saved.items[item.id] ? { ...item, price: saved.items[item.id] } : item));
        if (saved?.history) setHistory(saved.history);
      } catch { /* use workbook seed */ }
    });
    fetch("/api/prices").then((response) => response.ok ? response.json() : null).then((payload) => {
      if (!payload) return;
      if (payload.items) setItems((current) => current.map((item) => payload.items[item.id] === undefined ? item : { ...item, price: payload.items[item.id] }));
      if (payload.history?.length) setHistory(payload.history);
    }).catch(() => undefined).finally(() => setLoaded(true));
  }, []);

  const changedIds = useMemo(() => new Set(history.map((entry) => entry.itemId)), [history]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !needle || item.id.toLowerCase().includes(needle);
      const matchesFilter = filter === "all" || (filter === "changed" ? changedIds.has(item.id) : margin(item.cost, item.price) < 25);
      return matchesQuery && matchesFilter;
    });
  }, [items, query, filter, changedIds]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selected = items.find((item) => item.id === selectedId) ?? filtered[0] ?? items[0];
  const selectedHistory = history.filter((entry) => entry.itemId === selected?.id).sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  const avgMargin = items.reduce((sum, item) => sum + margin(item.cost, item.price), 0) / Math.max(items.length, 1);
  const retailValue = items.reduce((sum, item) => sum + item.price, 0);
  const lowMarginItems = useMemo(() => [...items].sort((a, b) => margin(a.cost, a.price) - margin(b.cost, b.price)).slice(0, 5), [items]);
  const recentHistory = history.slice().sort((a, b) => b.changedAt.localeCompare(a.changedAt)).slice(0, 5);
  const healthyCount = items.filter((item) => margin(item.cost, item.price) >= 25).length;
  const healthyRate = items.length ? (healthyCount / items.length) * 100 : 0;

  useEffect(() => { if (toast) { const timer = window.setTimeout(() => setToast(""), 2800); return () => window.clearTimeout(timer); } }, [toast]);

  function openEdit(item: CatalogItem) {
    setEditing(item); setDraftPrice(item.price.toFixed(2)); setReason("");
  }

  function saveEdit() {
    if (!editing) return;
    const nextPrice = Number.parseFloat(draftPrice);
    if (!Number.isFinite(nextPrice) || nextPrice < 0) { setToast("Enter a valid price before saving."); return; }
    if (!reason.trim()) { setToast("Add a reason so the audit trail stays useful."); return; }
    if (Math.abs(nextPrice - editing.price) < 0.005) { setToast("No price change to save."); return; }
    const entry: HistoryEntry = { id: `${editing.id}-${Date.now()}`, itemId: editing.id, from: editing.price, to: nextPrice, reason: reason.trim(), changedBy: "You", changedAt: new Date().toISOString() };
    const nextItems = items.map((item) => item.id === editing.id ? { ...item, price: nextPrice } : item);
    const nextHistory = [entry, ...history];
    setItems(nextItems); setHistory(nextHistory); setSelectedId(editing.id); setEditing(null);
    const overrideMap = Object.fromEntries(nextItems.filter((item, index) => item.price !== seedItems[index].price).map((item) => [item.id, item.price]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: overrideMap, history: nextHistory }));
    fetch("/api/prices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(entry) }).catch(() => undefined);
    setToast(`Price for ${editing.id} updated and logged.`);
  }

  function exportCsv() {
    const rows = ["Item,Cost,Price,Margin %", ...items.map((item) => [item.id, item.cost.toFixed(2), item.price.toFixed(2), margin(item.cost, item.price).toFixed(1)].map((value) => `"${value.replaceAll('"', '""')}"`).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "all-sport-price-ledger.csv"; link.click(); URL.revokeObjectURL(url);
    setToast("Catalog exported as CSV.");
  }

  function goTo(nextView: View) {
    setView(nextView);
    if (nextView === "catalog") setPage(1);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><img src="/all-sport-logo.jpg" alt="All Sport International" /><span className="brand-chip">PRICING OPS</span></div>
        <nav className="nav-list" aria-label="Primary navigation">
          <button className={`nav-item ${view === "overview" ? "active" : ""}`} onClick={() => goTo("overview")}><span>â—ˆ</span> Price ledger</button>
          <button className={`nav-item ${view === "catalog" ? "active" : ""}`} onClick={() => goTo("catalog")}><span>â–¦</span> Catalog</button>
          <button className={`nav-item ${view === "history" ? "active" : ""}`} onClick={() => goTo("history")}><span>â—Œ</span> Change history</button>
          <button className={`nav-item ${view === "about" ? "active" : ""}`} onClick={() => goTo("about")}><span>i</span> About</button>
        </nav>
        <div className="sidebar-note"><span className="live-dot" /> Workbook synced<br /><small>07 Sep 2026 Â· 2,848 SKUs</small></div>
        <div className="sidebar-footer"><div className="avatar">AS</div><div><strong>All Sport Team</strong><small>International pricing</small></div></div>
      </aside>

      <section className="workspace">
        <header className="topbar"><div><p className="eyebrow">All Sport International / Operations</p><h1>{view === "about" ? "About the ledger" : view === "history" ? "Change history" : view === "catalog" ? "Master catalog" : "Price intelligence dashboard"}</h1></div><div className="top-actions"><button className="ghost-button" onClick={exportCsv}>â‡© Export catalog</button><div className="status-pill"><span className="live-dot" /> {loaded ? "Live ledger" : "Loading ledger"}</div></div></header>

        <div className="content">
          {view !== "about" && <>
          <section className="hero-row"><div><h2>Know every price.<br /><em>Move with confidence.</em></h2><p>Search the full item catalog, review cost-to-price health, and keep every update accountable.</p></div><div className="hero-stamp"><span>01</span><strong>Price<br />intelligence</strong><small>Updated from your workbook</small></div></section>

          <section className="metrics-grid" aria-label="Catalog summary">
            <div className="metric-card"><div className="metric-icon blue">âˆ‘</div><div><span className="metric-label">Catalog items</span><strong>{number.format(items.length)}</strong><small>All active SKUs</small></div></div>
            <div className="metric-card"><div className="metric-icon coral">â†—</div><div><span className="metric-label">Average margin</span><strong>{avgMargin.toFixed(1)}%</strong><small>Price less cost / price</small></div></div>
            <div className="metric-card"><div className="metric-icon navy">$</div><div><span className="metric-label">Retail value</span><strong>{money(retailValue)}</strong><small>Across full catalog</small></div></div>
            <div className="metric-card"><div className="metric-icon sand">âŒ</div><div><span className="metric-label">Changes logged</span><strong>{number.format(history.length)}</strong><small>{history.length ? "Since this session" : "No changes yet"}</small></div></div>
          </section>
          </>}

          {view === "overview" && <section className="overview-grid" aria-label="Price ledger overview">
            <div className="focus-card"><div className="focus-orbit orbit-one" /><div className="focus-orbit orbit-two" /><div className="section-kicker">Your next move</div><h3>Keep the catalog<br /><em>in motion.</em></h3><p>Use the ledger to spot margin pressure, make a considered update, and leave a trail your team can trust.</p><button className="primary-button" onClick={() => goTo("catalog")}>Open full catalog <span>â†’</span></button><div className="focus-foot"><span><strong>{number.format(healthyCount)}</strong> healthy-margin items</span><span><strong>{healthyRate.toFixed(0)}%</strong> catalog health</span></div></div>
            <div className="spotlight-card"><div className="spotlight-head"><div><div className="section-kicker">Activity pulse</div><h3>{history.length ? "Latest changes" : "Margin watchlist"}</h3></div><button className="text-button" onClick={() => goTo(history.length ? "history" : "catalog")}>{history.length ? "View all" : "Review items"} <span>â†’</span></button></div>{history.length ? recentHistory.map((entry) => <button className="pulse-row" key={entry.id} onClick={() => { setSelectedId(entry.itemId); goTo("catalog"); }}><span className="pulse-icon">â†—</span><span><strong>{entry.itemId}</strong><small>{entry.reason}</small></span><b>{money(entry.to)}</b></button>) : lowMarginItems.map((item) => <button className="pulse-row" key={item.id} onClick={() => { setSelectedId(item.id); goTo("catalog"); }}><span className="pulse-icon warning">!</span><span><strong>{item.id}</strong><small>{margin(item.cost, item.price).toFixed(1)}% margin Â· review recommended</small></span><b>{money(item.price)}</b></button>)}</div>
            <div className="health-card"><div className="spotlight-head"><div><div className="section-kicker">Portfolio health</div><h3>Margin distribution</h3></div><span className="health-score">{healthyRate.toFixed(0)}%</span></div><div className="health-visual"><div className="health-ring" style={{ ["--rate" as string]: healthyRate }}><span>{avgMargin.toFixed(1)}<small>avg margin</small></span></div><div className="bar-stack"><div><span>Healthy Â· 25%+</span><strong>{number.format(healthyCount)}</strong></div><div className="bar"><i style={{ width: `${healthyRate}%` }} /></div><div><span>Needs review</span><strong>{number.format(items.length - healthyCount)}</strong></div><div className="bar review"><i style={{ width: `${100 - healthyRate}%` }} /></div></div></div><button className="insight-link" onClick={() => { setFilter("margin"); goTo("catalog"); }}>See low-margin items <span>â†’</span></button></div>
            <div className="quick-card"><div className="section-kicker">Shortcuts</div><h3>Make the next update feel easy.</h3><div className="quick-actions"><button onClick={() => goTo("catalog")}><span>âŒ•</span><strong>Find an item</strong><small>Search all 2,848 SKUs</small></button><button onClick={exportCsv}><span>â‡©</span><strong>Export a snapshot</strong><small>Download the current catalog</small></button><button onClick={() => goTo("about")}><span>i</span><strong>About this tool</strong><small>Built for All Sport International</small></button></div></div>
          </section>}

          {view === "catalog" && <section className="ledger-layout">
            <div className="ledger-card">
              <div className="ledger-head"><div><div className="section-kicker">Master catalog</div><h3>All items <span>{number.format(filtered.length)}</span></h3></div><div className="ledger-tools"><label className="search-box"><span>âŒ•</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search item numberâ€¦" aria-label="Search items" /><kbd>âŒ˜ K</kbd></label><select value={filter} onChange={(event) => { setFilter(event.target.value as typeof filter); setPage(1); }} aria-label="Filter catalog"><option value="all">All items</option><option value="changed">Changed prices</option><option value="margin">Margin under 25%</option></select></div></div>
              <div className="table-wrap"><table><thead><tr><th>Item</th><th>Cost</th><th>Current price</th><th>Margin</th><th>Last activity</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{visible.map((item) => <tr key={item.id} className={selected?.id === item.id ? "selected-row" : ""} onClick={() => setSelectedId(item.id)}><td><div className="item-cell"><span className="item-avatar">{initials(item.id)}</span><div><strong>{item.id}</strong><small>SKU {String(item.index).padStart(4, "0")}</small></div></div></td><td className="muted-number">{money(item.cost)}</td><td><strong className="price">{money(item.price)}</strong></td><td><span className={`margin-badge ${margin(item.cost, item.price) < 25 ? "low" : "healthy"}`}>{margin(item.cost, item.price).toFixed(1)}%</span></td><td className="activity">{changedIds.has(item.id) ? <><span className="activity-dot" /> Updated</> : <span className="muted">Workbook seed</span>}</td><td><button className="edit-button" onClick={(event) => { event.stopPropagation(); openEdit(item); }}>Edit price <span>â†’</span></button></td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-state"><span>âŒ•</span><strong>No items found</strong><p>Try another item number or filter.</p></div>}</div>
              <div className="pagination"><span>Showing <strong>{filtered.length ? (page - 1) * pageSize + 1 : 0}â€“{Math.min(page * pageSize, filtered.length)}</strong> of <strong>{number.format(filtered.length)}</strong></span><div className="page-actions"><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} aria-label="Rows per page"><option value="25">25 / page</option><option value="50">50 / page</option><option value="100">100 / page</option></select><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>â€¹</button><span>{page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>â€º</button></div></div>
            </div>

            <aside className="detail-card">{selected ? <><div className="detail-top"><div><div className="section-kicker">Item detail</div><h3>{selected.id}</h3><p>SKU {String(selected.index).padStart(4, "0")} Â· {changedIds.has(selected.id) ? "Has price history" : "Workbook baseline"}</p></div><span className="item-avatar large">{initials(selected.id)}</span></div><div className="price-hero"><span>Current price</span><strong>{money(selected.price)}</strong><button onClick={() => openEdit(selected)}>Edit price <span>â†’</span></button></div><div className="detail-stats"><div><span>Unit cost</span><strong>{money(selected.cost)}</strong></div><div><span>Gross margin</span><strong className={margin(selected.cost, selected.price) < 25 ? "warn-text" : "good-text"}>{margin(selected.cost, selected.price).toFixed(1)}%</strong></div><div><span>Markup</span><strong>{selected.cost ? ((selected.price / selected.cost - 1) * 100).toFixed(1) : "0.0"}%</strong></div></div><div className="history-head"><div><div className="section-kicker">Audit trail</div><h4>Price history</h4></div><span className="history-count">{selectedHistory.length}</span></div><div className="history-list">{selectedHistory.length ? selectedHistory.map((entry) => <div className="history-entry" key={entry.id}><span className="timeline-line" /><div className="history-dot" /><div className="history-copy"><strong>{money(entry.from)} <span>â†’</span> {money(entry.to)}</strong><p>{entry.reason}</p><small>{new Date(entry.changedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} Â· {entry.changedBy}</small></div></div>) : <div className="history-empty"><span>âŒ</span><p>Price changes for this item will appear here with the reason and timestamp.</p></div>}</div></> : <div className="history-empty"><span>âŒ•</span><p>Select an item to inspect its pricing record.</p></div>}</aside>
          </section>}

          {view === "history" && <section className="history-page"><div className="history-page-head"><div><div className="section-kicker">Accountability by design</div><h2>Every change has a story.</h2><p>Review the complete price trail across the catalog, with the reason and moment captured alongside each update.</p></div><div className="history-total"><strong>{number.format(history.length)}</strong><span>total changes</span></div></div>{history.length ? <div className="history-table">{history.slice().sort((a, b) => b.changedAt.localeCompare(a.changedAt)).map((entry) => <button className="history-table-row" key={entry.id} onClick={() => { setSelectedId(entry.itemId); goTo("catalog"); }}><span className="history-table-icon">â†—</span><span className="history-table-item"><strong>{entry.itemId}</strong><small>{new Date(entry.changedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} Â· {entry.changedBy}</small></span><span className="history-table-reason">{entry.reason}</span><span className="history-table-price"><strong>{money(entry.from)} <i>â†’</i> {money(entry.to)}</strong><small>price update</small></span></button>)}</div> : <div className="empty-history"><span>âŒ</span><h3>No changes yet</h3><p>Once you update an item price, its full audit trail will appear here.</p><button className="primary-button" onClick={() => goTo("catalog")}>Browse catalog <span>â†’</span></button></div>}</section>}

          {view === "about" && <section className="about-page"><div className="about-hero"><div><div className="section-kicker">About the tool</div><h2>Built to make<br /><em>every price clearer.</em></h2><p>The All Sport International Price Ledger turns a working inventory workbook into a shared, searchable operating surface for the team.</p></div><div className="about-mark"><span>AS</span><small>INTERNATIONAL<br />PRICING OPS</small></div></div><div className="about-grid"><article><span className="about-number">01</span><h3>Made by Rafael Castrillo Beltran</h3><p>Designed and built for All Sport International to make item pricing easier to search, safer to edit, and simpler to explain when a number changes.</p></article><article><span className="about-number">02</span><h3>From workbook to workflow</h3><p>The catalog starts with the supplied inventory file, then adds margin signals, filters, quick actions, and a reason-first audit trail around the data.</p></article><article><span className="about-number">03</span><h3>A calm layer of control</h3><p>Use the dashboard to move quickly without losing context. Local edits are saved on the device, with the ledger API ready for shared persistence when deployed.</p></article></div><div className="about-footer"><span>ALL SPORT INTERNATIONAL</span><strong>Price intelligence, with a human reason behind every change.</strong><button className="text-button" onClick={() => goTo("catalog")}>Explore the catalog <span>â†’</span></button></div></section>}
          <p className="footer-note"><span>â—</span> Cost basis: inventory_items_cost_and_price_07-09-2026.xlsx Â· Values shown in USD Â· Local edits are saved to this device and synced when the ledger API is available.</p>
        </div>
      </section>

      {editing && <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditing(null)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setEditing(null)} aria-label="Close">Ã—</button><div className="section-kicker">Update catalog price</div><h3 id="edit-title">{editing.id}</h3><p className="modal-subtitle">Current price <strong>{money(editing.price)}</strong> Â· Cost {money(editing.cost)}</p><label>New price<input type="number" min="0" step="0.01" value={draftPrice} onChange={(event) => setDraftPrice(event.target.value)} autoFocus /></label><label>Why is this changing?<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Supplier cost update, seasonal campaignâ€¦" /></label><div className="modal-foot"><span>Every change is added to the audit trail.</span><div><button className="ghost-button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-button" onClick={saveEdit}>Save price change <span>â†’</span></button></div></div></div></div>}
      {toast && <div className="toast" role="status"><span>âœ“</span>{toast}</div>}
    </main>
  );
}

