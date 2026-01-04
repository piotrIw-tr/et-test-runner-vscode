import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  ChangedFile,
  MissingSpecEntry,
  ProjectInfo,
  ProjectWithSpecs,
  ResolveChangedSpecsResult,
  SpecEntry,
  SpecStatus,
} from '../../types/model.js';

export interface ResolveChangedSpecsOptions {
  workspaceRoot: string;
  projects: ProjectInfo[];
  changedFiles: ChangedFile[];
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function shouldDeriveSpecFromSource(absPath: string): boolean {
  const file = path.basename(absPath);
  if (!absPath.endsWith('.ts')) return false;
  if (absPath.endsWith('.spec.ts')) return false;

  // Skip common "no-test-needed / not-unit-testable" conventions
  const skipExact = new Set([
    'index.ts',
    'public-api.ts',
    'test.ts',
    'test-setup.ts',
    'main.ts',
  ]);
  if (skipExact.has(file)) return false;

  const skipSuffixes = [
    // Angular/NX specific
    '.module.ts',
    '.routes.ts',
    '.imports.ts',
    '.providers.ts',
    // Configuration
    '.config.ts',
    '.const.ts',
    '.consts.ts',
    '.constant.ts',
    '.constants.ts',
    // Type definitions (no logic to test)
    '.model.ts',
    '.models.ts',
    '.interface.ts',
    '.interfaces.ts',
    '.type.ts',
    '.types.ts',
    '.enum.ts',
    '.enums.ts',
    // Test helpers (not unit testable themselves)
    '.mock.ts',
    '.mocks.ts',
    '.stub.ts',
    '.stubs.ts',
    '.token.ts',
    '.tokens.ts',
  ];
  if (skipSuffixes.some((s) => file.endsWith(s))) return false;

  // Skip environment files
  if (file === 'environment.ts' || file.startsWith('environment.') || file.includes('.environment.')) return false;

  // Skip index files with any prefix (e.g., public-api.index.ts)
  if (file.endsWith('.index.ts') || file === 'index.ts') return false;

  return true;
}

function deriveSpecPathFromSource(absPath: string): string {
  return absPath.replace(/\.ts$/, '.spec.ts');
}

function findOwningProject(projectsByRootLenDesc: ProjectInfo[], fileAbs: string): ProjectInfo | undefined {
  for (const p of projectsByRootLenDesc) {
    const root = p.rootAbs.endsWith(path.sep) ? p.rootAbs : p.rootAbs + path.sep;
    if (fileAbs === p.rootAbs || fileAbs.startsWith(root)) return p;
  }
  return undefined;
}

function mergeSpecEntry(existing: SpecEntry | undefined, incoming: SpecEntry): SpecEntry {
  if (!existing) return incoming;
  // Prefer real change statuses over derived 'R'
  if (existing.status !== 'R') return existing;
  if (incoming.status !== 'R') return incoming;
  return existing;
}

export async function resolveChangedSpecs(opts: ResolveChangedSpecsOptions): Promise<ResolveChangedSpecsResult> {
  const startTime = Date.now();
  console.log(`[resolveChangedSpecs] Starting with ${opts.changedFiles.length} changed files, ${opts.projects.length} projects`);
  
  const projectsByRootLenDesc = [...opts.projects].sort((a, b) => b.rootAbs.length - a.rootAbs.length);

  const specsByProject = new Map<string, Map<string, SpecEntry>>(); // projectName -> (absSpecPath -> entry)
  const missingByProject = new Map<string, MissingSpecEntry[]>(); // projectName -> missing specs
  const globalMissingSpecs: MissingSpecEntry[] = []; // For files without an owning project

  for (const changed of opts.changedFiles) {
    // Only care about files within the Nx workspace root (git root can be above).
    const wsRoot = opts.workspaceRoot.endsWith(path.sep) ? opts.workspaceRoot : opts.workspaceRoot + path.sep;
    if (!(changed.absPath === opts.workspaceRoot || changed.absPath.startsWith(wsRoot))) continue;

    // Case 1: spec file changed directly
    if (changed.absPath.endsWith('.spec.ts')) {
      if (!(await pathExists(changed.absPath))) continue;
      const owner = findOwningProject(projectsByRootLenDesc, changed.absPath);
      if (!owner) continue;

      const entry: SpecEntry = { absPath: changed.absPath, status: changed.status };
      const pmap = specsByProject.get(owner.name) ?? new Map<string, SpecEntry>();
      pmap.set(entry.absPath, mergeSpecEntry(pmap.get(entry.absPath), entry));
      specsByProject.set(owner.name, pmap);
      continue;
    }

    // Case 2: source file changed → derive related spec
    if (!shouldDeriveSpecFromSource(changed.absPath)) continue;
    const derivedSpec = deriveSpecPathFromSource(changed.absPath);

    const owner = findOwningProject(projectsByRootLenDesc, changed.absPath);
    if (!owner) {
      // No project owns this file
      globalMissingSpecs.push({
        sourceAbsPath: changed.absPath,
        expectedSpecAbsPath: derivedSpec,
        sourceStatus: changed.status,
      });
      continue;
    }

    if (await pathExists(derivedSpec)) {
      const entry: SpecEntry = { absPath: derivedSpec, status: 'R' };
      const pmap = specsByProject.get(owner.name) ?? new Map<string, SpecEntry>();
      pmap.set(entry.absPath, mergeSpecEntry(pmap.get(entry.absPath), entry));
      specsByProject.set(owner.name, pmap);
    } else {
      // Missing spec - track per project
      const missing = missingByProject.get(owner.name) ?? [];
      missing.push({
        sourceAbsPath: changed.absPath,
        expectedSpecAbsPath: derivedSpec,
        sourceStatus: changed.status,
      });
      missingByProject.set(owner.name, missing);
    }
  }

  // Collect all project names that have either specs or missing specs
  const allProjectNames = new Set([...specsByProject.keys(), ...missingByProject.keys()]);

  const projects: ProjectWithSpecs[] = [];
  for (const projectName of allProjectNames) {
    const project = opts.projects.find((p) => p.name === projectName);
    if (!project) continue;
    
    const specMap = specsByProject.get(projectName);
    const specs = specMap 
      ? [...specMap.values()].sort((a, b) => a.absPath.localeCompare(b.absPath))
      : [];
    const missingSpecs = missingByProject.get(projectName) ?? [];

    projects.push({
      name: project.name,
      runner: project.runner,
      rootAbs: project.rootAbs,
      specs,
      missingSpecs,
    });
  }

  // Sort projects by name
  projects.sort((a, b) => a.name.localeCompare(b.name));

  const totalSpecs = projects.reduce((sum, p) => sum + p.specs.length, 0);
  console.log(`[resolveChangedSpecs] Completed in ${Date.now() - startTime}ms: ${projects.length} projects with specs, ${totalSpecs} total specs`);

  return { projects, missingSpecs: globalMissingSpecs };
}


