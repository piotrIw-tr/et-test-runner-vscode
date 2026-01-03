import fs from "node:fs/promises";
import path from "node:path";

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export interface NxCli {
  command: string;
  prefixArgs: string[];
}

export async function resolveNxCli(workspaceRoot: string): Promise<NxCli> {
  const binName = process.platform === "win32" ? "nx.cmd" : "nx";
  const localNx = path.join(workspaceRoot, "node_modules", ".bin", binName);
  if (await pathExists(localNx)) {
    return { command: localNx, prefixArgs: [] };
  }
  return { command: "npx", prefixArgs: ["nx"] };
}
