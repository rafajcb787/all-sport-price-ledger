import { real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const inventoryPrices = sqliteTable("inventory_prices", {
  itemId: text("item_id").primaryKey(),
  price: real("price").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const priceHistory = sqliteTable("price_history", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull(),
  fromPrice: real("from_price").notNull(),
  toPrice: real("to_price").notNull(),
  reason: text("reason").notNull(),
  changedBy: text("changed_by").notNull(),
  changedAt: text("changed_at").notNull(),
});

