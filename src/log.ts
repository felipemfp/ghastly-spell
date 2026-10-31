type Level = "info" | "error";

// One JSON line per event, read with `wrangler tail`. Event names are listed in SPEC.md (Observability).
export function log(event: string, data: Record<string, unknown> = {}, level: Level = "info"): void {
  console.log(JSON.stringify({ event, level, ...data }));
}
