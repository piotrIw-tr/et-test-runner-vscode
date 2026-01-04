import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { z } from 'zod';
import { execa } from 'execa';
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

/**
 * Try to get projects from Nx CLI (much faster than glob scanning)
 */
async function tryNxShowProjects(workspaceRoot: string, log: (msg: string) => void): Promise<string[] | null> {
  try {
    log(`[TIMING] Trying 'nx show projects'...`);
    const start = Date.now();
    const result = await execa('npx', ['nx', 'show', 'projects'], { 
      cwd: workspaceRoot,
      timeout: 30000, // 30 second timeout
      reject: false 
    });
    
    if (result.exitCode === 0 && result.stdout) {
      const projects = result.stdout.split('\n').filter(Boolean);
      log(`[TIMING] 'nx show projects' returned ${projects.length} projects in ${Date.now() - start}ms`);
      return projects;
    }
    log(`[TIMING] 'nx show projects' failed (exit ${result.exitCode}), falling back to glob`);
    return null;
  } catch (error) {
    log(`[TIMING] 'nx show projects' error: ${error}, falling back to glob`);
    return null;
  }
}

/**
 * Read project.json for a specific project directory
 */
async function readProjectJson(projectRoot: string): Promise<{ name: string; runner: RunnerType; sourceRootAbs?: string } | null> {
  try {
    const projectJsonPath = path.join(projectRoot, 'project.json');
    const raw = await fs.readFile(projectJsonPath, 'utf8');
    const parsed = ProjectJsonSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    
    const name = parsed.data.name;
    if (!name) return null;
    
    const testExecutor = parsed.data.targets?.test?.executor;
    const runner = runnerFromExecutor(testExecutor);
    const sourceRootAbs = parsed.data.sourceRoot 
      ? path.resolve(projectRoot, '..', parsed.data.sourceRoot) 
      : undefined;
    
    return { name, runner, sourceRootAbs };
  } catch {
    return null;
  }
}

export async function indexProjects(workspaceRoot: string, log?: (msg: string) => void): Promise<ProjectInfo[]> {
  const startTime = Date.now();
  const logFn = log || console.log;
  
  // Try Nx CLI first (much faster if Nx daemon is running)
  const nxProjects = await tryNxShowProjects(workspaceRoot, logFn);
  
  if (nxProjects && nxProjects.length > 0) {
    // Use Nx project list to find project.json files directly
    logFn(`[TIMING] Using Nx project list to find project.json files...`);
    const findStart = Date.now();
    
    const projects: ProjectInfo[] = [];
    
    // Try common project locations based on Nx conventions
    const projectPromises = nxProjects.map(async (projectName) => {
      // Try libs/ and apps/ directories
      const possiblePaths = [
        path.join(workspaceRoot, 'libs', projectName),
        path.join(workspaceRoot, 'apps', projectName),
        // Handle scoped projects like @scope/project -> libs/scope/project
        path.join(workspaceRoot, 'libs', ...projectName.replace('@', '').split('/')),
        path.join(workspaceRoot, 'apps', ...projectName.replace('@', '').split('/')),
      ];
      
      for (const projectRoot of possiblePaths) {
        const projectJsonPath = path.join(projectRoot, 'project.json');
        try {
          await fs.access(projectJsonPath);
          const info = await readProjectJson(projectRoot);
          if (info) {
            return {
              name: info.name,
              projectJsonPath,
              rootAbs: projectRoot,
              sourceRootAbs: info.sourceRootAbs,
              runner: info.runner,
            };
          }
        } catch {
          // Path doesn't exist, try next
        }
      }
      return null;
    });
    
    const results = await Promise.all(projectPromises);
    for (const result of results) {
      if (result) projects.push(result);
    }
    
    logFn(`[TIMING] Found ${projects.length} projects from Nx list in ${Date.now() - findStart}ms`);
    projects.sort((a, b) => a.name.localeCompare(b.name));
    logFn(`[TIMING] indexProjects TOTAL: ${Date.now() - startTime}ms`);
    return projects;
  }
  
  // Fallback to glob scanning
  logFn(`[TIMING] indexProjects: scanning for project.json files with glob...`);
  const globStart = Date.now();
  const projectJsonPaths = await fg('**/project.json', {
    cwd: workspaceRoot,
    absolute: true,
    dot: false,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  });
  logFn(`[TIMING] indexProjects: glob found ${projectJsonPaths.length} project.json files in ${Date.now() - globStart}ms`);

  const projects: ProjectInfo[] = [];
  const parseStart = Date.now();

  // Parse in parallel for speed
  const parsePromises = projectJsonPaths.map(async (projectJsonPath) => {
    try {
      const raw = await fs.readFile(projectJsonPath, 'utf8');
      const parsed = ProjectJsonSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return null;

      const name = parsed.data.name;
      if (!name) return null;

      const rootAbs = path.dirname(projectJsonPath);
      const testExecutor = parsed.data.targets?.test?.executor;
      const runner = runnerFromExecutor(testExecutor);

      const sourceRootAbs = parsed.data.sourceRoot
        ? path.resolve(workspaceRoot, parsed.data.sourceRoot)
        : undefined;

      return {
        name,
        projectJsonPath,
        rootAbs,
        sourceRootAbs,
        runner,
      };
    } catch {
      return null;
    }
  });
  
  const parseResults = await Promise.all(parsePromises);
  for (const result of parseResults) {
    if (result) projects.push(result);
  }

  logFn(`[TIMING] indexProjects: parsed ${projects.length} projects in ${Date.now() - parseStart}ms`);

  // Sort projects by name for consistent ordering
  projects.sort((a, b) => a.name.localeCompare(b.name));
  
  logFn(`[TIMING] indexProjects TOTAL: ${Date.now() - startTime}ms`);
  return projects;
}


