import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { parse as parseYaml } from "yaml";
import { packSchema, type Pack } from "./schema";
import { compileRule, type CompiledRule } from "../core";

const CORE_DIR = path.join(process.cwd(), "lib", "categorize", "packs", "core");

function isYamlFile(file: string): boolean {
  return /\.ya?ml$/i.test(file);
}

function listYamlFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter(isYamlFile)
    .sort()
    .map((f) => path.join(dir, f));
}

function readPackFile(file: string): Pack {
  const raw = fs.readFileSync(file, "utf8");
  const data = parseYaml(raw);
  const result = packSchema.safeParse(data);
  if (!result.success) {
    throw new Error(
      `Invalid pattern pack "${file}": ${result.error.issues
        .map((i) => `${i.path.join(".")} ${i.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}

/**
 * Open-source default packs (`lib/categorize/packs/core/*.yaml`). These are
 * seeded into the `rules` table at db:migrate time.
 */
export function loadCorePacks(): Pack[] {
  if (!fs.existsSync(CORE_DIR)) return [];
  return listYamlFiles(CORE_DIR).map(readPackFile);
}

/**
 * Resolve one `PATTERN_PACKS` entry to a list of YAML files. An entry may be:
 *  - a path to a `.yaml`/`.yml` file,
 *  - a path to a directory (all top-level YAML files are loaded), or
 *  - an installed package name (its `packs/` dir, or the package root, is read).
 */
function resolvePackEntry(entry: string): string[] {
  if (fs.existsSync(entry)) {
    return fs.statSync(entry).isDirectory() ? listYamlFiles(entry) : [entry];
  }
  // Best-effort: treat the entry as an installed package name.
  try {
    const req = createRequire(path.join(process.cwd(), "package.json"));
    const pkgJson = req.resolve(`${entry}/package.json`);
    const pkgDir = path.dirname(pkgJson);
    const packsDir = path.join(pkgDir, "packs");
    return fs.existsSync(packsDir) ? listYamlFiles(packsDir) : listYamlFiles(pkgDir);
  } catch {
    console.warn(`[banquejs] PATTERN_PACKS entry not found, skipping: ${entry}`);
    return [];
  }
}

/**
 * Extra packs loaded at runtime from the `PATTERN_PACKS` env var
 * (comma-separated entries). Applied as a fallback layer below the DB rules;
 * never written to the DB. Used for personal/local packs and the proprietary
 * SaaS "premium" pack.
 */
export function loadRuntimePacks(): Pack[] {
  const env = process.env.PATTERN_PACKS?.trim();
  if (!env) return [];
  const packs: Pack[] = [];
  for (const entry of env.split(",").map((s) => s.trim()).filter(Boolean)) {
    for (const file of resolvePackEntry(entry)) {
      try {
        packs.push(readPackFile(file));
      } catch (err) {
        console.warn(`[banquejs] skipping invalid pattern pack: ${(err as Error).message}`);
      }
    }
  }
  return packs;
}

/**
 * Compile runtime-pack rules into CompiledRules, mapping each pack category to
 * an existing category id by name. Rules whose category does not exist are
 * skipped (runtime packs must not create categories). Synthetic negative ids
 * keep them distinct from DB rule ids.
 */
export function compilePackRules(
  packs: Pack[],
  categoryIdByName: Map<string, number>,
): CompiledRule[] {
  const out: CompiledRule[] = [];
  let synthId = -300000;
  for (const pack of packs) {
    for (const cat of pack.categories) {
      const categoryId = categoryIdByName.get(cat.name);
      if (categoryId == null) continue;
      for (const rule of cat.rules) {
        const compiled = compileRule({
          id: synthId--,
          categoryId,
          pattern: rule.pattern,
          matchType: rule.matchType ?? "contains",
          amountCondition: rule.amountCondition ?? "any",
          priority: rule.priority ?? 100,
          isActive: true,
          createdAt: new Date(),
        });
        if (compiled) out.push(compiled);
      }
    }
  }
  return out;
}
