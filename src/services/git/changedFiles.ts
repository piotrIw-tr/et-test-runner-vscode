import path from 'node:path';
import { execa } from 'execa';
import type { ChangeStatus, ChangedFile } from '../../types/model.js';

export interface GetChangedFilesOptions {
  cwd: string;
  baseRef: string;
  skipFetch: boolean;
  verbose: boolean;
  log?: (msg: string) => void;
}

function isShaLike(ref: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(ref);
}

async function gitRefExists(cwd: string, ref: string): Promise<boolean> {
  const res = await execa('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
    cwd,
    reject: false,
    stdout: 'ignore',
    stderr: 'ignore',
  });
  return res.exitCode === 0;
}

async function resolveCompareRef(cwd: string, baseRef: string): Promise<string> {
  if (baseRef.includes('/') || isShaLike(baseRef)) return baseRef;
  const originRef = `origin/${baseRef}`;
  if (await gitRefExists(cwd, originRef)) return originRef;
  return baseRef;
}

async function tryFetchOrigin(cwd: string, baseRef: string, verbose: boolean): Promise<void> {
  if (isShaLike(baseRef)) return;
  const baseBranch = baseRef.startsWith('origin/') ? baseRef.slice('origin/'.length) : baseRef;
  // Best-effort: fetch can fail offline; we don't want to break the tool.
  const fetchStart = Date.now();
  if (verbose) {
    console.log(`[git] Starting fetch origin ${baseBranch}...`);
  }
  const res = await execa('git', ['fetch', 'origin', baseBranch, '--quiet'], { cwd, reject: false });
  if (verbose) {
    console.log(`[git] Fetch completed in ${Date.now() - fetchStart}ms (exit: ${res.exitCode})`);
  }
  if (res.exitCode !== 0 && verbose) {
    console.error(`[nx-test-ui] git fetch origin ${baseBranch} failed (continuing)`);
  }
}

async function listChangedFiles(cwd: string, args: string[]): Promise<string[]> {
  const res = await execa('git', args, { cwd });
  return res.stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function getChangedFiles(opts: GetChangedFilesOptions): Promise<ChangedFile[]> {
  const startTime = Date.now();
  const log = opts.log || console.log;
  
  const gitRootRes = await execa('git', ['rev-parse', '--show-toplevel'], { cwd: opts.cwd });
  const gitRoot = gitRootRes.stdout.trim();
  log(`[TIMING] git root resolved in ${Date.now() - startTime}ms`);

  if (!opts.skipFetch) {
    const fetchStart = Date.now();
    log(`[TIMING] Starting git fetch...`);
    await tryFetchOrigin(gitRoot, opts.baseRef, opts.verbose);
    log(`[TIMING] git fetch completed in ${Date.now() - fetchStart}ms`);
  } else {
    log(`[TIMING] Skipping git fetch (skipGitFetch=true)`);
  }

  const compareRef = await resolveCompareRef(gitRoot, opts.baseRef);
  log(`[TIMING] Using compareRef: ${compareRef}`);

  const changed = new Map<string, ChangeStatus>(); // relPath -> status

  // 1) Unstaged
  const unstagedStart = Date.now();
  const unstagedFiles = await listChangedFiles(gitRoot, ['diff', '--name-only', '--diff-filter=d']);
  for (const file of unstagedFiles) {
    changed.set(file, 'U');
  }
  log(`[TIMING] git diff (unstaged): ${unstagedFiles.length} files in ${Date.now() - unstagedStart}ms`);

  // 2) Staged overrides unstaged
  const stagedStart = Date.now();
  const stagedFiles = await listChangedFiles(gitRoot, ['diff', '--cached', '--name-only', '--diff-filter=d']);
  for (const file of stagedFiles) {
    changed.set(file, 'S');
  }
  log(`[TIMING] git diff (staged): ${stagedFiles.length} files in ${Date.now() - stagedStart}ms`);

  // 3) Committed vs base (only if not already staged/unstaged)
  const committedStart = Date.now();
  const committedFiles = await listChangedFiles(gitRoot, [
    'diff',
    '--name-only',
    '--diff-filter=d',
    `${compareRef}...HEAD`,
  ]);
  for (const file of committedFiles) {
    if (!changed.has(file)) changed.set(file, 'C');
  }
  log(`[TIMING] git diff (committed vs ${compareRef}): ${committedFiles.length} files in ${Date.now() - committedStart}ms`);

  log(`[TIMING] getChangedFiles TOTAL: ${changed.size} changed files in ${Date.now() - startTime}ms`);

  return [...changed.entries()].map(([relPathFromGitRoot, status]) => ({
    relPathFromGitRoot,
    absPath: path.join(gitRoot, relPathFromGitRoot),
    status,
  }));
}

export async function getCurrentBranch(cwd: string): Promise<string> {
  try {
    const res = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
    return res.stdout.trim() || 'HEAD';
  } catch {
    return 'unknown';
  }
}

