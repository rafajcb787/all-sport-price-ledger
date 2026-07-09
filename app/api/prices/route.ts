export const dynamic = "force-dynamic";

type PriceEntry = { itemId: string; from: number; to: number; reason: string; changedBy?: string; changedAt?: string; id?: string };

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
}

export async function GET() {
  try {
    const db = await getDatabase();
    if (!db) return Response.json({ items: {}, history: [] });
    await ensureSchema(db);
    const [prices, history] = await Promise.all([
      db.prepare("SELECT item_id, price FROM inventory_prices").all<{ item_id: string; price: number }>(),
      db.prepare("SELECT id, item_id, from_price as fromPrice, to_price as toPrice, reason, changed_by as changedBy, changed_at as changedAt FROM price_history ORDER BY changed_at DESC").all<{ id: string; item_id: string; fromPrice: number; toPrice: number; reason: string; changedBy: string; changedAt: string }>(),
    ]);
    return Response.json({ items: Object.fromEntries((prices.results ?? []).map((row) => [row.item_id, row.price])), history: (history.results ?? []).map((row) => ({ id: row.id, itemId: row.item_id, from: row.fromPrice, to: row.toPrice, reason: row.reason, changedBy: row.changedBy, changedAt: row.changedAt })) });
  } catch {
    return Response.json({ items: {}, history: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as PriceEntry;
    if (!body.itemId || !Number.isFinite(body.to) || !body.reason?.trim()) return Response.json({ error: "itemId, to, and reason are required" }, { status: 400 });
    const db = await getDatabase();
    if (!db) return Response.json({ error: "Ledger persistence is not available in this environment." }, { status: 503 });
    await ensureSchema(db);
    const changedAt = body.changedAt ?? new Date().toISOString();
    const id = body.id ?? `${body.itemId}-${Date.now()}`;
    await db.batch([
      db.prepare("INSERT INTO inventory_prices (item_id, price, updated_at) VALUES (?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET price=excluded.price, updated_at=excluded.updated_at").bind(body.itemId, body.to, changedAt),
      db.prepare("INSERT OR IGNORE INTO price_history (id, item_id, from_price, to_price, reason, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, body.itemId, body.from ?? 0, body.to, body.reason.trim(), body.changedBy ?? "You", changedAt),
    ]);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Ledger persistence is not available in this environment." }, { status: 503 });
  }
}

