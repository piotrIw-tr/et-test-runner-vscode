import fs from 'node:fs/promises';
import path from 'node:path';

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function findNxJsonInDir(dir: string): Promise<string | null> {
  const nxJson = path.join(dir, 'nx.json');
  if (await fileExists(nxJson)) return dir;
  return null;
}

export async function findWorkspaceRoot(startDir: string): Promise<string> {
  const resolvedStart = path.resolve(startDir);

  // First check if nx.json is in the start directory itself
  if (await findNxJsonInDir(resolvedStart)) {
    return resolvedStart;
  }

  // Check common subdirectory patterns (for monorepos where nx workspace is nested)
  // e.g., etoro-assets/etoro/nx.json
  try {
    const entries = await fs.readdir(resolvedStart, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const subDir = path.join(resolvedStart, entry.name);
        const found = await findNxJsonInDir(subDir);
        if (found) return found;
      }
    }
  } catch {
    // Ignore errors reading directory
  }

  // Walk up to filesystem root
  let dir = resolvedStart;
  while (true) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
    
    const found = await findNxJsonInDir(dir);
    if (found) return found;
  }

  throw new Error(`Could not find nx.json from: ${startDir}`);
}


