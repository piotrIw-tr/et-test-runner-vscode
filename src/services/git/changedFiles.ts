import path from 'node:path';
import { execa } from 'execa';
import type { ChangeStatus, ChangedFile } from '../../types/model.js';

export interface GetChangedFilesOptions {
  cwd: string;
  baseRef: string;
  skipFetch: boolean;
  verbose: boolean;
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
  // Best-effort: fetch can fail offline; we don’t want to break the tool.
  const res = await execa('git', ['fetch', 'origin', baseBranch, '--quiet'], { cwd, reject: false });
  if (verbose && res.exitCode !== 0) {
    // eslint-disable-next-line no-console
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
  const gitRootRes = await execa('git', ['rev-parse', '--show-toplevel'], { cwd: opts.cwd });
  const gitRoot = gitRootRes.stdout.trim();

  if (!opts.skipFetch) {
    await tryFetchOrigin(gitRoot, opts.baseRef, opts.verbose);
  }

  const compareRef = await resolveCompareRef(gitRoot, opts.baseRef);

  if (opts.verbose) {
    // eslint-disable-next-line no-console
    console.log(`[getChangedFiles] gitRoot=${gitRoot}, compareRef=${compareRef}`);
  }

  const changed = new Map<string, ChangeStatus>(); // relPath -> status

  // 1) Unstaged
  const unstagedFiles = await listChangedFiles(gitRoot, ['diff', '--name-only', '--diff-filter=d']);
  for (const file of unstagedFiles) {
    changed.set(file, 'U');
  }

  // 2) Staged overrides unstaged
  const stagedFiles = await listChangedFiles(gitRoot, ['diff', '--cached', '--name-only', '--diff-filter=d']);
  for (const file of stagedFiles) {
    changed.set(file, 'S');
  }

  // 3) Committed vs base (only if not already staged/unstaged)
  const committedFiles = await listChangedFiles(gitRoot, [
    'diff',
    '--name-only',
    '--diff-filter=d',
    `${compareRef}...HEAD`,
  ]);
  for (const file of committedFiles) {
    if (!changed.has(file)) changed.set(file, 'C');
  }

  if (opts.verbose) {
    // eslint-disable-next-line no-console
    console.log(`[getChangedFiles] unstaged=${unstagedFiles.length}, staged=${stagedFiles.length}, committed=${committedFiles.length}, total=${changed.size}`);
  }

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

