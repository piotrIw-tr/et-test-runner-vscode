import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { z } from 'zod';
import type { ProjectInfo, RunnerType } from '../../types/model.js';

const ProjectJsonSchema = z
  .object({
    name: z.string().optional(),
    sourceRoot: z.string().optional(),
    targets: z
      .record(
        z.string(),
        z
          .object({
            executor: z.string().optional(),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

function runnerFromExecutor(executor?: string): RunnerType {
  if (!executor) return 'unknown';
  // Jest executors: @nx/jest:jest, @nrwl/jest:jest
  if (executor.includes(':jest')) return 'jest';
  // Karma executors: @angular-devkit/build-angular:karma, @nx/angular:karma, @nrwl/angular:karma
  if (executor.includes(':karma')) return 'karma';
  return 'unknown';
}

export async function indexProjects(workspaceRoot: string): Promise<ProjectInfo[]> {
  const projectJsonPaths = await fg('**/project.json', {
    cwd: workspaceRoot,
    absolute: true,
    dot: false,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  });

  const projects: ProjectInfo[] = [];

  for (const projectJsonPath of projectJsonPaths) {
    const raw = await fs.readFile(projectJsonPath, 'utf8');
    const parsed = ProjectJsonSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) continue;

    const name = parsed.data.name;
    if (!name) continue;

    const rootAbs = path.dirname(projectJsonPath);
    const testExecutor = parsed.data.targets?.test?.executor;
    const runner = runnerFromExecutor(testExecutor);

    const sourceRootAbs = parsed.data.sourceRoot
      ? path.resolve(workspaceRoot, parsed.data.sourceRoot)
      : undefined;

    projects.push({
      name,
      projectJsonPath,
      rootAbs,
      sourceRootAbs,
      runner,
    });
  }

  // Sort projects by name for consistent ordering
  projects.sort((a, b) => a.name.localeCompare(b.name));
  
  return projects;
}


