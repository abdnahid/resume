/**
 * Fail if any `"use client"` component can reach `@/lib/prisma`.
 *
 * **The bug this catches has now happened twice**, and it is invisible to
 * `tsc`: a client component importing a *value* from a module that queries
 * drags `pg` into the browser bundle, and the page 500s with
 * `Can't resolve 'fs'` at request time. The rule has been in CLAUDE.md since
 * `lib/store/bds-catalog.ts` was split from `lib/store/bds.ts`; this is the
 * check that enforces it.
 *
 * **`import type` is ignored**, because types are erased and never reach the
 * bundle — which is also the cheapest fix when this fires: if you only need the
 * shape, import it as a type. If you need a value, move it to the Prisma-free
 * half (`lib/desks-view.ts`, `lib/desk-title.ts`, `lib/store/bds-catalog.ts`).
 *
 * `npm run check:bundle`
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
const ROOT = process.cwd();
const walk = (d, out = []) => {
  for (const e of readdirSync(d)) {
    if (e === "node_modules" || e === ".next" || e === "generated" || e === ".git") continue;
    const p = join(d, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
};
const files = walk(ROOT);
const readSafe = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };
const resolveImport = (from, spec) => {
  let base;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    if (existsSync(base + ext)) return base + ext;
  }
  return existsSync(base) && statSync(base).isFile() ? base : null;
};
const imports = (p) => {
  const src = readSafe(p);
  const out = [];
  // Skip `import type { … }` — types are erased and never reach the bundle.
  for (const m of src.matchAll(/^\s*import\s+(?!type\s)([^;]*?)from\s+["']([^"']+)["']/gm)) {
    out.push({ clause: m[1], spec: m[2] });
  }
  return out;
};
const reachesPrisma = (p, seen = new Set()) => {
  if (seen.has(p)) return null;
  seen.add(p);
  if (p.endsWith("/lib/prisma.ts")) return [p];
  for (const { clause, spec } of imports(p)) {
    // An import whose every specifier is `type X` is erased too.
    const names = clause.replace(/[{}]/g, "").split(",").map((s) => s.trim()).filter(Boolean);
    if (names.length && names.every((n) => n.startsWith("type "))) continue;
    const next = resolveImport(p, spec);
    if (!next) continue;
    const chain = reachesPrisma(next, seen);
    if (chain) return [p, ...chain];
  }
  return null;
};
const bad = [];
for (const f of files) {
  const src = readSafe(f);
  if (!/^\s*["']use client["']/m.test(src)) continue;
  const chain = reachesPrisma(f);
  if (chain) bad.push(chain);
}
if (!bad.length) {
  console.log("OK — no client component reaches @/lib/prisma");
} else {
  for (const c of bad) {
    console.error("LEAK: " + c.map((x) => x.replace(ROOT + "/", "")).join("\n   -> "));
  }
  console.error(`\n${bad.length} client component(s) would pull pg into the browser bundle.`);
  process.exit(1);
}
