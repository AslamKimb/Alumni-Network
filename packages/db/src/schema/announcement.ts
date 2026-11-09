import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { event } from "./event";

export const announcement = sqliteTable(
  "announcement",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    status: text("status").notNull(),
    audience: text("audience").notNull().default("all"),
    coverImageUrl: text("cover_image_url"),
    relatedEventId: text("related_event_id").references((): any => event.id, {
      onDelete: "set null",
    }),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("announcement_status_published_at_idx").on(table.status, table.publishedAt)],
);
