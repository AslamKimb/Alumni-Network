import type { Session } from "@Alumni-Network/auth";
import type { Database } from "@Alumni-Network/db";

export type Context = {
  session: Session | null;
  db: Database;
};
