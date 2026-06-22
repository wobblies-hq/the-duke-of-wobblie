import { describe, it, expect } from "vitest";

// Test the diff parsing logic by extracting it
const SKIP_PATTERNS = [
  /^pnpm-lock\.yaml$/,
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /\.snap$/,
  /\.svg$/,
  /\.png$/,
  /\.jpg$/,
  /\.ico$/,
  /\.woff2?$/,
  /\.map$/,
  /^\.env/,
  /generated/i,
  /dist\//,
  /\.d\.ts$/,
];

const PRIORITY_PATTERNS = [
  /auth/i, /middleware/i, /security/i, /migration/i,
  /routes?\.(ts|js)$/, /api\//, /packages\/db/,
  /packages\/core/,
];

interface FileDiff {
  path: string;
  content: string;
  priority: number;
}

function parseDiffIntoFiles(diff: string): FileDiff[] {
  const files: FileDiff[] = [];
  const parts = diff.split(/^diff --git /m).filter(Boolean);

  for (const part of parts) {
    const pathMatch = part.match(/^a\/(.+?) b\//);
    if (!pathMatch) continue;
    const path = pathMatch[1];
    if (SKIP_PATTERNS.some((p) => p.test(path))) continue;
    const priority = PRIORITY_PATTERNS.some((p) => p.test(path)) ? 0 : 1;
    files.push({ path, content: `diff --git ${part}`, priority });
  }

  return files.sort((a, b) => a.priority - b.priority);
}

describe("parseDiffIntoFiles", () => {
  it("parses a multi-file diff", () => {
    const diff = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,4 @@
+import { foo } from "./foo";
 const x = 1;
diff --git a/src/auth.ts b/src/auth.ts
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1 +1,2 @@
+export const secret = "abc";
`;

    const files = parseDiffIntoFiles(diff);
    expect(files).toHaveLength(2);
    expect(files[0].path).toBe("src/auth.ts"); // priority file first
    expect(files[1].path).toBe("src/index.ts");
  });

  it("skips lockfiles and generated files", () => {
    const diff = `diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -1 +1,2 @@
+something
diff --git a/src/types.d.ts b/src/types.d.ts
--- a/src/types.d.ts
+++ b/src/types.d.ts
@@ -1 +1,2 @@
+type Foo = string;
diff --git a/src/real.ts b/src/real.ts
--- a/src/real.ts
+++ b/src/real.ts
@@ -1 +1,2 @@
+const y = 2;
`;

    const files = parseDiffIntoFiles(diff);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("src/real.ts");
  });

  it("prioritizes auth/api/migration files", () => {
    const diff = `diff --git a/apps/web/page.tsx b/apps/web/page.tsx
--- a/apps/web/page.tsx
+++ b/apps/web/page.tsx
@@ -1 +1 @@
+<div>hi</div>
diff --git a/apps/api/routes.ts b/apps/api/routes.ts
--- a/apps/api/routes.ts
+++ b/apps/api/routes.ts
@@ -1 +1 @@
+app.get("/health", () => "ok");
diff --git a/packages/db/migrations/001.ts b/packages/db/migrations/001.ts
--- a/packages/db/migrations/001.ts
+++ b/packages/db/migrations/001.ts
@@ -1 +1 @@
+export const up = () => {};
`;

    const files = parseDiffIntoFiles(diff);
    expect(files[0].path).toBe("apps/api/routes.ts");
    expect(files[1].path).toBe("packages/db/migrations/001.ts");
    expect(files[2].path).toBe("apps/web/page.tsx");
  });
});
