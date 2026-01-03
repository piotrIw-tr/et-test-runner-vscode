import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const NxJsonSchema = z
  .object({
    affected: z
      .object({
        defaultBase: z.string().optional(),
      })
      .optional(),
    defaultBase: z.string().optional(),
  })
  .passthrough();

export interface NxConfig {
  affectedDefaultBase?: string;
  defaultBase?: string;
}

export async function loadNxConfig(workspaceRoot: string): Promise<NxConfig> {
  const nxJsonPath = path.join(workspaceRoot, 'nx.json');
  const raw = await fs.readFile(nxJsonPath, 'utf8');
  const parsed = NxJsonSchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    // Don’t hard-fail: workspace can still be usable with defaults.
    return {};
  }

  return {
    affectedDefaultBase: parsed.data.affected?.defaultBase,
    defaultBase: parsed.data.defaultBase,
  };
}


