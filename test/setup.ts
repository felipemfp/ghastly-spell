import { applyD1Migrations, env } from "cloudflare:test";
import { beforeEach } from "vitest";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// D1 storage is shared by every test in a file, so start each test from empty tables.
beforeEach(async () => {
  await env.DB.batch([env.DB.prepare("DELETE FROM channel_overrides"), env.DB.prepare("DELETE FROM matches")]);
});
