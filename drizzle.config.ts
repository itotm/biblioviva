// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "sqlite",
	schema: "./src/lib/server/db/schema.ts",
	out: "./drizzle",
	dbCredentials: { url: process.env.DATABASE_PATH ?? "local/data/db/biblioviva.db" },
	verbose: true,
});
