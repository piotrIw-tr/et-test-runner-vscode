import * as vscode from 'vscode';
import path from 'node:path';
import type { ProjectWithSpecs, SpecEntry, SpecStatus } from '../types/model.js';
import type { WorkspaceCache } from '../state/workspaceCache.js';

export class ProjectTreeItem extends vscode.TreeItem {
  constructor(
    public readonly project: ProjectWithSpecs,
    private workspaceRoot: string,
    private cache: WorkspaceCache
  ) {
    super(project.name, vscode.TreeItemCollapsibleState.Expanded);
    
    this.contextValue = 'project';
    
    const relRoot = path.relative(workspaceRoot, project.rootAbs);
    
    // Calculate project-level metrics from cache
    const metrics = this.calculateProjectMetrics();
    
    if (metrics) {
      const { passed, failed, total, totalTests, passedTests, failedTests } = metrics;
      
      // Icon based on status
      if (failed > 0) {
        this.iconPath = new vscode.ThemeIcon('testing-failed-icon', new vscode.ThemeColor('testing.iconFailed'));
      } else if (passed > 0) {
        this.iconPath = new vscode.ThemeIcon('testing-passed-icon', new vscode.ThemeColor('testing.iconPassed'));
      } else {
        this.iconPath = new vscode.ThemeIcon('folder-library');
      }
      
      // Build detailed description
      const parts: string[] = [];
      parts.push(`${project.specs.length} specs`);
      
      if (failed > 0) {
        parts.push(`❌ ${failed}/${total} failing`);
      } else if (passed > 0) {
        parts.push(`✅ ${passed} passing`);
      }
      
      if (totalTests > 0) {
        parts.push(`(${passedTests}/${totalTests} tests)`);
      }
      
      this.description = parts.join(' • ');
      
      // Detailed tooltip
      this.tooltip = new vscode.MarkdownString();
      this.tooltip.appendMarkdown(`### ${project.name}\n\n`);
      this.tooltip.appendMarkdown(`**Path:** \`${relRoot}\`\n\n`);
      this.tooltip.appendMarkdown(`**Runner:** ${project.runner}\n\n`);
      this.tooltip.appendMarkdown(`**Specs:** ${project.specs.length}\n\n`);
      
      if (metrics.totalTests > 0) {
        this.tooltip.appendMarkdown(`---\n\n`);
        this.tooltip.appendMarkdown(`**Test Results:**\n\n`);
        this.tooltip.appendMarkdown(`- ✅ Passed: ${passedTests}\n`);
        this.tooltip.appendMarkdown(`- ❌ Failed: ${failedTests}\n`);
        if (metrics.skippedTests > 0) {
          this.tooltip.appendMarkdown(`- ⭕ Skipped: ${metrics.skippedTests}\n`);
        }
        this.tooltip.appendMarkdown(`- 📊 Total: ${totalTests}\n`);
      }
      
      if (project.missingSpecs.length > 0) {
        this.tooltip.appendMarkdown(`\n⚠️ **${project.missingSpecs.length} missing specs**\n`);
      }
    } else {
      this.iconPath = new vscode.ThemeIcon('folder-library');
      this.description = `${relRoot} • ${project.runner} • ${project.specs.length} specs`;
      this.tooltip = `${project.name}\n${project.specs.length} specs • ${project.runner}`;
    }
  }

  private calculateProjectMetrics(): { 
    passed: number; 
    failed: number; 
    total: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
  } | null {
    let passed = 0;
    let failed = 0;
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;
    let hasMetrics = false;

    for (const spec of this.project.specs) {
      const relPath = path.relative(this.workspaceRoot, spec.absPath);
      const metrics = this.cache.get(relPath);
      if (metrics) {
        hasMetrics = true;
        if (metrics.exitCode === 0) {
          passed++;
        } else {
          failed++;
        }
        
        if (metrics.jest) {
          totalTests += metrics.jest.total || 0;
          passedTests += metrics.jest.passed || 0;
          failedTests += metrics.jest.failed || 0;
          skippedTests += metrics.jest.skipped || 0;
        }
      }
    }

    return hasMetrics ? { passed, failed, total: passed + failed, totalTests, passedTests, failedTests, skippedTests } : null;
  }
}

export class SpecTreeItem extends vscode.TreeItem {
  constructor(
    public readonly spec: SpecEntry,
    public readonly projectName: string,
    private workspaceRoot: string,
    private cache: WorkspaceCache
  ) {
    super(path.basename(spec.absPath), vscode.TreeItemCollapsibleState.None);
    
    const relPath = path.relative(workspaceRoot, spec.absPath);
    const metrics = cache.get(relPath);
    
    // Determine icon and context based on status and test results
    let icon: string;
    let contextValue = 'spec';
    
    if (metrics) {
      if (metrics.exitCode === 0) {
        icon = 'testing-passed-icon';
        contextValue = 'spec-passed';
      } else {
        icon = 'testing-failed-icon';
        contextValue = 'spec-failed';
      }
    } else {
      // No test run yet, show change status
      icon = this.getStatusIcon(spec.status);
      contextValue = `spec-${spec.status}`;
    }
    
    this.iconPath = new vscode.ThemeIcon(icon);
    this.contextValue = contextValue;
    
    // Build description with detailed metrics
    const parts: string[] = [];
    
    // Add change status for changed files
    if (spec.status !== 'R') {
      const statusLabels = { U: '● Unstaged', S: '○ Staged', C: '✓ Committed' };
      parts.push(statusLabels[spec.status] || '');
    }
    
    if (metrics) {
      // Test counts
      if (metrics.jest?.total) {
        const { passed, failed, skipped, total } = metrics.jest;
        if (failed && failed > 0) {
          parts.push(`❌ ${failed}/${total}`);
        } else {
          parts.push(`✅ ${passed}/${total}`);
        }
        if (skipped && skipped > 0) {
          parts.push(`⭕ ${skipped} skipped`);
        }
      }
      
      // Duration
      if (metrics.durationMs > 0) {
        const seconds = (metrics.durationMs / 1000).toFixed(1);
        parts.push(`⏱️ ${seconds}s`);
      }
    }
    
    this.description = parts.join(' • ');
    
    // Enhanced tooltip with markdown
    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`### ${path.basename(spec.absPath)}\n\n`);
    this.tooltip.appendMarkdown(`**Path:** \`${relPath}\`\n\n`);
    
    if (spec.status !== 'R') {
      const statusDesc = { 
        U: '⚠️ **Unstaged changes**', 
        S: '📝 **Staged changes**', 
        C: '✓ **Committed changes**' 
      };
      this.tooltip.appendMarkdown(`${statusDesc[spec.status]}\n\n`);
    }
    
    if (metrics) {
      this.tooltip.appendMarkdown(`---\n\n`);
      this.tooltip.appendMarkdown(`**Last Run:** ${new Date(metrics.lastRunIso).toLocaleString()}\n\n`);
      this.tooltip.appendMarkdown(`**Exit Code:** ${metrics.exitCode === 0 ? '✅ 0 (success)' : `❌ ${metrics.exitCode} (failed)`}\n\n`);
      
      if (metrics.jest) {
        this.tooltip.appendMarkdown(`**Test Results:**\n\n`);
        this.tooltip.appendMarkdown(`- ✅ Passed: ${metrics.jest.passed || 0}\n`);
        this.tooltip.appendMarkdown(`- ❌ Failed: ${metrics.jest.failed || 0}\n`);
        if (metrics.jest.skipped) {
          this.tooltip.appendMarkdown(`- ⭕ Skipped: ${metrics.jest.skipped}\n`);
        }
        this.tooltip.appendMarkdown(`- 📊 Total: ${metrics.jest.total || 0}\n\n`);
      }
      
      if (metrics.durationMs > 0) {
        this.tooltip.appendMarkdown(`**Duration:** ${(metrics.durationMs / 1000).toFixed(2)}s\n\n`);
      }
    }
    
    this.tooltip.appendMarkdown(`\n---\n\n`);
    this.tooltip.appendMarkdown(`**Actions:**\n\n`);
    this.tooltip.appendMarkdown(`- Click to open file\n`);
    this.tooltip.appendMarkdown(`- Right-click for menu\n`);
    this.tooltip.appendMarkdown(`- ▶️ to run test\n`);
    if (metrics && metrics.exitCode !== 0) {
      this.tooltip.appendMarkdown(`- ✨ AI assist available\n`);
    }
    
    // Make it clickable to open the file
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [vscode.Uri.file(spec.absPath)]
    };
  }
  
  private getStatusIcon(status: SpecStatus): string {
    switch (status) {
      case 'U': return 'circle-filled'; // Unstaged
      case 'S': return 'circle-outline'; // Staged
      case 'C': return 'check'; // Committed
      case 'R': return 'file'; // Regular
      default: return 'file';
    }
  }
  
  private getStatusLabel(status: SpecStatus): string {
    switch (status) {
      case 'U': return 'Unstaged';
      case 'S': return 'Staged';
      case 'C': return 'Committed';
      default: return '';
    }
  }
}
