import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

// Deviation from PRODUCT §5: `starts_at` is nullable here (spec says NOT NULL)
// so drafts can be saved without a start date. Publishing enforces its presence.
export const event = sqliteTable(
  "event",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    body: text("body").notNull().default(""),
    category: text("category").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    location: text("location"),
    isOnline: integer("is_online", { mode: "boolean" }).notNull().default(false),
    coverImageUrl: text("cover_image_url"),
    status: text("status").notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    seriesId: text("series_id"),
    recurrenceFreq: text("recurrence_freq"),
    recurrenceInterval: integer("recurrence_interval"),
    recurrenceEnd: integer("recurrence_end", { mode: "timestamp_ms" }),
    exceptionDates: text("exception_dates"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("event_status_starts_at_idx").on(table.status, table.startsAt)],
);
