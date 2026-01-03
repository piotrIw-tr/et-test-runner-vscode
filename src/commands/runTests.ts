import * as vscode from 'vscode';
import path from 'node:path';
import { execa } from 'execa';
import { buildJestTestFileRegex } from '../services/test/jestTestFilePattern.js';
import { resolveNxCli } from '../services/nx/resolveNxCli.js';
import { parseJestResultsFile } from '../services/test/parseJestResults.js';
import type { ProjectsTreeProvider } from '../views/projectsTreeProvider.js';
import type { TestRunnerViewProvider } from '../webview/TestRunnerViewProvider.js';
import type { WorkspaceCache } from '../state/workspaceCache.js';
import type { UIStateManager } from '../state/uiState.js';
import type { RunningStateManager } from '../state/runningState.js';
import { ProjectTreeItem, SpecTreeItem } from '../views/treeItems.js';

export async function runSelectedCommand(
  item: SpecTreeItem | SpecTreeItem[],
  treeProvider: ProjectsTreeProvider,
  cache: WorkspaceCache,
  outputChannel: vscode.OutputChannel,
  runningState?: RunningStateManager
): Promise<void> {
  const workspaceRoot = treeProvider.getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('No workspace root found');
    return;
  }

  const items = Array.isArray(item) ? item : [item];
  const specsByProject = new Map<string, string[]>();
  
  for (const specItem of items) {
    if (!specsByProject.has(specItem.projectName)) {
      specsByProject.set(specItem.projectName, []);
    }
    specsByProject.get(specItem.projectName)!.push(specItem.spec.absPath);
  }

  for (const [projectName, specPaths] of specsByProject.entries()) {
    await runTests(
      workspaceRoot,
      projectName,
      specPaths,
      treeProvider,
      cache,
      outputChannel,
      runningState
    );
  }
}

export async function runProjectCommand(
  item: ProjectTreeItem,
  treeProvider: ProjectsTreeProvider,
  cache: WorkspaceCache,
  outputChannel: vscode.OutputChannel,
  runningState?: RunningStateManager
): Promise<void> {
  const workspaceRoot = treeProvider.getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('No workspace root found');
    return;
  }

  const specPaths = item.project.specs.map(s => s.absPath);
  if (specPaths.length === 0) {
    vscode.window.showInformationMessage(`No specs found for project ${item.project.name}`);
    return;
  }

  await runTests(
    workspaceRoot,
    item.project.name,
    specPaths,
    treeProvider,
    cache,
    outputChannel,
    runningState
  );
}

export async function runAllCommand(
  treeProvider: ProjectsTreeProvider,
  cache: WorkspaceCache,
  outputChannel: vscode.OutputChannel,
  runningState?: RunningStateManager
): Promise<void> {
  const workspaceRoot = treeProvider.getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('No workspace root found');
    return;
  }

  const projects = treeProvider.getProjects();
  for (const project of projects) {
    if (project.specs.length === 0) continue;
    
    const specPaths = project.specs.map(s => s.absPath);
    await runTests(
      workspaceRoot,
      project.name,
      specPaths,
      treeProvider,
      cache,
      outputChannel,
      runningState
    );
  }
}

export async function runSpecsFromWebview(
  specPaths: string[],
  treeProvider: ProjectsTreeProvider,
  cache: WorkspaceCache,
  outputChannel: vscode.OutputChannel,
  runningState: RunningStateManager,
  webviewProvider: TestRunnerViewProvider,
  uiState: UIStateManager
): Promise<void> {
  const workspaceRoot = treeProvider.getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('No workspace root found');
    return;
  }

  if (specPaths.length === 0) {
    vscode.window.showWarningMessage('No specs selected to run');
    return;
  }

  // Group specs by project
  const projects = treeProvider.getProjects();
  const specsByProject = new Map<string, string[]>();

  for (const specPath of specPaths) {
    for (const project of projects) {
      if (project.specs.some(s => s.absPath === specPath)) {
        if (!specsByProject.has(project.name)) {
          specsByProject.set(project.name, []);
        }
        specsByProject.get(project.name)!.push(specPath);
        break;
      }
    }
  }

  // Run tests for each project
  for (const [projectName, projectSpecPaths] of specsByProject.entries()) {
    await runTestsWithWebview(
      workspaceRoot,
      projectName,
      projectSpecPaths,
      treeProvider,
      cache,
      outputChannel,
      runningState,
      webviewProvider,
      uiState
    );
  }
}

async function runTests(
  workspaceRoot: string,
  projectName: string,
  specPaths: string[],
  treeProvider: ProjectsTreeProvider,
  cache: WorkspaceCache,
  outputChannel: vscode.OutputChannel,
  runningState?: RunningStateManager
): Promise<void> {
  const config = vscode.workspace.getConfiguration('et-test-runner');
  const coverage = config.get<boolean>('coverage', false);

  outputChannel.show(true);
  outputChannel.appendLine(`\n${'='.repeat(80)}`);
  outputChannel.appendLine(`Running tests for ${projectName} (${specPaths.length} specs)`);
  outputChannel.appendLine(`${'='.repeat(80)}\n`);

  const startTime = Date.now();

  try {
    const nxCli = await resolveNxCli(workspaceRoot);
    const testFilePattern = buildJestTestFileRegex(workspaceRoot, specPaths);

    const args = [
      ...nxCli.prefixArgs,
      'test',
      projectName,
      '--watch=false',
      `--testFile=${testFilePattern}`
    ];

    if (coverage) {
      args.push('--coverage');
    }

    outputChannel.appendLine(`Command: ${nxCli.command} ${args.join(' ')}\n`);

    const child = execa(nxCli.command, args, {
      cwd: workspaceRoot,
      reject: false,
      all: true
    });

    // Track running state
    runningState?.startRun(projectName, specPaths, child);

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        outputChannel.append(chunk.toString());
      });
    }
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        outputChannel.append(chunk.toString());
      });
    }

    const result = await child;
    const exitCode = result.exitCode ?? 1;
    const durationMs = Date.now() - startTime;

    // Determine failed specs
    const failedSpecs: string[] = [];
    
    outputChannel.appendLine(`\n${'='.repeat(80)}`);
    outputChannel.appendLine(`Completed with exit code ${exitCode} in ${(durationMs / 1000).toFixed(1)}s`);
    outputChannel.appendLine(`${'='.repeat(80)}\n`);

    // Parse results and update cache
    try {
      const projectRootRel = path.relative(
        workspaceRoot,
        treeProvider.getProjects().find(p => p.name === projectName)?.rootAbs || workspaceRoot
      );
      const results = parseJestResultsFile(workspaceRoot, projectRootRel);
      
      if (results) {
        for (const specPath of specPaths) {
          const relPath = path.relative(workspaceRoot, specPath);
          const metrics = results[relPath];
          
          if (metrics) {
            await cache.set(relPath, metrics);
            if (metrics.exitCode !== 0) {
              failedSpecs.push(specPath);
            }
          } else {
            await cache.set(relPath, {
              lastRunIso: new Date().toISOString(),
              exitCode,
              durationMs
            });
            if (exitCode !== 0) {
              failedSpecs.push(specPath);
            }
          }
        }
      }
    } catch (parseError) {
      outputChannel.appendLine(`Warning: Could not parse test results: ${parseError}`);
      
      for (const specPath of specPaths) {
        const relPath = path.relative(workspaceRoot, specPath);
        await cache.set(relPath, {
          lastRunIso: new Date().toISOString(),
          exitCode,
          durationMs
        });
        if (exitCode !== 0) {
          failedSpecs.push(specPath);
        }
      }
    }

    // End running state
    runningState?.endRun(failedSpecs);

    // Refresh tree view
    await treeProvider.loadData();
    treeProvider.refresh();

    if (exitCode === 0) {
      vscode.window.showInformationMessage(`✓ All tests passed for ${projectName}`);
    } else {
      vscode.window.showErrorMessage(`✗ Some tests failed for ${projectName}`);
    }

  } catch (error) {
    runningState?.endRun(specPaths); // Mark all as failed on error
    outputChannel.appendLine(`Error running tests: ${error}`);
    vscode.window.showErrorMessage(`Failed to run tests: ${error}`);
  }
}

async function runTestsWithWebview(
  workspaceRoot: string,
  projectName: string,
  specPaths: string[],
  treeProvider: ProjectsTreeProvider,
  cache: WorkspaceCache,
  outputChannel: vscode.OutputChannel,
  runningState: RunningStateManager,
  webviewProvider: TestRunnerViewProvider,
  uiState: UIStateManager
): Promise<void> {
  const config = vscode.workspace.getConfiguration('et-test-runner');
  const coverage = config.get<boolean>('coverage', false);

  // Clear previous output
  webviewProvider.clearOutput();
  webviewProvider.addLog('action', `Running tests for ${projectName} (${specPaths.length} specs)`);

  const startTime = Date.now();

  try {
    const nxCli = await resolveNxCli(workspaceRoot);
    const testFilePattern = buildJestTestFileRegex(workspaceRoot, specPaths);

    const args = [
      ...nxCli.prefixArgs,
      'test',
      projectName,
      '--watch=false',
      `--testFile=${testFilePattern}`
    ];

    if (coverage) {
      args.push('--coverage');
    }

    const commandStr = `$ ${nxCli.command} ${args.join(' ')}\n\n`;
    webviewProvider.appendOutput(commandStr);
    outputChannel.appendLine(commandStr);

    const child = execa(nxCli.command, args, {
      cwd: workspaceRoot,
      reject: false,
      all: true
    });

    // Track running state
    runningState.startRun(projectName, specPaths, child);

    let completedSpecs = 0;

    // Stream output to both WebView and output channel
    if (child.all) {
      child.all.on('data', (chunk) => {
        const text = chunk.toString();
        webviewProvider.appendOutput(text);
        outputChannel.append(text);

        // Try to detect spec completion for progress updates
        const passMatch = text.match(/PASS\s+(\S+)/g);
        const failMatch = text.match(/FAIL\s+(\S+)/g);
        if (passMatch || failMatch) {
          completedSpecs++;
          runningState.updateProgress(completedSpecs);
        }
      });
    }

    const result = await child;
    const exitCode = result.exitCode ?? 1;
    const durationMs = Date.now() - startTime;

    // Determine failed specs
    const failedSpecs: string[] = [];

    // Parse results and update cache
    try {
      const projectRootRel = path.relative(
        workspaceRoot,
        treeProvider.getProjects().find(p => p.name === projectName)?.rootAbs || workspaceRoot
      );
      const results = parseJestResultsFile(workspaceRoot, projectRootRel);
      
      if (results) {
        for (const specPath of specPaths) {
          const relPath = path.relative(workspaceRoot, specPath);
          const metrics = results[relPath];
          
          if (metrics) {
            await cache.set(relPath, metrics);
            if (metrics.exitCode !== 0) {
              failedSpecs.push(specPath);
            }
          } else {
            await cache.set(relPath, {
              lastRunIso: new Date().toISOString(),
              exitCode,
              durationMs
            });
            if (exitCode !== 0) {
              failedSpecs.push(specPath);
            }
          }
        }
      }
    } catch (parseError) {
      webviewProvider.addLog('warn', `Could not parse test results: ${parseError}`);
      
      for (const specPath of specPaths) {
        const relPath = path.relative(workspaceRoot, specPath);
        await cache.set(relPath, {
          lastRunIso: new Date().toISOString(),
          exitCode,
          durationMs
        });
        if (exitCode !== 0) {
          failedSpecs.push(specPath);
        }
      }
    }

    // Record run in history
    await uiState.addRunToHistory({
      timestamp: new Date().toISOString(),
      projectName,
      specCount: specPaths.length,
      passed: specPaths.length - failedSpecs.length,
      failed: failedSpecs.length,
      durationMs,
      specPaths
    });

    // End running state
    runningState.endRun(failedSpecs);

    // Log completion
    const statusMsg = exitCode === 0
      ? `✓ All tests passed (${(durationMs / 1000).toFixed(1)}s)`
      : `✗ ${failedSpecs.length} spec(s) failed (${(durationMs / 1000).toFixed(1)}s)`;
    
    webviewProvider.appendOutput(`\n${statusMsg}\n`);
    webviewProvider.addLog(exitCode === 0 ? 'info' : 'error', statusMsg);

    // Refresh views
    await treeProvider.loadData();
    treeProvider.refresh();
    webviewProvider.updateProjects(treeProvider.getProjects(), workspaceRoot);

    if (exitCode === 0) {
      vscode.window.showInformationMessage(`✓ All tests passed for ${projectName}`);
    } else {
      vscode.window.showErrorMessage(`✗ Some tests failed for ${projectName}`);
    }

  } catch (error) {
    runningState.endRun(specPaths);
    const errorMsg = `Error running tests: ${error}`;
    webviewProvider.appendOutput(`\n${errorMsg}\n`);
    webviewProvider.addLog('error', errorMsg);
    outputChannel.appendLine(errorMsg);
    vscode.window.showErrorMessage(`Failed to run tests: ${error}`);
  }
}
