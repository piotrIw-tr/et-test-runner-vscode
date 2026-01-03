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
  const projects = await indexProjects(opts.workspaceRoot);
  const changedFiles = await getChangedFiles({
    cwd: opts.workspaceRoot,
    baseRef: opts.baseRef,
    skipFetch: opts.skipFetch,
    verbose: opts.verbose,
  });
  return await resolveChangedSpecs({
    workspaceRoot: opts.workspaceRoot,
    projects,
    changedFiles,
  });
}



