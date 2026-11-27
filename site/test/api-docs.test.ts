import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = path.resolve("site/src/pages/api/v1");

function endpoints(dir = apiRoot): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...endpoints(full));
    } else if (entry.endsWith(".ts")) {
      const route = path.relative(apiRoot, full).split(path.sep).join("/").replace(/\.ts$/, "");
      found.push(`/api/v1/${route}`);
    }
  }
  return found.sort();
}

function normalize(route: string): string {
  return route.replace(/<[^>]+>/g, "*").replace(/\[[^\]]+\]/g, "*");
}

function documented(): string[] {
  return readFileSync("README.md", "utf8")
    .split("\n")
    .filter((line) => /^\|\s*`\/api\/v1\//.test(line))
    .map((line) => line.split("|")[1]!.trim().replace(/`/g, ""));
}

describe("README JSON API table", () => {
  it("documents exactly the endpoints that exist", () => {
    const routes = endpoints().map(normalize).sort();
    const docs = documented().map(normalize).sort();

    expect(docs.length).toBeGreaterThan(0);
    expect(docs).toEqual(routes);
  });
});
