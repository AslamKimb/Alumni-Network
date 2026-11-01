import { createAuth } from "@Alumni-Network/auth";
import { createDb } from "@Alumni-Network/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
