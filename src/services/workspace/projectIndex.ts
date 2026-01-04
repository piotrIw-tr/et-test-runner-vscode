import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
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

interface NxProjectNode {
  name: string;
  type: string;
  data: {
    root: string;
    sourceRoot?: string;
    targets?: Record<string, { executor?: string }>;
  };
}

interface NxGraph {
  nodes: Record<string, NxProjectNode>;
}

/**
 * Try to get full project graph from Nx (single call, all info)
 * Uses a temp file to avoid stdout truncation issues with large graphs
 */
async function tryNxGraph(workspaceRoot: string, log: (msg: string) => void): Promise<NxGraph | null> {
  const tempFile = path.join(os.tmpdir(), `nx-graph-${Date.now()}.json`);
  
  try {
    log(`[TIMING] Trying 'nx graph --file=${path.basename(tempFile)}'...`);
    const start = Date.now();
    const result = await execa('npx', ['nx', 'graph', `--file=${tempFile}`], { 
      cwd: workspaceRoot,
      timeout: 60000, // 60 second timeout (graph can be slow)
      reject: false 
    });
    
    if (result.exitCode === 0) {
      try {
        const content = await fs.readFile(tempFile, 'utf8');
        const graph = JSON.parse(content) as { graph?: NxGraph };
        if (graph.graph?.nodes) {
          const nodeCount = Object.keys(graph.graph.nodes).length;
          log(`[TIMING] 'nx graph' returned ${nodeCount} projects in ${Date.now() - start}ms`);
          return graph.graph;
        }
      } finally {
        // Clean up temp file
        await fs.unlink(tempFile).catch(() => {});
      }
    }
    log(`[TIMING] 'nx graph' failed (exit ${result.exitCode}), trying 'nx show projects'...`);
    return null;
  } catch (error) {
    log(`[TIMING] 'nx graph' error: ${error}, trying fallback...`);
    // Clean up temp file on error
    await fs.unlink(tempFile).catch(() => {});
    return null;
  }
}

/**
 * Try to get projects from Nx CLI (fallback if graph doesn't work)
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

export interface IndexProjectsOptions {
  log?: (msg: string) => void;
  onProgress?: (status: string) => void;
}

export async function indexProjects(workspaceRoot: string, options?: IndexProjectsOptions): Promise<ProjectInfo[]> {
  const startTime = Date.now();
  const logFn = options?.log || console.log;
  const progressFn = options?.onProgress || (() => {});
  
  // Try Nx graph first (single call, all project info)
  progressFn('Loading Nx project graph...');
  const nxGraph = await tryNxGraph(workspaceRoot, logFn);
  
  if (nxGraph && Object.keys(nxGraph.nodes).length > 0) {
    progressFn(`Processing ${Object.keys(nxGraph.nodes).length} projects from graph...`);
    logFn(`[TIMING] Processing Nx graph nodes...`);
    const processStart = Date.now();
    
    const projects: ProjectInfo[] = [];
    const entries = Object.entries(nxGraph.nodes);
    
    for (let i = 0; i < entries.length; i++) {
      const [projectName, node] = entries[i];
      if (!node.data?.root) continue;
      
      const projectRoot = path.join(workspaceRoot, node.data.root);
      const projectJsonPath = path.join(projectRoot, 'project.json');
      const testExecutor = node.data.targets?.test?.executor;
      const runner = runnerFromExecutor(testExecutor);
      
      projects.push({
        name: projectName,
        projectJsonPath,
        rootAbs: projectRoot,
        sourceRootAbs: node.data.sourceRoot ? path.join(workspaceRoot, node.data.sourceRoot) : undefined,
        runner,
      });
      
      // Update progress every 20 projects
      if (i % 20 === 0) {
        progressFn(`Processing projects... ${i + 1}/${entries.length}`);
      }
    }
    
    logFn(`[TIMING] Processed ${projects.length} projects from graph in ${Date.now() - processStart}ms`);
    projects.sort((a, b) => a.name.localeCompare(b.name));
    logFn(`[TIMING] indexProjects TOTAL: ${Date.now() - startTime}ms`);
    return projects;
  }
  
  // Fallback: Try nx show projects + individual lookups
  progressFn('Getting project list from Nx...');
  const nxProjects = await tryNxShowProjects(workspaceRoot, logFn);
  
  if (nxProjects && nxProjects.length > 0) {
    // Use 'nx show project <name> --json' to get exact project roots
    // This is more reliable than guessing paths
    progressFn(`Found ${nxProjects.length} projects, resolving paths...`);
    logFn(`[TIMING] Using Nx project list to find project.json files...`);
    const findStart = Date.now();
    
    const projects: ProjectInfo[] = [];
    let foundViaShow = 0;
    let foundViaGuess = 0;
    
    // Process projects in batches to avoid too many concurrent processes
    const batchSize = 20;
    for (let i = 0; i < nxProjects.length; i += batchSize) {
      const batch = nxProjects.slice(i, i + batchSize);
      progressFn(`Resolving projects ${i + 1}-${Math.min(i + batchSize, nxProjects.length)} of ${nxProjects.length}...`);
      
      const projectPromises = batch.map(async (projectName) => {
        // First try common paths (fast)
        const possiblePaths = [
          path.join(workspaceRoot, 'libs', projectName),
          path.join(workspaceRoot, 'apps', projectName),
          // Handle hyphenated names that might be nested: wallet-dashboard -> wallet/dashboard
          path.join(workspaceRoot, 'libs', ...projectName.split('-')),
          path.join(workspaceRoot, 'apps', ...projectName.split('-')),
          // Handle scoped projects like @scope/project -> libs/scope/project
          path.join(workspaceRoot, 'libs', ...projectName.replace('@', '').split('/')),
          path.join(workspaceRoot, 'apps', ...projectName.replace('@', '').split('/')),
        ];
        
        for (const projectRoot of possiblePaths) {
          const projectJsonPath = path.join(projectRoot, 'project.json');
          try {
            await fs.access(projectJsonPath);
            const info = await readProjectJson(projectRoot);
            if (info && info.name === projectName) {
              foundViaGuess++;
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
        
        // If guessing failed, try 'nx show project <name> --json' to get the exact root
        try {
          const result = await execa('npx', ['nx', 'show', 'project', projectName, '--json'], {
            cwd: workspaceRoot,
            timeout: 5000,
            reject: false
          });
          
          if (result.exitCode === 0 && result.stdout) {
            const projectInfo = JSON.parse(result.stdout);
            if (projectInfo.root) {
              const projectRoot = path.join(workspaceRoot, projectInfo.root);
              const projectJsonPath = path.join(projectRoot, 'project.json');
              const testExecutor = projectInfo.targets?.test?.executor;
              const runner = runnerFromExecutor(testExecutor);
              
              foundViaShow++;
              return {
                name: projectName,
                projectJsonPath,
                rootAbs: projectRoot,
                sourceRootAbs: projectInfo.sourceRoot ? path.join(workspaceRoot, projectInfo.sourceRoot) : undefined,
                runner,
              };
            }
          }
        } catch {
          // Failed to get project info
        }
        
        return null;
      });
      
      const results = await Promise.all(projectPromises);
      for (const result of results) {
        if (result) projects.push(result);
      }
    }
    
    logFn(`[TIMING] Found ${projects.length} projects (${foundViaGuess} guessed, ${foundViaShow} via nx show) in ${Date.now() - findStart}ms`);
    projects.sort((a, b) => a.name.localeCompare(b.name));
    logFn(`[TIMING] indexProjects TOTAL: ${Date.now() - startTime}ms`);
    return projects;
  }
  
  // Fallback to glob scanning
  progressFn('Scanning workspace for projects (this may take a while)...');
  logFn(`[TIMING] indexProjects: scanning for project.json files with glob...`);
  const globStart = Date.now();
  const projectJsonPaths = await fg('**/project.json', {
    cwd: workspaceRoot,
    absolute: true,
    dot: false,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  });
  logFn(`[TIMING] indexProjects: glob found ${projectJsonPaths.length} project.json files in ${Date.now() - globStart}ms`);
  progressFn(`Found ${projectJsonPaths.length} project files, parsing...`);

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


