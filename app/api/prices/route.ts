export const dynamic = "force-dynamic";

type ChangeEntry = { itemId: string; field?: "price" | "cost"; from: number; to: number; reason: string; changedBy?: string; changedAt?: string; id?: string };

async function getDatabase(): Promise<D1Database | null> {
  try {
    // Keep the worker-only module out of local Windows ARM builds; Cloudflare
    // resolves it in the deployed worker runtime.
    const runtime = await (0, eval)("import('cloudflare:workers')");
    return runtime.env?.DB ?? null;
  } catch {
    return null;
  }
}

async function ensureSchema(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS inventory_prices (item_id TEXT PRIMARY KEY, price REAL NOT NULL, updated_at TEXT NOT NULL)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS price_history (id TEXT PRIMARY KEY, item_id TEXT NOT NULL, from_price REAL NOT NULL, to_price REAL NOT NULL, reason TEXT NOT NULL, changed_by TEXT NOT NULL, changed_at TEXT NOT NULL)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS inventory_costs (item_id TEXT PRIMARY KEY, cost REAL NOT NULL, updated_at TEXT NOT NULL)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS cost_history (id TEXT PRIMARY KEY, item_id TEXT NOT NULL, from_cost REAL NOT NULL, to_cost REAL NOT NULL, reason TEXT NOT NULL, changed_by TEXT NOT NULL, changed_at TEXT NOT NULL)`).run();
}

export async function GET() {
  try {
    const db = await getDatabase();
    if (!db) return Response.json({ items: {}, costs: {}, history: [] });
    await ensureSchema(db);
    const [prices, costs, priceHistory, costHistory] = await Promise.all([
      db.prepare("SELECT item_id, price FROM inventory_prices").all<{ item_id: string; price: number }>(),
      db.prepare("SELECT item_id, cost FROM inventory_costs").all<{ item_id: string; cost: number }>(),
      db.prepare("SELECT id, item_id, from_price as fromPrice, to_price as toPrice, reason, changed_by as changedBy, changed_at as changedAt FROM price_history").all<{ id: string; item_id: string; fromPrice: number; toPrice: number; reason: string; changedBy: string; changedAt: string }>(),
      db.prepare("SELECT id, item_id, from_cost as fromCost, to_cost as toCost, reason, changed_by as changedBy, changed_at as changedAt FROM cost_history").all<{ id: string; item_id: string; fromCost: number; toCost: number; reason: string; changedBy: string; changedAt: string }>(),
    ]);
    const history = [
      ...(priceHistory.results ?? []).map((row) => ({ id: row.id, itemId: row.item_id, field: "price" as const, from: row.fromPrice, to: row.toPrice, reason: row.reason, changedBy: row.changedBy, changedAt: row.changedAt })),
      ...(costHistory.results ?? []).map((row) => ({ id: row.id, itemId: row.item_id, field: "cost" as const, from: row.fromCost, to: row.toCost, reason: row.reason, changedBy: row.changedBy, changedAt: row.changedAt })),
    ].sort((a, b) => b.changedAt.localeCompare(a.changedAt));
    return Response.json({ items: Object.fromEntries((prices.results ?? []).map((row) => [row.item_id, row.price])), costs: Object.fromEntries((costs.results ?? []).map((row) => [row.item_id, row.cost])), history });
  } catch {
    return Response.json({ items: {}, costs: {}, history: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as ChangeEntry;
    const field = body.field ?? "price";
    if ((field !== "price" && field !== "cost") || !body.itemId || !Number.isFinite(body.to) || body.to < 0 || !body.reason?.trim() || !body.changedBy?.trim()) return Response.json({ error: "itemId, field, to, reason, and changedBy are required" }, { status: 400 });
    const db = await getDatabase();
    if (!db) return Response.json({ error: "Ledger persistence is not available in this environment." }, { status: 503 });
    await ensureSchema(db);
    const changedAt = body.changedAt ?? new Date().toISOString();
    const id = body.id ?? `${body.itemId}-${field}-${Date.now()}`;
    const statement = field === "cost"
      ? db.batch([
        db.prepare("INSERT INTO inventory_costs (item_id, cost, updated_at) VALUES (?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET cost=excluded.cost, updated_at=excluded.updated_at").bind(body.itemId, body.to, changedAt),
        db.prepare("INSERT OR IGNORE INTO cost_history (id, item_id, from_cost, to_cost, reason, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, body.itemId, body.from ?? 0, body.to, body.reason.trim(), body.changedBy.trim(), changedAt),
      ])
      : db.batch([
        db.prepare("INSERT INTO inventory_prices (item_id, price, updated_at) VALUES (?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET price=excluded.price, updated_at=excluded.updated_at").bind(body.itemId, body.to, changedAt),
        db.prepare("INSERT OR IGNORE INTO price_history (id, item_id, from_price, to_price, reason, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, body.itemId, body.from ?? 0, body.to, body.reason.trim(), body.changedBy.trim(), changedAt),
      ]);
    await statement;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Ledger persistence is not available in this environment." }, { status: 503 });
  }
}

