import * as vscode from 'vscode';

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  // Generate nonce for CSP
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>ET Test Runner</title>
  <style>
    ${getStyles()}
  </style>
</head>
<body>
  <div id="app">
    <!-- Header Bar - 2 lines like console app -->
    <header id="header-bar">
      <!-- Line 1: Status, Project, Cache, Logs -->
      <div class="header-line">
        <span id="status-text" class="header-status">Ready</span>
        <span class="header-separator">│</span>
        <span id="project-info" class="header-info"></span>
        <span class="header-separator">│</span>
        <span id="cache-info" class="header-info"></span>
        <span class="header-separator">│</span>
        <span id="logs-indicator" class="header-logs">LOGS</span>
        <div class="header-spacer"></div>
        <div id="progress-container" class="header-progress" style="display: none;">
          <div class="progress-bar">
            <div class="progress-fill" id="progress-fill"></div>
          </div>
          <span id="progress-text" class="progress-text">0%</span>
        </div>
        <span id="running-indicator" class="header-running" style="display: none;">⏳ RUNNING</span>
      </div>
      <!-- Line 2: Base, Branch, Path -->
      <div class="header-line header-line-secondary">
        <span class="header-label">Base:</span>
        <span id="base-ref" class="header-value"></span>
        <span class="header-separator">│</span>
        <span class="header-label">Branch:</span>
        <span id="branch-info" class="header-value"></span>
        <span class="header-separator">│</span>
        <span class="header-label">Path:</span>
        <span id="workspace-path" class="header-value header-path"></span>
      </div>
    </header>

    <!-- Main Content Area -->
    <main id="main-content" class="logs-hidden">
      <!-- Projects Pane -->
      <aside id="projects-pane" class="pane" tabindex="1">
        <div class="resize-handle" id="resize-projects" data-pane="projects"></div>
        <div class="running-overlay" id="projects-overlay">
          <div class="running-overlay-content">
            <div class="running-overlay-spinner">⏳</div>
            <div class="running-overlay-text">Running tests...</div>
          </div>
        </div>
        <div class="pane-header">
          <span class="pane-title">PROJECTS</span>
          <span id="projects-count" class="pane-count"></span>
        </div>
        <div class="pane-commands">
          <span class="cmd"><kbd>j/k</kbd> nav</span>
          <span class="cmd"><kbd>Enter</kbd> select</span>
          <span class="cmd"><kbd>⌘R</kbd> run all</span>
          <span class="cmd"><kbd>⌘⇧R</kbd> run changed</span>
          <span class="cmd"><kbd>Tab</kbd> →specs</span>
        </div>
        <div class="pane-content" id="projects-list"></div>
        <div id="history-section" class="history-pane hidden">
          <div class="section-header">
            <span class="section-title">HISTORY</span>
            <span id="history-count" class="section-count"></span>
          </div>
          <div id="history-list"></div>
        </div>
        <div class="history-toggle" id="history-toggle">▼ Show History</div>
      </aside>

      <!-- Specs Pane -->
      <section id="specs-pane" class="pane" tabindex="2">
        <div class="resize-handle" id="resize-specs" data-pane="specs"></div>
        <div class="running-overlay" id="specs-overlay">
          <div class="running-overlay-content">
            <div class="running-overlay-spinner">⏳</div>
            <div class="running-overlay-text">Running tests...</div>
          </div>
        </div>
        <div class="pane-header">
          <span class="pane-title">SPECS</span>
          <span id="specs-project-name" class="pane-subtitle"></span>
          <div class="pane-actions">
            <button id="select-all-btn" class="btn-small" tabindex="-1" title="Select All (Ctrl+A)">All</button>
            <button id="clear-btn" class="btn-small" tabindex="-1" title="Clear (Ctrl+L)">Clear</button>
          </div>
        </div>
        <div class="pane-commands">
          <span class="cmd"><kbd>j/k</kbd> nav</span>
          <span class="cmd"><kbd>Space</kbd> toggle</span>
          <span class="cmd"><kbd>Enter</kbd> menu</span>
          <span class="cmd"><kbd>⌘R</kbd> run spec</span>
          <span class="cmd"><kbd>⌘⇧R</kbd> run all</span>
          <span class="cmd"><kbd>Tab</kbd> →output</span>
        </div>
        <div class="search-container">
          <input type="text" id="search-input" placeholder="Type to search... (or / or Ctrl+F)" tabindex="-1" />
          <button id="search-clear" class="btn-icon" tabindex="-1" title="Clear search">×</button>
        </div>
        <div class="pane-content" id="specs-list"></div>
        <div id="missing-specs-section" style="display: none;">
          <div class="section-header">
            <span class="section-title">MISSING SPECS</span>
            <span id="missing-count" class="section-count"></span>
          </div>
          <div id="missing-specs-list"></div>
        </div>
        <div class="specs-footer">
          <span id="selection-info">Selected: 0</span>
          <span id="failed-info"></span>
          <div class="footer-actions">
            <button id="rerun-failed-btn" class="btn-secondary" tabindex="-1" style="display: none;">Re-run Failed</button>
            <button id="run-selected-btn" class="btn-primary" tabindex="-1" disabled>Run Selected</button>
          </div>
        </div>
      </section>

      <!-- Logs Pane -->
      <aside id="logs-pane" class="pane" tabindex="3">
        <div class="pane-header">
          <span class="pane-title">LOGS</span>
          <button id="logs-toggle" class="btn-icon" tabindex="-1" title="Toggle Logs (\`)">−</button>
        </div>
        <div class="pane-commands">
          <span class="cmd"><kbd>\`</kbd> toggle</span>
          <span class="cmd"><kbd>Tab</kbd> →output</span>
        </div>
        <div class="pane-content" id="logs-list"></div>
      </aside>
    </main>

    <!-- Horizontal Resize Handle for Output -->
    <div class="resize-handle-horizontal" id="resize-output"></div>

    <!-- Output Pane -->
    <section id="output-pane" class="pane" tabindex="4">
      <div class="pane-header">
        <span class="pane-title">OUTPUT</span>
        <div class="pane-actions">
          <button id="output-raw-btn" class="btn-toggle active" tabindex="-1">Raw</button>
          <button id="output-structured-btn" class="btn-toggle" tabindex="-1">Structured</button>
          <button id="cancel-btn" class="btn-danger" tabindex="-1" style="display: none;">Cancel</button>
        </div>
      </div>
      <div class="pane-commands">
        <span class="cmd"><kbd>⌘X</kbd> cancel</span>
        <span class="cmd"><kbd>Tab</kbd> →projects</span>
      </div>
      <div class="pane-content" id="output-content">
        <pre id="output-raw"></pre>
        <div id="output-structured" style="display: none;"></div>
      </div>
    </section>

    <!-- Footer Bar -->
    <footer id="footer-bar">
      <span class="shortcut"><kbd>Tab</kbd>:pane</span>
      <span class="shortcut"><kbd>Ctrl+R</kbd>:run</span>
      <span class="shortcut"><kbd>Ctrl+X</kbd>:cancel</span>
      <span class="shortcut"><kbd>Ctrl+F</kbd>:search</span>
      <span class="shortcut"><kbd>\`</kbd>:logs</span>
      <span class="shortcut"><kbd>c</kbd>:compact</span>
      <span class="shortcut"><kbd>?</kbd>:help</span>
    </footer>

    <!-- Context Menu -->
    <div id="context-menu" class="context-menu" style="display: none;">
      <div class="context-menu-title" id="context-menu-title">spec.ts</div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" data-action="run" tabindex="0">▶ Run Spec</div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" data-action="aiFix" tabindex="0">✨ AI Fix Errors</div>
      <div class="context-menu-item" data-action="aiWrite" tabindex="0">✨ AI Write Tests</div>
      <div class="context-menu-item" data-action="aiRefactor" tabindex="0">✨ AI Refactor</div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" data-action="open" tabindex="0">📄 Open File</div>
      <div class="context-menu-item" data-action="pin" tabindex="0">★ Pin/Unpin</div>
    </div>
  </div>

  <script nonce="${nonce}">
    ${getScript()}
  </script>
</body>
</html>`;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function getStyles(): string {
  return `
    :root {
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-sideBar-background);
      --bg-tertiary: var(--vscode-input-background);
      --fg-primary: var(--vscode-foreground);
      --fg-secondary: var(--vscode-descriptionForeground);
      --fg-muted: var(--vscode-disabledForeground);
      --border-color: var(--vscode-panel-border);
      --accent: var(--vscode-focusBorder);
      --pass: var(--vscode-testing-iconPassed, #4caf50);
      --fail: var(--vscode-testing-iconFailed, #f44336);
      --skip: var(--vscode-testing-iconSkipped, #ff9800);
      --running: var(--vscode-progressBar-background, #0078d4);
      --warning: var(--vscode-editorWarning-foreground, #ff9800);
      --btn-bg: var(--vscode-button-background);
      --btn-fg: var(--vscode-button-foreground);
      --btn-hover: var(--vscode-button-hoverBackground);
      --coverage-good: #4caf50;
      --coverage-warning: #ff9800;
      --coverage-danger: #f44336;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size, 13px);
      color: var(--fg-primary);
      background: var(--bg-primary);
      height: 100vh;
      overflow: hidden;
    }

    #app {
      display: grid;
      grid-template-rows: auto 1fr auto minmax(150px, 40%) auto;
      height: 100vh;
    }

    /* Header */
    #header-bar {
      display: flex;
      flex-direction: column;
      padding: 4px 12px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      font-size: 11px;
    }

    .header-line {
      display: flex;
      align-items: center;
      gap: 0;
      height: 20px;
    }

    .header-line-secondary {
      margin-top: 2px;
    }

    .header-separator {
      color: var(--fg-dimmed);
      margin: 0 8px;
    }

    .header-status {
      color: var(--pass);
      font-weight: 600;
    }

    .header-status.running {
      color: var(--running);
    }

    .header-label {
      color: var(--accent);
      font-weight: 600;
      margin-right: 4px;
    }

    .header-value {
      color: var(--fg-secondary);
    }

    .header-info {
      color: var(--fg-muted);
    }

    .header-path {
      color: var(--fg-dimmed);
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .header-logs {
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s;
    }

    .header-logs:hover {
      opacity: 0.85;
    }

    .header-logs.on {
      background: var(--accent);
      color: var(--bg-primary);
    }

    .header-logs.off {
      background: var(--bg-tertiary);
      color: var(--fg-dimmed);
    }

    .header-spacer {
      flex: 1;
    }

    .header-progress {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-running {
      color: var(--running);
      font-weight: 600;
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .progress-bar {
      width: 150px;
      height: 4px;
      background: var(--bg-tertiary);
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--running);
      transition: width 0.3s ease;
    }

    .progress-text {
      margin-left: 8px;
      color: var(--running);
      font-weight: 600;
    }

    /* Main Content - Resizable Panes */
    #main-content {
      display: grid;
      grid-template-columns: minmax(200px, 30%) 1fr minmax(150px, 200px);
      overflow: hidden;
      min-height: 0;
    }

    #main-content.logs-hidden {
      grid-template-columns: minmax(200px, 30%) 1fr;
    }

    #main-content.logs-hidden #logs-pane {
      display: none;
    }

    /* Resize handles - vertical (between columns) */
    .resize-handle {
      width: 4px;
      cursor: col-resize;
      background: transparent;
      position: absolute;
      top: 0;
      bottom: 0;
      right: -2px;
      z-index: 10;
    }

    .resize-handle:hover,
    .resize-handle.dragging {
      background: var(--accent);
    }

    /* Resize handle - horizontal (between rows) */
    .resize-handle-horizontal {
      height: 4px;
      cursor: row-resize;
      background: transparent;
      transition: background 0.15s;
    }

    .resize-handle-horizontal:hover,
    .resize-handle-horizontal.dragging {
      background: var(--accent);
    }

    /* Panes */
    .pane {
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--border-color);
      overflow: hidden;
      position: relative; /* For overlay positioning */
    }

    .pane:last-child {
      border-right: none;
    }

    .pane:focus {
      outline: none;
    }

    .pane:focus .pane-header,
    .pane.focused-pane .pane-header {
      border-bottom-color: var(--accent);
    }
    
    .pane.focused-pane .pane-commands {
      color: var(--fg-secondary);
      border-bottom-color: var(--accent);
    }

    .pane-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .pane-commands {
      padding: 3px 8px;
      font-size: 11px;
      color: var(--fg-dimmed);
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
      font-family: var(--vscode-editor-font-family), monospace;
      display: flex;
      flex-wrap: wrap;
      gap: 2px 12px;
    }

    .pane-commands .cmd {
      white-space: nowrap;
    }

    .pane-commands kbd {
      background: var(--bg-tertiary);
      padding: 1px 4px;
      border-radius: 2px;
      font-size: 10px;
      color: var(--accent);
      font-weight: 500;
    }

    .pane:focus .pane-commands {
      color: var(--fg-secondary);
      border-bottom-color: var(--accent);
    }

    .pane-title {
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--fg-secondary);
    }

    .pane-subtitle {
      color: var(--accent);
      font-weight: 500;
    }

    .pane-count, .section-count {
      color: var(--fg-muted);
      font-size: 11px;
    }

    .pane-actions {
      margin-left: auto;
      display: flex;
      gap: 4px;
    }

    .pane-content {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
    }

    /* Search */
    .search-container {
      display: flex;
      padding: 8px 12px;
      gap: 4px;
      border-bottom: 1px solid var(--border-color);
    }

    #search-input {
      flex: 1;
      padding: 4px 8px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--fg-primary);
      border-radius: 3px;
      font-size: 12px;
    }

    #search-input:focus {
      outline: none;
      border-color: var(--accent);
    }

    /* Buttons */
    .btn-primary {
      background: var(--btn-bg);
      color: var(--btn-fg);
      border: none;
      padding: 4px 12px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--btn-hover);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: transparent;
      color: var(--accent);
      border: 1px solid var(--accent);
      padding: 4px 12px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }

    .btn-secondary:hover {
      background: var(--bg-tertiary);
    }

    .btn-small {
      background: transparent;
      color: var(--fg-secondary);
      border: 1px solid var(--border-color);
      padding: 2px 6px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 10px;
    }

    .btn-small:hover {
      background: var(--bg-tertiary);
    }

    .btn-icon {
      background: transparent;
      color: var(--fg-muted);
      border: none;
      cursor: pointer;
      padding: 2px 6px;
      font-size: 14px;
    }

    .btn-icon:hover {
      color: var(--fg-primary);
    }

    .btn-toggle {
      background: transparent;
      color: var(--fg-muted);
      border: 1px solid var(--border-color);
      padding: 2px 8px;
      cursor: pointer;
      font-size: 10px;
    }

    .btn-toggle.active {
      background: var(--bg-tertiary);
      color: var(--fg-primary);
      border-color: var(--accent);
    }

    .btn-danger {
      background: var(--fail);
      color: white;
      border: none;
      padding: 4px 12px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }

    /* Project Items - Condensed */
    .project-item {
      padding: 4px 8px;
      cursor: pointer;
      border-left: 2px solid transparent;
      margin-bottom: 2px;
    }

    .project-item:hover {
      background: var(--bg-tertiary);
    }

    .project-item.selected {
      background: var(--bg-tertiary);
      border-left-color: var(--accent);
    }

    .project-item.running {
      border-left-color: var(--running);
    }

    .project-item.disabled {
      opacity: 0.6;
      pointer-events: none;
    }

    .project-name {
      font-weight: 500;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }

    .runner-tag {
      font-size: 8px;
      padding: 1px 4px;
      border-radius: 3px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .runner-tag.runner-jest {
      background: #99425b;
      color: #fff;
    }

    .runner-tag.runner-karma {
      background: #555;
      color: #aaa;
    }

    .project-item.runner-karma {
      opacity: 0.7;
    }

    .status-icon {
      font-size: 11px;
      width: 14px;
      text-align: center;
    }
    .status-icon.pass { color: var(--pass); }
    .status-icon.fail { color: var(--fail); }
    .status-icon.skip, .status-icon.pending { color: var(--fg-dimmed); }
    .status-icon.running { animation: pulse 1s infinite; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .spec-count {
      font-size: 10px;
      color: var(--accent);
      margin-left: 6px;
    }

    .missing-count {
      font-size: 10px;
      color: #c678dd;
    }

    .no-run {
      color: var(--fg-dimmed);
      font-style: italic;
      font-size: 10px;
    }

    /* Project Metrics - Console app style */
    .project-metrics {
      font-size: 10px;
      color: var(--fg-muted);
      display: flex;
      gap: 8px;
      margin-top: 2px;
      align-items: center;
      flex-wrap: wrap;
      flex-wrap: wrap;
      align-items: center;
    }

    .metric-group {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .metric-pass { color: var(--pass); font-weight: 600; }
    .metric-fail { color: var(--fail); font-weight: 600; }
    .metric-skip { color: var(--skip); }
    .metric-total { color: var(--fg-secondary); font-weight: 500; }

    .coverage-text {
      font-size: 10px;
      color: var(--fg-dimmed);
      margin-left: 8px;
    }

    .metric-duration {
      color: var(--fg-dimmed);
      margin-left: 4px;
    }

    .coverage-badge {
      padding: 1px 4px;
      border-radius: 2px;
      font-size: 9px;
      font-weight: 500;
    }

    .coverage-badge.good { background: var(--coverage-good); color: white; }
    .coverage-badge.warning { background: var(--coverage-warning); color: black; }
    .coverage-badge.danger { background: var(--coverage-danger); color: white; }

    /* Failure Preview (inline) */
    .failure-preview {
      margin-top: 4px;
      padding: 6px 8px;
      background: var(--bg-tertiary);
      border-left: 2px solid var(--fail);
      font-size: 11px;
      border-radius: 2px;
    }

    .failure-preview-item {
      display: flex;
      gap: 8px;
      padding: 2px 0;
      cursor: pointer;
    }

    .failure-preview-item:hover {
      color: var(--accent);
    }

    .failure-test-name {
      color: var(--fail);
      font-weight: 500;
    }

    .failure-error {
      color: var(--fg-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Clickable stack trace links */
    .stack-link {
      color: var(--accent);
      cursor: pointer;
      text-decoration: underline;
    }

    .stack-link:hover {
      color: var(--fg-primary);
    }

    /* Spec Items */
    .spec-item {
      padding: 3px 8px;
      display: flex;
      align-items: center; /* Center all items vertically */
      gap: 6px;
      cursor: pointer;
      border-left: 2px solid transparent;
      min-height: 24px;
    }

    .spec-item:hover {
      background: var(--bg-tertiary);
    }

    .spec-item.selected {
      background: rgba(var(--accent), 0.1);
    }

    .spec-item.pinned {
      border-left-color: var(--warning);
      background: rgba(255, 200, 0, 0.05);
    }

    .spec-item.disabled {
      opacity: 0.6;
      pointer-events: none;
    }

    .spec-item.karma-spec {
      opacity: 0.8;
    }

    .spec-item.karma-spec .spec-checkbox {
      visibility: hidden;
    }

    .specs-section-header {
      font-size: 10px;
      font-weight: 600;
      color: var(--warning);
      padding: 4px 12px;
      background: rgba(255, 200, 0, 0.1);
      border-bottom: 1px solid var(--border-color);
    }

    .specs-separator {
      height: 1px;
      background: var(--border-color);
      margin: 8px 0;
    }

    .spec-item.running {
      background: rgba(0, 120, 212, 0.1);
    }

    .spec-item.focused {
      outline: 1px solid var(--accent);
      outline-offset: -1px;
    }

    .spec-checkbox {
      width: 14px;
      height: 14px;
      cursor: pointer;
    }

    .spec-status {
      width: 16px;
      text-align: center;
      font-size: 12px;
    }

    .spec-status.pass { color: var(--pass); }
    .spec-status.fail { color: var(--fail); }
    .spec-status.pending { color: var(--fg-muted); }
    .spec-status.running { color: var(--running); }

    .spec-name-wrapper {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .spec-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .spec-name.fail { color: var(--fail); }
    .spec-name.pass { color: var(--pass); }

    .spec-name .search-match {
      background: var(--accent);
      color: var(--bg-primary);
      border-radius: 2px;
      padding: 0 2px;
    }

    .spec-path {
      font-size: 9px;
      color: #555; /* Light grey, non-prominent */
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex-shrink: 1;
      min-width: 0;
    }

    .spec-details {
      font-size: 10px;
      color: var(--fg-muted);
      display: flex;
      gap: 6px;
      align-items: center;
      margin-left: auto;
    }

    .spec-metric-inline {
      display: flex;
      gap: 4px;
      align-items: center;
      font-size: 10px;
      font-family: var(--vscode-editor-font-family), monospace;
    }

    .spec-metric-inline .metric-pass { color: var(--pass); font-weight: 600; }
    .spec-metric-inline .metric-fail { color: var(--fail); font-weight: 600; }
    .spec-metric-inline .metric-skip { color: var(--skip); }
    .spec-metric-inline .metric-total { color: var(--fg-secondary); }
    .spec-metric-inline .metric-duration { color: var(--fg-dimmed); margin-left: 4px; }

    .spec-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .spec-item:hover .spec-actions {
      opacity: 1;
    }

    .spec-action-btn {
      background: transparent;
      border: none;
      color: var(--fg-muted);
      cursor: pointer;
      padding: 2px 4px;
      font-size: 12px;
    }

    .spec-action-btn:hover {
      color: var(--accent);
    }

    .change-badge {
      font-size: 9px;
      padding: 1px 4px;
      border-radius: 2px;
      font-weight: 500;
    }

    .change-badge.unstaged { background: var(--fail); color: white; }
    .change-badge.staged { background: var(--skip); color: black; }
    .change-badge.committed { background: var(--pass); color: white; }

    .warning-badge {
      font-size: 9px;
      padding: 1px 4px;
      border-radius: 2px;
      margin-left: 4px;
    }

    .warning-badge.slow {
      background: var(--warning);
      color: black;
    }

    .warning-badge.flaky {
      background: #9c27b0;
      color: white;
    }

    .duration-trend {
      font-size: 10px;
      margin-left: 2px;
    }

    .duration-trend.faster { color: var(--pass); }
    .duration-trend.slower { color: var(--fail); }

    /* Missing Specs */
    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
    }

    .section-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--warning);
    }

    .missing-item {
      padding: 6px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--fg-muted);
    }

    .missing-icon {
      color: var(--warning);
    }

    /* Specs Footer */
    .specs-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
      font-size: 11px;
    }

    .footer-actions {
      display: flex;
      gap: 8px;
    }

    /* History */
    #history-section {
      border-top: 1px solid var(--border-color);
      max-height: 150px;
      overflow-y: auto;
    }

    .history-item {
      padding: 4px 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      cursor: pointer;
    }

    .history-item:hover {
      background: var(--bg-tertiary);
    }

    .history-time {
      color: var(--fg-muted);
      flex-shrink: 0;
    }

    .history-project {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .history-result {
      flex-shrink: 0;
    }

    .history-result.pass { color: var(--pass); }
    .history-result.fail { color: var(--fail); }

    .history-rerun {
      color: var(--fg-muted);
      cursor: pointer;
      padding: 2px 4px;
    }

    .history-rerun:hover {
      color: var(--accent);
    }

    /* Logs */
    .log-entry {
      padding: 1px 8px;
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      line-height: 1.4;
    }

    .log-prefix {
      color: var(--fg-muted);
      margin-right: 6px;
    }

    .log-level {
      font-weight: 500;
      font-weight: 500;
    }

    .log-level.info { color: #3794ff; }
    .log-level.debug { color: var(--fg-muted); }
    .log-level.warn { color: var(--warning); }
    .log-level.error { color: var(--fail); }
    .log-level.action { color: var(--accent); }

    .log-message {
      flex: 1;
      word-break: break-all;
    }

    /* Output */
    #output-pane {
      border-top: 1px solid var(--border-color);
      height: 200px;
      min-height: 100px;
      resize: vertical;
      overflow: hidden;
    }

    #output-content {
      overflow: auto;
    }

    #output-raw {
      margin: 0;
      padding: 8px 12px;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-all;
    }

    /* ANSI Colors */
    .ansi-red { color: #f44336; }
    .ansi-green { color: #4caf50; }
    .ansi-yellow { color: #ff9800; }
    .ansi-blue { color: #2196f3; }
    .ansi-magenta { color: #e91e63; }
    .ansi-cyan { color: #00bcd4; }
    .ansi-white { color: #ffffff; }
    .ansi-bold { font-weight: bold; }
    .ansi-dim { opacity: 0.7; }

    /* Structured Output */
    .structured-result {
      margin-bottom: 8px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      overflow: hidden;
    }

    .structured-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      font-weight: 500;
      font-size: 12px;
    }

    .structured-header.pass {
      background: rgba(76, 175, 80, 0.1);
      color: var(--pass);
    }

    .structured-header.fail {
      background: rgba(244, 67, 54, 0.1);
      color: var(--fail);
    }

    .structured-file {
      flex: 1;
      color: var(--fg-primary);
    }

    .structured-duration {
      color: var(--fg-muted);
      font-size: 11px;
    }

    .structured-tests {
      padding: 4px 10px;
      border-top: 1px solid var(--border-color);
    }

    .structured-test {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 3px 0;
      font-size: 11px;
    }

    .structured-test.pass { color: var(--pass); }
    .structured-test.fail { color: var(--fail); }

    .structured-error {
      margin-left: 20px;
      padding: 4px 8px;
      background: var(--bg-tertiary);
      color: var(--fg-muted);
      font-family: var(--vscode-editor-font-family);
      font-size: 10px;
      border-left: 2px solid var(--fail);
      white-space: pre-wrap;
    }

    /* Footer */
    #footer-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 4px 12px;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
      font-size: 11px;
    }

    .shortcut {
      color: var(--fg-muted);
    }

    kbd {
      background: var(--bg-tertiary);
      padding: 1px 4px;
      border-radius: 2px;
      font-family: var(--vscode-editor-font-family);
      font-size: 10px;
    }

    /* Context Menu */
    .context-menu {
      position: fixed;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 4px 0;
      min-width: 200px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      z-index: 1000;
    }

    .context-menu-title {
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      color: var(--fg-primary);
      background: var(--bg-tertiary);
      border-radius: 4px 4px 0 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 250px;
    }

    .context-menu-item {
      padding: 8px 12px;
      cursor: pointer;
      font-size: 12px;
      color: var(--fg-primary);
      outline: none;
    }

    .context-menu-item:hover:not(.disabled),
    .context-menu-item:focus:not(.disabled) {
      background: var(--accent);
      color: var(--bg-primary);
    }

    .context-menu-item.disabled {
      color: var(--fg-dimmed);
      cursor: not-allowed;
    }

    .context-menu-separator {
      height: 1px;
      background: var(--border-color);
      margin: 4px 0;
    }

    /* Running Overlay */
    .running-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.3);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 50;
      backdrop-filter: blur(1px);
    }

    .running-overlay.active {
      display: flex;
    }

    .running-overlay-content {
      background: var(--bg-secondary);
      padding: 12px 24px;
      border-radius: 6px;
      border: 1px solid var(--running);
      text-align: center;
    }

    .running-overlay-spinner {
      font-size: 24px;
      margin-bottom: 8px;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .running-overlay-text {
      color: var(--running);
      font-size: 12px;
      font-weight: 500;
    }

    /* History pane hidden by default */
    .history-pane.hidden {
      display: none;
    }

    .history-toggle {
      cursor: pointer;
      color: var(--accent);
      font-size: 10px;
      padding: 4px 8px;
      text-align: center;
      background: var(--bg-tertiary);
    }

    .history-toggle:hover {
      background: var(--bg-secondary);
    }

    /* Compact Mode */
    .compact .spec-item {
      padding: 2px 8px;
      font-size: 11px;
    }

    .compact .spec-checkbox {
      width: 12px;
      height: 12px;
    }

    .compact .spec-status {
      width: 14px;
      font-size: 11px;
    }

    .compact .spec-details {
      font-size: 9px;
    }

    .compact .spec-actions {
      gap: 2px;
    }

    .compact .spec-action-btn {
      padding: 1px 3px;
      font-size: 10px;
    }

    .compact .project-item {
      padding: 3px 8px;
      font-size: 11px;
    }

    .compact .project-name {
      margin-bottom: 0;
      display: inline;
    }

    .compact .project-metrics {
      display: inline;
      margin-left: 8px;
      font-size: 10px;
    }

    .compact .failure-preview {
      padding: 4px 6px;
      margin-top: 2px;
      font-size: 10px;
    }

    .compact .pane-header {
      padding: 4px 8px;
    }

    .compact .pane-title {
      font-size: 10px;
    }

    .compact .log-entry {
      font-size: 10px;
      padding: 1px 6px;
    }

    .compact #footer-bar {
      padding: 2px 8px;
      font-size: 10px;
    }

    .compact kbd {
      font-size: 9px;
      padding: 0 3px;
    }

    /* Spinner */
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .spinner {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid var(--fg-muted);
      border-top-color: var(--running);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    /* Empty State */
    .empty-state {
      padding: 20px;
      text-align: center;
      color: var(--fg-muted);
    }
  `;
}

function getScript(): string {
  return `
    (function() {
      const vscode = acquireVsCodeApi();
      
      // State
      let state = {
        projects: [],
        selectedProject: null,
        specs: [],
        missingSpecs: [],
        selectedSpecs: new Set(),
        pinnedSpecs: new Set(),
        runningState: { isRunning: false },
        logs: [],
        runHistory: [],
        searchQuery: '',
        logsVisible: false, // Hidden by default
        compactMode: false,
        focusedPane: 'projects',
        config: { baseRef: '', branch: '', workspacePath: '' }
      };

      // DOM Elements
      const elements = {
        projectsList: document.getElementById('projects-list'),
        historyList: document.getElementById('history-list'),
        historyCount: document.getElementById('history-count'),
        historySection: document.getElementById('history-section'),
        historyToggle: document.getElementById('history-toggle'),
        specsList: document.getElementById('specs-list'),
        missingSpecsList: document.getElementById('missing-specs-list'),
        missingSection: document.getElementById('missing-specs-section'),
        logsList: document.getElementById('logs-list'),
        outputRaw: document.getElementById('output-raw'),
        outputStructured: document.getElementById('output-structured'),
        searchInput: document.getElementById('search-input'),
        statusText: document.getElementById('status-text'),
        projectInfo: document.getElementById('project-info'),
        progressContainer: document.getElementById('progress-container'),
        progressFill: document.getElementById('progress-fill'),
        progressText: document.getElementById('progress-text'),
        runningIndicator: document.getElementById('running-indicator'),
        logsIndicator: document.getElementById('logs-indicator'),
        baseRef: document.getElementById('base-ref'),
        workspacePath: document.getElementById('workspace-path'),
        selectionInfo: document.getElementById('selection-info'),
        failedInfo: document.getElementById('failed-info'),
        runSelectedBtn: document.getElementById('run-selected-btn'),
        rerunFailedBtn: document.getElementById('rerun-failed-btn'),
        cancelBtn: document.getElementById('cancel-btn'),
        mainContent: document.getElementById('main-content'),
        specsProjectName: document.getElementById('specs-project-name'),
        projectsCount: document.getElementById('projects-count'),
        missingCount: document.getElementById('missing-count'),
        cacheInfo: document.getElementById('cache-info'),
        branchInfo: document.getElementById('branch-info'),
        projectsOverlay: document.getElementById('projects-overlay'),
        specsOverlay: document.getElementById('specs-overlay')
      };

      // Send message to extension
      function send(type, payload) {
        vscode.postMessage({ type, payload });
      }

      // Handle messages from extension
      window.addEventListener('message', event => {
        const message = event.data;
        console.log('[ET WebView] Received message:', message.type, message.payload);
        switch (message.type) {
          case 'initialize':
            console.log('[ET WebView] Initialize with', message.payload?.projects?.length, 'projects');
            handleInitialize(message.payload);
            break;
          case 'updateProjects':
            console.log('[ET WebView] Update projects:', message.payload?.projects?.length);
            state.projects = message.payload.projects;
            
            // Update branch and path if provided
            if (message.payload.branch) {
              elements.branchInfo.textContent = message.payload.branch;
            }
            if (message.payload.workspacePath) {
              elements.workspacePath.textContent = message.payload.workspacePath;
            }
            
            // Auto-select first project if none selected
            if (!state.selectedProject && state.projects.length > 0) {
              state.selectedProject = state.projects[0].name;
              send('selectProject', { projectName: state.selectedProject });
              focusedProjectIndex = 0;
            }
            
            renderProjects();
            renderSpecs();
            updateHeader();
            break;
          case 'updateSpecs':
            state.specs = message.payload.specs;
            state.missingSpecs = message.payload.missingSpecs;
            renderSpecs();
            break;
          case 'updateOutput':
            handleOutputUpdate(message.payload);
            break;
          case 'addLog':
            state.logs.push(message.payload);
            renderLogs();
            break;
          case 'updateRunningState':
            state.runningState = message.payload;
            updateRunningUI();
            break;
          case 'updateUIState':
            handleUIStateUpdate(message.payload);
            break;
          case 'updateRunHistory':
            state.runHistory = message.payload.history;
            renderHistory();
            break;
        }
      });

      function handleInitialize(payload) {
        if (!payload) {
          console.error('[ET WebView] handleInitialize: No payload received');
          return;
        }
        
        state.projects = payload.projects || [];
        
        const uiState = payload.uiState || {};
        state.selectedProject = uiState.selectedProjectName || null;
        state.selectedSpecs = new Set(Array.isArray(uiState.selectedSpecPaths) ? uiState.selectedSpecPaths : []);
        state.pinnedSpecs = new Set(Array.isArray(uiState.pinnedSpecPaths) ? uiState.pinnedSpecPaths : []);
        state.logsVisible = uiState.logsVisible === true; // Default to hidden
        state.compactMode = uiState.compactMode || false;
        
        state.runningState = payload.runningState || { isRunning: false };
        state.logs = payload.logs || [];
        state.runHistory = payload.runHistory || [];
        
        if (payload.config) {
          state.config = payload.config;
          elements.baseRef.textContent = payload.config.baseRef || 'origin/main';
          elements.branchInfo.textContent = payload.config.branch || '';
          elements.workspacePath.textContent = payload.config.workspacePath || '';
        }

        console.log('[ET WebView] Initialized with', state.projects.length, 'projects');
        renderAll();
        updateHeader();
      }

      function handleUIStateUpdate(uiState) {
        if (uiState.selectedSpecPaths) {
          state.selectedSpecs = new Set(uiState.selectedSpecPaths);
        }
        if (uiState.pinnedSpecPaths) {
          state.pinnedSpecs = new Set(uiState.pinnedSpecPaths);
        }
        if (uiState.logsVisible !== undefined) {
          state.logsVisible = uiState.logsVisible;
          elements.mainContent.classList.toggle('logs-hidden', !state.logsVisible);
        }
        if (uiState.compactMode !== undefined) {
          state.compactMode = uiState.compactMode;
          document.body.classList.toggle('compact', state.compactMode);
        }
        renderSpecs();
        updateFooter();
        updateHeader(); // Update logs toggle button state
      }

      function handleOutputUpdate(payload) {
        if (payload.append) {
          elements.outputRaw.innerHTML += parseOutputWithStackLinks(payload.content);
        } else {
          elements.outputRaw.innerHTML = parseOutputWithStackLinks(payload.content);
        }
        // Auto-scroll the output container to bottom
        const outputContainer = elements.outputRaw.parentElement;
        outputContainer.scrollTop = outputContainer.scrollHeight;

        // Add click handlers for stack trace links
        elements.outputRaw.querySelectorAll('.stack-link').forEach(link => {
          if (!link.dataset.bound) {
            link.dataset.bound = 'true';
            link.addEventListener('click', e => {
              e.preventDefault();
              const filePath = link.dataset.file;
              const line = parseInt(link.dataset.line, 10);
              const column = parseInt(link.dataset.column, 10) || 1;
              send('openFile', { filePath, line, column });
            });
          }
        });
      }

      // Parse output and make file:line:column references clickable
      function parseOutputWithStackLinks(text) {
        // Match patterns like:
        // at Object.<anonymous> (src/auth.guard.spec.ts:45:12)
        // src/auth.guard.spec.ts:45:12
        // Using a simpler pattern that avoids escaping issues
        const stackPattern = /([a-zA-Z0-9_./-]+\\.[jt]sx?):(\\d+)(?::(\\d+))?/g;
        
        const escaped = escapeHtml(text);
        
        return escaped.replace(stackPattern, (match, file, line, col) => {
          const column = col || '1';
          return \`<span class="stack-link" data-file="\${file}" data-line="\${line}" data-column="\${column}">\${match}</span>\`;
        });
      }

      function renderAll() {
        renderProjects();
        renderHistory();
        renderSpecs();
        renderLogs();
        updateRunningUI();
        updateHeader();
        updateFooter();
        elements.mainContent.classList.toggle('logs-hidden', !state.logsVisible);
        document.body.classList.toggle('compact', state.compactMode);
      }

      function renderHistory() {
        if (!state.runHistory || state.runHistory.length === 0) {
          elements.historyList.innerHTML = '<div class="empty-state" style="padding:8px;font-size:11px;">No recent runs</div>';
          elements.historyCount.textContent = '';
          return;
        }

        elements.historyCount.textContent = \`(\${state.runHistory.length})\`;

        const html = state.runHistory.slice(0, 5).map(entry => {
          const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false
          });
          const hasFailed = entry.failed > 0;
          const resultClass = hasFailed ? 'fail' : 'pass';
          const resultText = hasFailed 
            ? \`✗\${entry.failed}/\${entry.specCount}\`
            : \`✓\${entry.passed}\`;

          return \`
            <div class="history-item" data-history-id="\${entry.id}">
              <span class="history-time">\${time}</span>
              <span class="history-project">\${entry.projectName}</span>
              <span class="history-result \${resultClass}">\${resultText}</span>
              <span class="history-rerun" title="Re-run these specs">↻</span>
            </div>
          \`;
        }).join('');

        elements.historyList.innerHTML = html;

        // Add click handlers for history items
        elements.historyList.querySelectorAll('.history-item').forEach(el => {
          const historyId = el.dataset.historyId;
          const entry = state.runHistory.find(h => h.id === historyId);
          
          if (entry) {
            el.querySelector('.history-rerun').addEventListener('click', e => {
              e.stopPropagation();
              send('runSpecs', { specPaths: entry.specPaths });
            });

            el.addEventListener('click', () => {
              // Select project and specs from this run
              state.selectedProject = entry.projectName;
              send('selectProject', { projectName: entry.projectName });
            });
          }
        });
      }

      function renderProjects() {
        const html = state.projects.map(project => {
          const isSelected = project.name === state.selectedProject;
          const isRunning = state.runningState.isRunning && 
                           state.runningState.projectName === project.name;
          const isJest = project.runner === 'jest';
          const runnerTag = isJest ? 'jest' : 'karma';
          const runnerClass = isJest ? 'runner-jest' : 'runner-karma';
          const blockClass = state.runningState.isRunning ? 'disabled' : '';
          
          // Status icon based on test results
          let statusIcon = '';
          if (isRunning) {
            statusIcon = '<span class="status-icon running">⏳</span>';
          } else if (project.metrics) {
            if (project.metrics.failed > 0) {
              statusIcon = '<span class="status-icon fail">✗</span>';
            } else if (project.metrics.passed > 0) {
              statusIcon = '<span class="status-icon pass">✓</span>';
            } else {
              statusIcon = '<span class="status-icon skip">○</span>';
            }
          } else {
            statusIcon = '<span class="status-icon pending">○</span>';
          }
          
          // Line 1: Status icon, name, runner, spec count
          const specCount = project.specs.length;
          const missingCount = project.missingSpecs?.length || 0;
          const specCountHtml = missingCount > 0 
            ? \`<span class="spec-count">\${specCount} specs</span> <span class="missing-count">+\${missingCount} missing</span>\`
            : \`<span class="spec-count">\${specCount} specs</span>\`;
          
          // Line 2: Metrics (console app style: ✓10 ✗0 ~Σ10  Stmts 96% Funcs 90% Branch 95%)
          let metricsHtml = '';
          if (project.metrics) {
            const total = project.metrics.passed + project.metrics.failed + project.metrics.skipped;
            const duration = (project.metrics.durationMs / 1000).toFixed(1);
            
            // Coverage info - show Stmts, Funcs, Branch like console app
            let coverageHtml = '';
            if (project.metrics.coverage) {
              const cov = project.metrics.coverage;
              const fmtPct = v => v !== undefined ? Math.round(v) + '%' : '--';
              coverageHtml = \`Stmts \${fmtPct(cov.statements)}  Funcs \${fmtPct(cov.functions)}  Branch \${fmtPct(cov.branches)}\`;
            } else {
              coverageHtml = 'no coverage';
            }
            
            metricsHtml = \`
              <span class="metric-pass">✓\${project.metrics.passed}</span>
              <span class="metric-fail">✗\${project.metrics.failed}</span>
              <span class="metric-skip">~\${project.metrics.skipped}</span>
              <span class="metric-total">Σ\${total}</span>
              <span class="metric-duration">\${duration}s</span>
              <span class="coverage-text">\${coverageHtml}</span>
            \`;
          } else {
            metricsHtml = '<span class="no-run">not run yet</span>';
            if (!isJest) {
              metricsHtml += ' <span class="no-run">(Karma)</span>';
            }
          }

          return \`
            <div class="project-item \${isSelected ? 'selected' : ''} \${isRunning ? 'running' : ''} \${runnerClass} \${blockClass}"
                 data-project="\${project.name}" data-runner="\${project.runner}">
              <div class="project-name">
                \${statusIcon}
                \${project.name}
                <span class="runner-tag \${runnerClass}">\${runnerTag}</span>
                \${specCountHtml}
              </div>
              <div class="project-metrics">\${metricsHtml}</div>
            </div>
          \`;
        }).join('');

        elements.projectsList.innerHTML = html || '<div class="empty-state">No projects with changes</div>';
        elements.projectsCount.textContent = \`(\${state.projects.length})\`;

        // Add click handlers
        elements.projectsList.querySelectorAll('.project-item').forEach(el => {
          el.addEventListener('click', () => {
            const projectName = el.dataset.project;
            const wasSelected = state.selectedProject;
            state.selectedProject = projectName;
            
            // Clear selection when changing projects
            if (wasSelected !== projectName) {
              state.selectedSpecs.clear();
              send('clearSelection');
            }
            
            send('selectProject', { projectName });
            renderProjects();
            renderSpecs(); // Re-render specs with current search filter
            updateHeader(); // Update header with project info
            updateFooter(); // Update footer with cleared selection
            focusedSpecIndex = 0;
            highlightFocusedSpec();
          });
        });
      }

      // Fuzzy search implementation
      function fuzzyMatch(str, pattern) {
        pattern = pattern.toLowerCase();
        str = str.toLowerCase();
        
        let patternIdx = 0;
        let strIdx = 0;
        
        while (patternIdx < pattern.length && strIdx < str.length) {
          if (pattern[patternIdx] === str[strIdx]) {
            patternIdx++;
          }
          strIdx++;
        }
        
        return patternIdx === pattern.length;
      }

      // Highlight matching text in search results
      function highlightSearchText(text, query) {
        if (!query) return escapeHtml(text);
        
        // Parse out any prefix filters
        const rawQuery = query.split(/\\s+/).filter(p => !p.includes(':')).join(' ').toLowerCase();
        if (!rawQuery) return escapeHtml(text);
        
        // Simple substring highlight (case-insensitive)
        const lowerText = text.toLowerCase();
        const idx = lowerText.indexOf(rawQuery);
        
        if (idx >= 0) {
          const before = text.slice(0, idx);
          const match = text.slice(idx, idx + rawQuery.length);
          const after = text.slice(idx + rawQuery.length);
          return escapeHtml(before) + '<span class="search-match">' + escapeHtml(match) + '</span>' + escapeHtml(after);
        }
        
        return escapeHtml(text);
      }

      function parseSearchQuery(query) {
        const filters = {
          name: null,
          status: null,
          change: null,
          project: null,
          raw: ''
        };

        const parts = query.split(/\s+/);
        for (const part of parts) {
          if (part.startsWith('status:')) {
            filters.status = part.slice(7).toLowerCase();
          } else if (part.startsWith('change:')) {
            filters.change = part.slice(7).toLowerCase();
          } else if (part.startsWith('name:')) {
            filters.name = part.slice(5).toLowerCase();
          } else if (part.startsWith('project:')) {
            filters.project = part.slice(8).toLowerCase();
          } else {
            filters.raw += (filters.raw ? ' ' : '') + part;
          }
        }

        return filters;
      }

      function filterSpecs(specs, query) {
        if (!query) return specs;
        
        const filters = parseSearchQuery(query);
        
        return specs.filter(spec => {
          // Status filter
          if (filters.status) {
            const statusMatch = filters.status === 'fail' && spec.testStatus === 'fail' ||
                               filters.status === 'pass' && spec.testStatus === 'pass' ||
                               filters.status === 'pending' && spec.testStatus === 'pending';
            if (!statusMatch) return false;
          }

          // Change status filter
          if (filters.change) {
            const changeMatch = filters.change === 'unstaged' && spec.status === 'U' ||
                               filters.change === 'staged' && spec.status === 'S' ||
                               filters.change === 'committed' && spec.status === 'C';
            if (!changeMatch) return false;
          }

          // Name filter (fuzzy)
          if (filters.name) {
            if (!fuzzyMatch(spec.fileName, filters.name)) return false;
          }

          // Raw query (fuzzy match on filename and path)
          if (filters.raw) {
            const matchesName = fuzzyMatch(spec.fileName, filters.raw);
            const matchesPath = fuzzyMatch(spec.relPath, filters.raw);
            if (!matchesName && !matchesPath) return false;
          }

          return true;
        });
      }

      function renderSpecs() {
        const project = state.projects.find(p => p.name === state.selectedProject);
        
        if (!project) {
          elements.specsList.innerHTML = '<div class="empty-state">Select a project</div>';
          elements.specsProjectName.textContent = '';
          elements.missingSection.style.display = 'none';
          return;
        }

        elements.specsProjectName.textContent = project.name;
        state.specs = project.specs;
        state.missingSpecs = project.missingSpecs;

        // Filter specs with fuzzy search
        let filteredSpecs = filterSpecs(state.specs, state.searchQuery);

        // Sort: pinned first, then by status
        filteredSpecs.sort((a, b) => {
          const aPinned = state.pinnedSpecs.has(a.absPath);
          const bPinned = state.pinnedSpecs.has(b.absPath);
          if (aPinned !== bPinned) return bPinned ? 1 : -1;
          if (a.testStatus !== b.testStatus) {
            const order = { fail: 0, running: 1, pending: 2, pass: 3 };
            return (order[a.testStatus] || 4) - (order[b.testStatus] || 4);
          }
          return a.fileName.localeCompare(b.fileName);
        });

        // Separate pinned and unpinned specs for visual separation
        const pinnedSpecs = filteredSpecs.filter(s => state.pinnedSpecs.has(s.absPath));
        const unpinnedSpecs = filteredSpecs.filter(s => !state.pinnedSpecs.has(s.absPath));
        
        // Add separator between pinned and unpinned
        let html = '';
        
        if (pinnedSpecs.length > 0) {
          html += '<div class="specs-section-header">★ PINNED</div>';
          html += pinnedSpecs.map(spec => renderSpecItem(spec, true)).join('');
          
          if (unpinnedSpecs.length > 0) {
            html += '<div class="specs-separator"></div>';
          }
        }
        
        html += unpinnedSpecs.map(spec => renderSpecItem(spec, false)).join('');
        
        function renderSpecItem(spec, isPinned) {
          const isSelected = state.selectedSpecs.has(spec.absPath);
          const isRunning = spec.testStatus === 'running';

          const statusIcon = getStatusIcon(spec.testStatus);
          const changeBadge = getChangeBadge(spec.status);
          
          let metricsHtml = '';
          if (spec.metrics) {
            const durationSec = (spec.metrics.durationMs / 1000).toFixed(1);
            const passed = spec.metrics.passed || 0;
            const failed = spec.metrics.failed || 0;
            const skipped = spec.metrics.skipped || 0;
            const total = passed + failed + skipped;
            
            // Console app style: ✓4 ✗0 ~0 Σ4 1.6s
            metricsHtml = \`
              <span class="spec-metric-inline">
                <span class="metric-pass">✓\${passed}</span>
                <span class="metric-fail">✗\${failed}</span>
                <span class="metric-skip">~\${skipped}</span>
                <span class="metric-total">Σ\${total}</span>
                <span class="metric-duration">\${durationSec}s</span>
              </span>
              \${spec.isSlow ? '<span class="warning-badge slow">SLOW</span>' : ''}
              \${spec.isFlaky ? '<span class="warning-badge flaky">FLAKY</span>' : ''}
            \`;
          }

          // Inline failure preview for failed specs
          let failurePreviewHtml = '';
          if (spec.testStatus === 'fail' && spec.failurePreview && spec.failurePreview.length > 0) {
            const previews = spec.failurePreview.slice(0, 3).map(f => \`
              <div class="failure-preview-item" data-line="\${f.line || ''}">
                <span class="failure-test-name">✗ \${escapeHtml(f.testName)}</span>
                <span class="failure-error">\${escapeHtml(f.errorMessage)}</span>
              </div>
            \`).join('');
            failurePreviewHtml = \`<div class="failure-preview" data-spec="\${spec.absPath}">\${previews}</div>\`;
          }

          // Highlight search text in filename
          const displayName = state.searchQuery 
            ? highlightSearchText(spec.fileName, state.searchQuery)
            : spec.fileName;
          
          // Get relative path to lib (without filename), omitting common prefixes like 'src/lib'
          const libPath = spec.libRelPath || spec.relPath;
          const pathParts = libPath.split('/');
          pathParts.pop(); // Remove filename
          let relDir = pathParts.join('/');
          // Remove common prefixes that add no value
          relDir = relDir.replace(/^src\\/lib\\//, '').replace(/^src\\//, '').replace(/^lib\\//, '');

          // Check if current project is Jest (for enabling/disabling actions)
          const isJestProject = isCurrentProjectJest();
          const checkboxStyle = isJestProject ? '' : 'style="visibility:hidden"';
          const runBtnStyle = isJestProject ? '' : 'style="display:none"';

          return \`
            <div class="spec-item \${isSelected ? 'selected' : ''} \${isPinned ? 'pinned' : ''} \${isRunning ? 'running' : ''} \${!isJestProject ? 'karma-spec' : ''}"
                 data-spec="\${spec.absPath}">
              <input type="checkbox" class="spec-checkbox" tabindex="-1" \${isSelected ? 'checked' : ''} \${checkboxStyle} />
              <span class="spec-status \${spec.testStatus}">\${statusIcon}</span>
              <div class="spec-name-wrapper">
                <span class="spec-name \${spec.testStatus}">\${isPinned ? '★ ' : ''}\${displayName}</span>
                \${relDir ? \`<span class="spec-path">\${relDir}</span>\` : ''}
              </div>
              <span class="spec-details">\${metricsHtml}\${changeBadge}</span>
              <div class="spec-actions">
                <button class="spec-action-btn pin-btn" tabindex="-1" title="\${isPinned ? 'Unpin' : 'Pin'} (Ctrl+D)">\${isPinned ? '★' : '☆'}</button>
                <button class="spec-action-btn run-btn" tabindex="-1" title="Run" \${runBtnStyle}>▶</button>
                <button class="spec-action-btn ai-btn" tabindex="-1" title="AI Assist">✨</button>
              </div>
            </div>
            \${failurePreviewHtml}
          \`;
        }

        elements.specsList.innerHTML = html || '<div class="empty-state">No specs found</div>';

        // Missing specs
        if (state.missingSpecs.length > 0) {
          elements.missingSection.style.display = 'block';
          elements.missingCount.textContent = \`(\${state.missingSpecs.length})\`;
          
          elements.missingSpecsList.innerHTML = state.missingSpecs.map(missing => \`
            <div class="missing-item" data-missing="\${missing.expectedSpecPath}">
              <span class="missing-icon">⚠</span>
              <span class="spec-name">\${missing.expectedSpecPath.split('/').pop()}</span>
              <button class="btn-small">Create</button>
            </div>
          \`).join('');
        } else {
          elements.missingSection.style.display = 'none';
        }

        // Add event handlers
        elements.specsList.querySelectorAll('.spec-item').forEach((el, idx) => {
          const specPath = el.dataset.spec;
          
          el.querySelector('.spec-checkbox').addEventListener('click', e => {
            e.stopPropagation();
            // Only allow selection for Jest projects
            if (isCurrentProjectJest()) {
              send('toggleSpec', { specPath });
            }
          });

          el.querySelector('.run-btn').addEventListener('click', e => {
            e.stopPropagation();
            send('runSpecs', { specPaths: [specPath] });
          });

          el.querySelector('.ai-btn').addEventListener('click', e => {
            e.stopPropagation();
            send('aiAssist', { specPath, action: 'fix' });
          });

          const pinBtn = el.querySelector('.pin-btn');
          if (pinBtn) {
            pinBtn.addEventListener('click', e => {
              e.stopPropagation();
              const isPinned = state.pinnedSpecs.has(specPath);
              if (isPinned) {
                send('unpinSpec', { specPath });
              } else {
                send('pinSpec', { specPath });
              }
            });
          }

          el.addEventListener('click', () => {
            // Set focus to this spec and focus the specs pane
            focusedSpecIndex = idx;
            highlightFocusedSpec();
            focusPane('specs');
            // Only allow selection for Jest projects
            if (isCurrentProjectJest()) {
              send('toggleSpec', { specPath });
            }
          });

          el.addEventListener('dblclick', () => {
            send('openFile', { filePath: specPath });
          });
        });

        // Failure preview click handlers (jump to line)
        elements.specsList.querySelectorAll('.failure-preview-item').forEach(el => {
          el.addEventListener('click', e => {
            e.stopPropagation();
            const specPath = el.closest('.failure-preview').dataset.spec;
            const line = parseInt(el.dataset.line, 10);
            send('openFile', { filePath: specPath, line: line || 1 });
          });
        });

        elements.missingSpecsList.querySelectorAll('.missing-item button').forEach(btn => {
          btn.addEventListener('click', e => {
            e.stopPropagation();
            const item = btn.closest('.missing-item');
            const missingSpec = state.missingSpecs.find(m => 
              m.expectedSpecPath === item.dataset.missing
            );
            if (missingSpec) {
              send('createSpec', {
                missingSpecPath: missingSpec.expectedSpecPath,
                sourcePath: missingSpec.sourcePath
              });
            }
          });
        });

        updateFooter();
      }

      function getStatusIcon(status) {
        switch (status) {
          case 'pass': return '✓';
          case 'fail': return '✗';
          case 'running': return '<span class="spinner"></span>';
          case 'queued': return '○';
          default: return '○';
        }
      }

      function getChangeBadge(status) {
        switch (status) {
          case 'U': return '<span class="change-badge unstaged">U</span>';
          case 'S': return '<span class="change-badge staged">S</span>';
          case 'C': return '<span class="change-badge committed">C</span>';
          default: return '';
        }
      }

      function getCoverageClass(pct) {
        if (pct >= 80) return 'good';
        if (pct >= 50) return 'warning';
        return 'danger';
      }

      function renderLogs() {
        const html = state.logs.slice(-100).map(log => {
          const time = new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const levelShort = { info: 'I', warn: 'W', error: 'E', action: 'A' }[log.level] || log.level[0].toUpperCase();
          return \`<div class="log-entry"><span class="log-prefix">\${time} <span class="log-level \${log.level}">\${levelShort}</span></span>\${escapeHtml(log.message)}</div>\`;
        }).join('');

        elements.logsList.innerHTML = html;
        elements.logsList.scrollTop = elements.logsList.scrollHeight;
      }

      function updateRunningUI() {
        const { isRunning, progress } = state.runningState;
        
        elements.progressContainer.style.display = isRunning ? 'flex' : 'none';
        elements.cancelBtn.style.display = isRunning ? 'block' : 'none';
        elements.statusText.textContent = isRunning ? 'Running...' : 'Ready';
        elements.statusText.classList.toggle('running', isRunning);

        // Show/hide overlays to block interaction during runs
        elements.projectsOverlay.classList.toggle('active', isRunning);
        elements.specsOverlay.classList.toggle('active', isRunning);

        if (isRunning && progress) {
          const pct = Math.round((progress.completed / progress.total) * 100);
          elements.progressFill.style.width = pct + '%';
          elements.progressText.textContent = pct + '%';
        }

        renderProjects();
        renderSpecs();
      }

      function isCurrentProjectJest() {
        const project = state.projects.find(p => p.name === state.selectedProject);
        return project?.runner === 'jest';
      }

      function updateHeader() {
        // Status
        const isRunning = state.runningState?.isRunning;
        const statusText = isRunning ? 'Running' : 'Ready';
        elements.statusText.textContent = \`Status: \${statusText} · \${state.projects.length} projects\`;
        elements.statusText.classList.toggle('running', isRunning);
        
        // Project info
        if (state.selectedProject) {
          const project = state.projects.find(p => p.name === state.selectedProject);
          const specCount = project?.specs?.length || 0;
          elements.projectInfo.textContent = \`Project: \${state.selectedProject} (\${specCount} specs)\`;
        } else {
          elements.projectInfo.textContent = '';
        }
        
        // Cache info
        const cacheEntries = state.projects.reduce((sum, p) => sum + (p.specs?.length || 0), 0);
        elements.cacheInfo.textContent = \`Cache: \${cacheEntries} specs\`;
        
        // Logs indicator
        elements.logsIndicator.classList.toggle('on', state.logsVisible);
        elements.logsIndicator.classList.toggle('off', !state.logsVisible);
        elements.logsIndicator.textContent = state.logsVisible ? 'LOGS' : 'LOGS OFF';
        
        // Running indicator
        elements.runningIndicator.style.display = isRunning ? 'inline' : 'none';
        elements.progressContainer.style.display = isRunning ? 'flex' : 'none';
      }

      function updateFooter() {
        const selectedCount = state.selectedSpecs.size;
        const isJest = isCurrentProjectJest();
        
        elements.selectionInfo.textContent = \`Selected: \${selectedCount}\`;
        elements.runSelectedBtn.disabled = selectedCount === 0 || state.runningState.isRunning || !isJest;
        
        if (!isJest) {
          elements.runSelectedBtn.title = 'Running tests not supported for Karma projects';
        } else {
          elements.runSelectedBtn.title = '';
        }

        const failedCount = state.specs.filter(s => s.testStatus === 'fail').length;
        if (failedCount > 0 && isJest) {
          elements.failedInfo.textContent = \`Failed: \${failedCount}\`;
          elements.rerunFailedBtn.style.display = 'block';
        } else {
          elements.failedInfo.textContent = '';
          elements.rerunFailedBtn.style.display = 'none';
        }
      }

      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

      // Track focused items for keyboard operations
      let focusedSpecIndex = -1;
      let focusedProjectIndex = -1;
      let currentPane = 'specs'; // 'projects', 'specs', 'logs', 'output'
      
      const panes = ['projects', 'specs', 'logs', 'output'];
      const paneElements = {
        projects: document.getElementById('projects-pane'),
        specs: document.getElementById('specs-pane'),
        logs: document.getElementById('logs-pane'),
        output: document.getElementById('output-pane')
      };
      
      function focusPane(paneName) {
        currentPane = paneName;
        Object.values(paneElements).forEach(el => el.classList.remove('focused-pane'));
        paneElements[paneName].classList.add('focused-pane');
        paneElements[paneName].focus();
      }

      // Event Handlers
      
      // Click on pane to focus it
      Object.entries(paneElements).forEach(([name, el]) => {
        el.addEventListener('click', () => {
          if (currentPane !== name) {
            focusPane(name);
          }
        });
      });
      
      elements.searchInput.addEventListener('input', e => {
        state.searchQuery = e.target.value;
        renderSpecs();
      });

      document.getElementById('search-clear').addEventListener('click', () => {
        elements.searchInput.value = '';
        state.searchQuery = '';
        renderSpecs();
      });

      document.getElementById('select-all-btn').addEventListener('click', () => {
        send('selectAllSpecs');
      });

      document.getElementById('clear-btn').addEventListener('click', () => {
        send('clearSelection');
      });

      elements.runSelectedBtn.addEventListener('click', () => {
        send('runSpecs', { specPaths: Array.from(state.selectedSpecs) });
      });

      elements.rerunFailedBtn.addEventListener('click', () => {
        send('rerunFailed');
      });

      elements.cancelBtn.addEventListener('click', () => {
        send('cancelRun');
      });

      document.getElementById('logs-toggle').addEventListener('click', () => {
        send('toggleLogs');
      });

      // History toggle
      elements.historyToggle.addEventListener('click', () => {
        const historySection = elements.historySection;
        const isHidden = historySection.classList.toggle('hidden');
        elements.historyToggle.textContent = isHidden ? '▼ Show History' : '▲ Hide History';
      });

      // Logs indicator toggle
      elements.logsIndicator.addEventListener('click', () => {
        send('toggleLogs');
      });
      
      function nextPane() {
        const idx = panes.indexOf(currentPane);
        const nextIdx = (idx + 1) % panes.length;
        focusPane(panes[nextIdx]);
      }
      
      function getFocusedSpec() {
        const project = state.projects.find(p => p.name === state.selectedProject);
        if (!project || focusedSpecIndex < 0) return null;
        return filterSpecs(project.specs, state.searchQuery)[focusedSpecIndex];
      }
      
      function getFocusedProject() {
        if (focusedProjectIndex < 0 || focusedProjectIndex >= state.projects.length) return null;
        return state.projects[focusedProjectIndex];
      }

      // Initialize first pane focus
      focusPane('specs');

      // Keyboard Navigation
      document.addEventListener('keydown', e => {
        // Skip if typing in search input
        if (document.activeElement === elements.searchInput) {
          if (e.key === 'Escape') {
            elements.searchInput.value = '';
            state.searchQuery = '';
            renderSpecs();
            focusPane('specs');
          } else if (e.key === 'Enter') {
            focusPane('specs');
          }
          return;
        }
        
        // Tab: Navigate between panes
        if (e.key === 'Tab') {
          e.preventDefault();
          nextPane();
          return;
        }
        
        // Global shortcuts (with modifiers)
        if (e.key === '\`') {
          send('toggleLogs');
          e.preventDefault();
          return;
        }
        
        if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (currentPane !== 'output') { // Don't trigger on output pane
            send('toggleCompactMode');
            return;
          }
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
          elements.searchInput.focus();
          e.preventDefault();
          return;
        }
        
        if (e.key === '/') {
          elements.searchInput.focus();
          e.preventDefault();
          return;
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
          if (state.selectedSpecs.size > 0) {
            send('runSpecs', { specPaths: Array.from(state.selectedSpecs) });
          }
          e.preventDefault();
          return;
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
          send('cancelRun');
          e.preventDefault();
          return;
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
          send('refresh');
          e.preventDefault();
          return;
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
          send('selectAllSpecs');
          e.preventDefault();
          return;
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
          send('clearSelection');
          e.preventDefault();
          return;
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
          const focused = getFocusedSpec();
          if (focused) {
            const isPinned = state.pinnedSpecs.has(focused.absPath);
            send(isPinned ? 'unpinSpec' : 'pinSpec', { specPath: focused.absPath });
          }
          e.preventDefault();
          return;
        }
        
        if (e.key === 'Escape') {
          elements.searchInput.value = '';
          state.searchQuery = '';
          renderSpecs();
          return;
        }
        
        // Pane-specific navigation
        if (currentPane === 'projects') {
          if (e.key === 'j' || e.key === 'ArrowDown') {
            focusedProjectIndex = Math.min(focusedProjectIndex + 1, state.projects.length - 1);
            highlightFocusedProject();
            e.preventDefault();
          } else if (e.key === 'k' || e.key === 'ArrowUp') {
            focusedProjectIndex = Math.max(focusedProjectIndex - 1, 0);
            highlightFocusedProject();
            e.preventDefault();
          } else if (e.key === 'Enter' || e.key === ' ') {
            const focused = getFocusedProject();
            if (focused) {
              state.selectedProject = focused.name;
              send('selectProject', { projectName: focused.name });
              renderProjects();
              renderSpecs();
              focusedSpecIndex = 0;
              highlightFocusedSpec();
            }
            e.preventDefault();
          } else if (e.key === 'r' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
            // Ctrl+R: Run all specs in focused project (only if jest)
            const focused = getFocusedProject();
            if (focused && focused.runner === 'jest') {
              send('runProject', { projectName: focused.name });
            }
            e.preventDefault();
          } else if ((e.key === 'R' || (e.key === 'r' && e.shiftKey)) && (e.ctrlKey || e.metaKey)) {
            // Ctrl+Shift+R: Run only changed specs in all jest projects
            send('runAllChanged');
            e.preventDefault();
          }
        } else if (currentPane === 'specs') {
          if (e.key === 'j' || e.key === 'ArrowDown') {
            const project = state.projects.find(p => p.name === state.selectedProject);
            if (project) {
              const filteredSpecs = filterSpecs(project.specs, state.searchQuery);
              // Ensure we start at 0 if not focused yet
              if (focusedSpecIndex < 0) focusedSpecIndex = -1;
              focusedSpecIndex = Math.min(focusedSpecIndex + 1, filteredSpecs.length - 1);
              highlightFocusedSpec();
            }
            e.preventDefault();
          } else if (e.key === 'k' || e.key === 'ArrowUp') {
            focusedSpecIndex = Math.max(focusedSpecIndex - 1, 0);
            highlightFocusedSpec();
            e.preventDefault();
          } else if (e.key === ' ' || e.code === 'Space') {
            // Toggle selection on focused spec (only for jest projects)
            e.preventDefault(); // Prevent page scroll FIRST
            e.stopPropagation();
            // Only allow selection for Jest projects
            if (isCurrentProjectJest()) {
              const focused = getFocusedSpec();
              if (focused) {
                send('toggleSpec', { specPath: focused.absPath });
              }
            }
          } else if (e.key === 'Enter') {
            // Show context menu for focused spec
            const focused = getFocusedSpec();
            if (focused) {
              showSpecContextMenu(focused);
            }
            e.preventDefault();
          } else if (e.key === 'r' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
            // Ctrl+R: Run focused spec (Jest only)
            if (isCurrentProjectJest()) {
              const focused = getFocusedSpec();
              if (focused) {
                send('runSpecs', { specPaths: [focused.absPath] });
              }
            }
            e.preventDefault();
          } else if ((e.key === 'R' || (e.key === 'r' && e.shiftKey)) && (e.ctrlKey || e.metaKey)) {
            // Ctrl+Shift+R: Run all specs in current project (Jest only)
            if (state.selectedProject && isCurrentProjectJest()) {
              send('runProject', { projectName: state.selectedProject });
            }
            e.preventDefault();
          } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && /[a-zA-Z0-9._-]/.test(e.key)) {
            // Type-to-search: any alphanumeric character routes to search
            elements.searchInput.value += e.key;
            state.searchQuery = elements.searchInput.value;
            renderSpecs();
            focusedSpecIndex = 0;
            highlightFocusedSpec();
            e.preventDefault();
          } else if (e.key === 'Backspace') {
            // Backspace removes last character from search
            if (state.searchQuery.length > 0) {
              elements.searchInput.value = state.searchQuery.slice(0, -1);
              state.searchQuery = elements.searchInput.value;
              renderSpecs();
              focusedSpecIndex = 0;
              highlightFocusedSpec();
            }
            e.preventDefault();
          }
        }
      });
      
      function highlightFocusedProject() {
        elements.projectsList.querySelectorAll('.project-item').forEach((el, idx) => {
          el.classList.toggle('focused', idx === focusedProjectIndex);
        });
        const focused = elements.projectsList.querySelector('.project-item.focused');
        if (focused) {
          focused.scrollIntoView({ block: 'nearest' });
        }
      }

      // Context Menu
      let contextMenuSpec = null;
      const contextMenu = document.getElementById('context-menu');

      function showSpecContextMenu(spec) {
        contextMenuSpec = spec;
        const focusedEl = elements.specsList.querySelector('.spec-item.focused');
        if (focusedEl) {
          const rect = focusedEl.getBoundingClientRect();
          contextMenu.style.left = rect.left + 'px';
          contextMenu.style.top = (rect.bottom + 4) + 'px';
          contextMenu.style.display = 'block';
          
          // Set menu title to spec filename
          const menuTitle = document.getElementById('context-menu-title');
          if (menuTitle) {
            menuTitle.textContent = spec.fileName;
          }
          
          // Disable run action for Karma projects
          const isJest = isCurrentProjectJest();
          contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
            const action = item.dataset.action;
            // Disable run for Karma projects (only allow open, pin, AI actions)
            if (action === 'run') {
              item.classList.toggle('disabled', !isJest);
            } else {
              item.classList.remove('disabled');
            }
          });
          
          // Focus first focusable item in menu
          const firstItem = contextMenu.querySelector('.context-menu-item:not(.disabled)');
          if (firstItem) {
            firstItem.focus();
          }
        }
      }

      function hideContextMenu() {
        contextMenu.style.display = 'none';
        contextMenuSpec = null;
      }

      // Close context menu on click outside
      document.addEventListener('click', e => {
        if (!contextMenu.contains(e.target)) {
          hideContextMenu();
        }
      });

      // Context menu keyboard navigation
      contextMenu.addEventListener('keydown', e => {
        const items = Array.from(contextMenu.querySelectorAll('.context-menu-item:not(.disabled)'));
        const currentIdx = items.indexOf(document.activeElement);
        
        if (e.key === 'ArrowDown' || e.key === 'j') {
          e.preventDefault();
          const nextIdx = (currentIdx + 1) % items.length;
          items[nextIdx]?.focus();
        } else if (e.key === 'ArrowUp' || e.key === 'k') {
          e.preventDefault();
          const prevIdx = currentIdx <= 0 ? items.length - 1 : currentIdx - 1;
          items[prevIdx]?.focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          document.activeElement?.click();
        } else if (e.key === 'Escape') {
          hideContextMenu();
          e.preventDefault();
        }
      });

      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && contextMenu.style.display === 'block') {
          hideContextMenu();
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);

      // Context menu actions
      contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', () => {
          if (!contextMenuSpec) return;
          if (item.classList.contains('disabled')) return; // Don't execute disabled actions
          
          const action = item.dataset.action;
          
          switch (action) {
            case 'run':
              send('runSpecs', { specPaths: [contextMenuSpec.absPath] });
              break;
            case 'runAll':
              send('runProject', { projectName: state.selectedProject });
              break;
            case 'toggle':
              send('toggleSpec', { specPath: contextMenuSpec.absPath });
              break;
            case 'pin':
              const isPinned = state.pinnedSpecs.has(contextMenuSpec.absPath);
              send(isPinned ? 'unpinSpec' : 'pinSpec', { specPath: contextMenuSpec.absPath });
              break;
            case 'open':
              send('openFile', { filePath: contextMenuSpec.absPath });
              break;
            case 'aiFix':
              send('aiAssist', { specPath: contextMenuSpec.absPath, action: 'fix' });
              break;
            case 'aiWrite':
              send('aiAssist', { specPath: contextMenuSpec.absPath, action: 'write' });
              break;
            case 'aiRefactor':
              send('aiAssist', { specPath: contextMenuSpec.absPath, action: 'refactor' });
              break;
          }
          hideContextMenu();
        });
      });

      function highlightFocusedSpec() {
        elements.specsList.querySelectorAll('.spec-item').forEach((el, idx) => {
          el.classList.toggle('focused', idx === focusedSpecIndex);
        });
        
        // Scroll into view
        const focused = elements.specsList.querySelector('.spec-item.focused');
        if (focused) {
          focused.scrollIntoView({ block: 'nearest' });
        }
      }

      // Output mode toggle
      let outputMode = 'raw'; // 'raw' or 'structured'
      
      document.getElementById('output-raw-btn').addEventListener('click', () => {
        outputMode = 'raw';
        document.getElementById('output-raw-btn').classList.add('active');
        document.getElementById('output-structured-btn').classList.remove('active');
        document.getElementById('output-raw').style.display = 'block';
        document.getElementById('output-structured').style.display = 'none';
      });

      document.getElementById('output-structured-btn').addEventListener('click', () => {
        outputMode = 'structured';
        document.getElementById('output-raw-btn').classList.remove('active');
        document.getElementById('output-structured-btn').classList.add('active');
        document.getElementById('output-raw').style.display = 'none';
        document.getElementById('output-structured').style.display = 'block';
        renderStructuredOutput();
      });

      function renderStructuredOutput() {
        // Parse the raw output and create structured view
        const rawText = elements.outputRaw.textContent || '';
        const structured = parseTestOutput(rawText);
        
        const html = structured.map(result => {
          const statusClass = result.status === 'pass' ? 'pass' : 'fail';
          const icon = result.status === 'pass' ? '✓' : '✗';
          
          let testsHtml = '';
          if (result.tests && result.tests.length > 0) {
            testsHtml = '<div class="structured-tests">' + result.tests.map(test => {
              const testIcon = test.status === 'pass' ? '✓' : '✗';
              const testClass = test.status === 'pass' ? 'pass' : 'fail';
              return \`
                <div class="structured-test \${testClass}">
                  <span>\${testIcon}</span>
                  <span>\${escapeHtml(test.name)}</span>
                  \${test.error ? \`<div class="structured-error">\${escapeHtml(test.error)}</div>\` : ''}
                </div>
              \`;
            }).join('') + '</div>';
          }

          return \`
            <div class="structured-result">
              <div class="structured-header \${statusClass}">
                <span>\${icon} \${result.status.toUpperCase()}</span>
                <span class="structured-file">\${escapeHtml(result.file)}</span>
                <span class="structured-duration">\${result.duration || ''}</span>
              </div>
              \${testsHtml}
            </div>
          \`;
        }).join('');

        elements.outputStructured.innerHTML = html || '<div class="empty-state">No test results yet</div>';
      }

      function parseTestOutput(rawText) {
        const results = [];
        const lines = rawText.split('\\n');
        
        let currentResult = null;
        let currentTest = null;

        for (const line of lines) {
          // Match PASS/FAIL lines
          const passMatch = line.match(/PASS\\s+(.+?)(?:\\s+\\(([\d.]+)\\s*s\\))?$/);
          const failMatch = line.match(/FAIL\\s+(.+?)(?:\\s+\\(([\d.]+)\\s*s\\))?$/);
          
          if (passMatch || failMatch) {
            if (currentResult) {
              results.push(currentResult);
            }
            currentResult = {
              status: passMatch ? 'pass' : 'fail',
              file: (passMatch || failMatch)[1].trim(),
              duration: (passMatch || failMatch)[2] ? (passMatch || failMatch)[2] + 's' : '',
              tests: []
            };
            currentTest = null;
            continue;
          }

          if (currentResult) {
            // Match individual test results
            const testPassMatch = line.match(/^\\s*[✓✔]\\s*(.+?)(?:\\s+\\((\\d+)\\s*ms\\))?$/);
            const testFailMatch = line.match(/^\\s*[✗✘×]\\s*(.+?)(?:\\s+\\((\\d+)\\s*ms\\))?$/);
            
            if (testPassMatch) {
              currentTest = { status: 'pass', name: testPassMatch[1].trim() };
              currentResult.tests.push(currentTest);
            } else if (testFailMatch) {
              currentTest = { status: 'fail', name: testFailMatch[1].trim(), error: '' };
              currentResult.tests.push(currentTest);
            } else if (currentTest && currentTest.status === 'fail' && line.trim()) {
              // Capture error details
              if (line.includes('Expected:') || line.includes('Received:') || line.includes('Error:')) {
                currentTest.error = (currentTest.error ? currentTest.error + '\\n' : '') + line.trim();
              }
            }
          }
        }

        if (currentResult) {
          results.push(currentResult);
        }

        return results;
      }

      // ========================================
      // Resizable Panes
      // ========================================
      const mainContent = document.getElementById('main-content');
      const projectsPane = document.getElementById('projects-pane');
      const specsPane = document.getElementById('specs-pane');
      const logsPane = document.getElementById('logs-pane');
      
      let isResizing = false;
      let currentResizeHandle = null;
      let startX = 0;
      let startWidths = {};

      document.querySelectorAll('.resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', e => {
          isResizing = true;
          currentResizeHandle = handle;
          startX = e.clientX;
          handle.classList.add('dragging');
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
          
          // Store starting widths
          startWidths = {
            projects: projectsPane.offsetWidth,
            specs: specsPane.offsetWidth,
            logs: logsPane?.offsetWidth || 0
          };
          
          e.preventDefault();
        });
      });

      document.addEventListener('mousemove', e => {
        if (!isResizing || !currentResizeHandle) return;
        
        const deltaX = e.clientX - startX;
        const paneName = currentResizeHandle.dataset.pane;
        const containerWidth = mainContent.offsetWidth;
        
        if (paneName === 'projects') {
          // Resize projects pane
          let newProjectsWidth = startWidths.projects + deltaX;
          newProjectsWidth = Math.max(150, Math.min(newProjectsWidth, containerWidth * 0.5));
          
          const projectsPct = (newProjectsWidth / containerWidth * 100).toFixed(1);
          const remainingPct = 100 - parseFloat(projectsPct);
          
          if (state.logsVisible && logsPane) {
            const logsWidth = logsPane.offsetWidth;
            const logsPct = (logsWidth / containerWidth * 100).toFixed(1);
            const specsPct = (remainingPct - parseFloat(logsPct)).toFixed(1);
            mainContent.style.gridTemplateColumns = \`\${projectsPct}% \${specsPct}% \${logsPct}%\`;
          } else {
            mainContent.style.gridTemplateColumns = \`\${projectsPct}% 1fr\`;
          }
        } else if (paneName === 'specs') {
          // Resize specs pane (by moving the divider with logs)
          if (state.logsVisible && logsPane) {
            const projectsWidth = projectsPane.offsetWidth;
            const projectsPct = (projectsWidth / containerWidth * 100).toFixed(1);
            
            let newSpecsWidth = startWidths.specs + deltaX;
            const minSpecs = 200;
            const minLogs = 100;
            const maxSpecs = containerWidth - projectsWidth - minLogs;
            newSpecsWidth = Math.max(minSpecs, Math.min(newSpecsWidth, maxSpecs));
            
            const specsPct = (newSpecsWidth / containerWidth * 100).toFixed(1);
            const logsPct = (100 - parseFloat(projectsPct) - parseFloat(specsPct)).toFixed(1);
            
            mainContent.style.gridTemplateColumns = \`\${projectsPct}% \${specsPct}% \${logsPct}%\`;
          }
        }
      });

      document.addEventListener('mouseup', () => {
        if (isResizing && currentResizeHandle) {
          currentResizeHandle.classList.remove('dragging');
          isResizing = false;
          currentResizeHandle = null;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
        if (isResizingOutput && outputResizeHandle) {
          outputResizeHandle.classList.remove('dragging');
          isResizingOutput = false;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      });

      // Output pane vertical resize
      const appContainer = document.getElementById('app');
      const outputPane = document.getElementById('output-pane');
      const outputResizeHandle = document.getElementById('resize-output');
      let isResizingOutput = false;
      let startY = 0;
      let startOutputHeight = 0;
      let startMainHeight = 0;

      outputResizeHandle?.addEventListener('mousedown', e => {
        isResizingOutput = true;
        startY = e.clientY;
        startOutputHeight = outputPane.offsetHeight;
        startMainHeight = mainContent.offsetHeight;
        outputResizeHandle.classList.add('dragging');
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });

      document.addEventListener('mousemove', e => {
        if (!isResizingOutput) return;
        
        const deltaY = startY - e.clientY; // Negative because we're dragging up to make output bigger
        const containerHeight = appContainer.offsetHeight;
        const headerHeight = document.getElementById('header-bar').offsetHeight;
        const footerHeight = document.getElementById('footer-bar').offsetHeight;
        const resizeHandleHeight = 4;
        
        const availableHeight = containerHeight - headerHeight - footerHeight - resizeHandleHeight;
        
        let newOutputHeight = startOutputHeight + deltaY;
        const minOutput = 100;
        const maxOutput = availableHeight * 0.7;
        newOutputHeight = Math.max(minOutput, Math.min(newOutputHeight, maxOutput));
        
        const newMainHeight = availableHeight - newOutputHeight;
        
        appContainer.style.gridTemplateRows = \`auto \${newMainHeight}px auto \${newOutputHeight}px auto\`;
      });

      // Notify extension that WebView is ready
      console.log('[ET WebView] Sending ready signal');
      send('ready');
    })();
  `;
}

