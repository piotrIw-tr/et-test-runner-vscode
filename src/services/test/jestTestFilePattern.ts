import path from "node:path";

function escapeRegex(s: string): string {
  // Escape regex metacharacters for a safe alternation pattern.
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildJestTestFileRegex(
  workspaceRoot: string,
  specAbsPaths: string[]
): string {
  const rels = specAbsPaths.map((p) =>
    path.relative(workspaceRoot, p).split(path.sep).join("/")
  );

  const escaped = rels.map(escapeRegex);
  if (escaped.length === 1) return escaped[0]!;
  return `(${escaped.join("|")})`;
}
