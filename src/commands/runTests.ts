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
  // Prevent running if already running
  if (runningState?.isRunning) {
    vscode.window.showWarningMessage('Tests are already running. Please wait or cancel the current run.');
    return;
  }
  
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
  // Prevent running if already running
  if (runningState?.isRunning) {
    vscode.window.showWarningMessage('Tests are already running. Please wait or cancel the current run.');
    return;
  }
  
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
  // Prevent running if already running
  if (runningState?.isRunning) {
    vscode.window.showWarningMessage('Tests are already running. Please wait or cancel the current run.');
    return;
  }
  
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
  // Prevent running if already running
  if (runningState.isRunning) {
    vscode.window.showWarningMessage('Tests are already running. Please wait or cancel the current run.');
    return;
  }
  
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

export async function runProjectFromWebview(
  projectName: string,
  treeProvider: ProjectsTreeProvider,
  cache: WorkspaceCache,
  outputChannel: vscode.OutputChannel,
  runningState: RunningStateManager,
  webviewProvider: TestRunnerViewProvider,
  uiState: UIStateManager
): Promise<void> {
  // Prevent running if already running
  if (runningState.isRunning) {
    vscode.window.showWarningMessage('Tests are already running. Please wait or cancel the current run.');
    return;
  }
  
  const workspaceRoot = treeProvider.getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('No workspace root found');
    return;
  }

  // Find the project
  const projects = treeProvider.getProjects();
  const project = projects.find(p => p.name === projectName);
  
  if (!project) {
    vscode.window.showErrorMessage(`Project "${projectName}" not found`);
    return;
  }
  
  if (project.runner !== 'jest') {
    vscode.window.showWarningMessage(`Project "${projectName}" uses ${project.runner}, not Jest. Only Jest projects are supported.`);
    return;
  }

  const specPaths = project.specs.map(s => s.absPath);
  if (specPaths.length === 0) {
    vscode.window.showInformationMessage(`No specs found for project ${projectName}`);
    return;
  }

  webviewProvider.addLog('info', `Running all ${specPaths.length} specs in project ${projectName}`);

  await runTestsWithWebview(
    workspaceRoot,
    projectName,
    specPaths,
    treeProvider,
    cache,
    outputChannel,
    runningState,
    webviewProvider,
    uiState
  );
}

export async function runAllChangedFromWebview(
  treeProvider: ProjectsTreeProvider,
  cache: WorkspaceCache,
  outputChannel: vscode.OutputChannel,
  runningState: RunningStateManager,
  webviewProvider: TestRunnerViewProvider,
  uiState: UIStateManager
): Promise<void> {
  // Prevent running if already running
  if (runningState.isRunning) {
    vscode.window.showWarningMessage('Tests are already running. Please wait or cancel the current run.');
    return;
  }
  
  const workspaceRoot = treeProvider.getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('No workspace root found');
    return;
  }

  // Collect all changed specs (status !== 'R' means it's changed)
  const projects = treeProvider.getProjects();
  const changedSpecsByProject = new Map<string, string[]>();
  
  for (const project of projects) {
    // Only jest projects are supported
    if (project.runner !== 'jest') continue;
    
    const changedSpecs = project.specs
      .filter(spec => spec.status !== 'R') // R means unchanged (Rest)
      .map(spec => spec.absPath);
    
    if (changedSpecs.length > 0) {
      changedSpecsByProject.set(project.name, changedSpecs);
    }
  }
  
  const totalChangedSpecs = Array.from(changedSpecsByProject.values()).reduce((sum, arr) => sum + arr.length, 0);
  
  if (totalChangedSpecs === 0) {
    vscode.window.showInformationMessage('No changed specs to run');
    return;
  }

  webviewProvider.addLog('info', `Running ${totalChangedSpecs} changed specs across ${changedSpecsByProject.size} projects`);

  // Run tests for each project with changed specs
  for (const [projectName, specPaths] of changedSpecsByProject.entries()) {
    await runTestsWithWebview(
      workspaceRoot,
      projectName,
      specPaths,
      treeProvider,
      cache,
      outputChannel,
      runningState,
      webviewProvider,
      uiState
    );
  }
}

export async function runProjectChangedFromWebview(
  projectName: string,
  treeProvider: ProjectsTreeProvider,
  cache: WorkspaceCache,
  outputChannel: vscode.OutputChannel,
  runningState: RunningStateManager,
  webviewProvider: TestRunnerViewProvider,
  uiState: UIStateManager
): Promise<void> {
  // Prevent running if already running
  if (runningState.isRunning) {
    vscode.window.showWarningMessage('Tests are already running. Please wait or cancel the current run.');
    return;
  }
  
  const workspaceRoot = treeProvider.getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('No workspace root found');
    return;
  }

  // Find the project
  const projects = treeProvider.getProjects();
  const project = projects.find(p => p.name === projectName);
  
  if (!project) {
    vscode.window.showErrorMessage(`Project "${projectName}" not found`);
    return;
  }
  
  if (project.runner !== 'jest') {
    vscode.window.showWarningMessage(`Project "${projectName}" uses ${project.runner}, not Jest. Only Jest projects are supported.`);
    return;
  }

  // Get only changed specs (status !== 'R' means the spec file itself was changed)
  const changedSpecs = project.specs
    .filter(spec => spec.status !== 'R')
    .map(spec => spec.absPath);
  
  if (changedSpecs.length === 0) {
    vscode.window.showInformationMessage(`No changed specs found for project ${projectName}`);
    return;
  }

  webviewProvider.addLog('info', `Running ${changedSpecs.length} changed specs in project ${projectName}`);

  await runTestsWithWebview(
    workspaceRoot,
    projectName,
    changedSpecs,
    treeProvider,
    cache,
    outputChannel,
    runningState,
    webviewProvider,
    uiState
  );
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
  webviewProvider.addLog('action', `Starting test run for project: ${projectName}`);
  webviewProvider.addLog('info', `Specs to run: ${specPaths.length}`);
  for (const specPath of specPaths) {
    webviewProvider.addLog('debug', `  → ${path.basename(specPath)}`);
  }

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
    webviewProvider.addLog('debug', `Executing: ${nxCli.command} ${args.slice(0, 3).join(' ')}...`);
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

    // End running state
    runningState.endRun(failedSpecs);

    // Log completion with detailed info
    const passedCount = specPaths.length - failedSpecs.length;
    const statusMsg = exitCode === 0
      ? `✓ All tests passed (${(durationMs / 1000).toFixed(1)}s)`
      : `✗ ${failedSpecs.length} spec(s) failed, ${passedCount} passed (${(durationMs / 1000).toFixed(1)}s)`;
    
    webviewProvider.appendOutput(`\n${statusMsg}\n`);
    webviewProvider.addLog(exitCode === 0 ? 'info' : 'error', statusMsg);
    
    // Log which specs failed
    if (failedSpecs.length > 0) {
      webviewProvider.addLog('error', `Failed specs:`);
      for (const failedSpec of failedSpecs) {
        webviewProvider.addLog('error', `  ✗ ${path.basename(failedSpec)}`);
      }
    }

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
