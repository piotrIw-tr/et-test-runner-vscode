import { getChangedFiles } from "../git/changedFiles.js";
import { resolveChangedSpecs } from "../specs/resolveChangedSpecs.js";
import { indexProjects } from "../workspace/projectIndex.js";

export interface LoadWorkspaceStateOptions {
  workspaceRoot: string;
  baseRef: string;
  skipFetch: boolean;
  verbose: boolean;
  log?: (msg: string) => void;
}

export async function loadWorkspaceState(opts: LoadWorkspaceStateOptions) {
  const startTime = Date.now();
  const log = opts.log || console.log;
  
  log(`[TIMING] loadWorkspaceState starting...`);
  
  const projectsStart = Date.now();
  const projects = await indexProjects(opts.workspaceRoot, log);
  log(`[TIMING] indexProjects TOTAL: ${Date.now() - projectsStart}ms (${projects.length} projects)`);
  
  const gitStart = Date.now();
  const changedFiles = await getChangedFiles({
    cwd: opts.workspaceRoot,
    baseRef: opts.baseRef,
    skipFetch: opts.skipFetch,
    verbose: opts.verbose,
    log,
  });
  log(`[TIMING] getChangedFiles: ${Date.now() - gitStart}ms (${changedFiles.length} files, skipFetch=${opts.skipFetch})`);
  
  const resolveStart = Date.now();
  const result = await resolveChangedSpecs({
    workspaceRoot: opts.workspaceRoot,
    projects,
    changedFiles,
    log,
  });
  log(`[TIMING] resolveChangedSpecs: ${Date.now() - resolveStart}ms`);
  log(`[TIMING] TOTAL: ${Date.now() - startTime}ms`);
  
  return result;
}



