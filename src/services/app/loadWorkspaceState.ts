import { getChangedFiles } from "../git/changedFiles.js";
import { resolveChangedSpecs } from "../specs/resolveChangedSpecs.js";
import { indexProjects } from "../workspace/projectIndex.js";

export interface LoadWorkspaceStateOptions {
  workspaceRoot: string;
  baseRef: string;
  skipFetch: boolean;
  verbose: boolean;
}

export async function loadWorkspaceState(opts: LoadWorkspaceStateOptions) {
  const startTime = Date.now();
  
  const projectsStart = Date.now();
  const projects = await indexProjects(opts.workspaceRoot);
  if (opts.verbose) {
    console.log(`[loadWorkspaceState] indexProjects: ${Date.now() - projectsStart}ms (${projects.length} projects)`);
  }
  
  const gitStart = Date.now();
  const changedFiles = await getChangedFiles({
    cwd: opts.workspaceRoot,
    baseRef: opts.baseRef,
    skipFetch: opts.skipFetch,
    verbose: opts.verbose,
  });
  if (opts.verbose) {
    console.log(`[loadWorkspaceState] getChangedFiles: ${Date.now() - gitStart}ms (${changedFiles.length} files)`);
  }
  
  const resolveStart = Date.now();
  const result = await resolveChangedSpecs({
    workspaceRoot: opts.workspaceRoot,
    projects,
    changedFiles,
  });
  if (opts.verbose) {
    console.log(`[loadWorkspaceState] resolveChangedSpecs: ${Date.now() - resolveStart}ms`);
    console.log(`[loadWorkspaceState] TOTAL: ${Date.now() - startTime}ms`);
  }
  
  return result;
}



