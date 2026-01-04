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
  <!-- Global Loading Overlay -->
  <div id="global-loader" class="global-loader">
    <div class="global-loader-content">
      <div class="global-loader-spinner-container">
        <div class="global-loader-spinner-ring"></div>
        <div class="global-loader-spinner-icon">🧪</div>
      </div>
      <div class="global-loader-text" id="global-loader-text">Loading...</div>
      <div class="global-loader-subtext" id="global-loader-subtext"></div>
    </div>
  </div>
  
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
        <div class="header-spacer"></div>
        <div id="progress-container" class="header-progress" style="display: none;">
          <div class="progress-bar">
            <div class="progress-fill" id="progress-fill"></div>
          </div>
          <span id="progress-text" class="progress-text">0%</span>
        </div>
        <span id="running-indicator" class="header-running" style="display: none;">⏳ RUNNING</span>
      </div>
      <!-- Line 2: Base, Branch, Path, AI -->
      <div class="header-line header-line-secondary">
        <span class="header-label">Base:</span>
        <span id="base-ref" class="header-value"></span>
        <span class="header-separator">│</span>
        <span class="header-label">Branch:</span>
        <span id="branch-info" class="header-value"></span>
        <span class="header-separator">│</span>
        <span class="header-label">Path:</span>
        <span id="workspace-path" class="header-value header-path"></span>
        <div class="header-spacer"></div>
        <div class="ai-selector" id="ai-selector">
          <span class="ai-label">AI:</span>
          <button class="ai-btn" data-ai="cursor" id="ai-btn-cursor">Cursor</button>
          <button class="ai-btn" data-ai="copilot" id="ai-btn-copilot">Copilot</button>
          <span class="ai-help" id="ai-help-icon">ⓘ</span>
          <div class="ai-tooltip" id="ai-tooltip">
            <strong>AI Target Selection</strong><br>
            Select your preferred AI assistant. When selected, the spec context menu will show simplified AI commands.<br><br>
            <strong>Cursor:</strong> Creates .cursor/rules/jest-testing.mdc<br>
            <strong>Copilot:</strong> Creates .github/copilot-instructions.md
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content Area -->
    <main id="main-content">
      <!-- Projects Pane -->
      <aside id="projects-pane" class="pane" tabindex="1">
        <div class="resize-handle" id="resize-projects" data-pane="projects"></div>
        <div class="pane-header">
          <span class="pane-title">PROJECTS</span>
          <span id="projects-count" class="pane-count"></span>
        </div>
        <div class="pane-commands">
          <span class="cmd"><kbd>↑/↓</kbd> nav</span>
          <span class="cmd"><kbd>Enter</kbd> menu</span>
          <span class="cmd"><kbd>⇧A</kbd> run all</span>
        </div>
        <div class="pane-content" id="projects-list"></div>
      </aside>

      <!-- Specs Pane -->
      <section id="specs-pane" class="pane" tabindex="2">
        <div class="pane-header">
          <span class="pane-title">SPECS</span>
          <span id="specs-project-name" class="pane-subtitle"></span>
          <div class="pane-actions">
            <button id="select-all-btn" class="btn-small" tabindex="-1" title="Select All (Ctrl+A)">All</button>
            <button id="clear-btn" class="btn-small" tabindex="-1" title="Clear (Ctrl+L)">Clear</button>
          </div>
        </div>
        <div class="pane-commands">
          <span class="cmd"><kbd>↑/↓</kbd> nav</span>
          <span class="cmd"><kbd>Space</kbd> toggle</span>
          <span class="cmd"><kbd>o</kbd> open</span>
          <span class="cmd"><kbd>Enter</kbd> menu</span>
          <span class="cmd"><kbd>⇧A</kbd> run all</span>
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

    </main>

    <!-- Horizontal Resize Handle for Output -->
    <div class="resize-handle-horizontal" id="resize-output"></div>

    <!-- Bottom Section: Output + Logs (horizontal layout) -->
    <div id="bottom-section">
      <!-- Output Pane -->
      <section id="output-pane" class="pane" tabindex="3">
        <div class="pane-header">
          <span class="pane-title">OUTPUT</span>
          <div class="pane-actions">
            <button id="output-raw-btn" class="btn-toggle" tabindex="-1">Raw</button>
            <button id="output-structured-btn" class="btn-toggle active" tabindex="-1">Structured</button>
            <button id="cancel-btn" class="btn-danger" tabindex="-1" style="display: none;">Cancel</button>
          </div>
        </div>
        <div class="pane-content" id="output-content">
          <pre id="output-raw" style="display: none;"></pre>
          <div id="output-structured"></div>
        </div>
      </section>

      <!-- Logs Toggle Bar (vertical, clickable, also acts as resize handle when logs visible) -->
      <div id="logs-toggle-bar" class="logs-toggle-bar">
        <span class="logs-toggle-title">L<br>O<br>G<br>S</span>
      </div>

      <!-- Logs Pane (appears from right, hidden by default) -->
      <aside id="logs-pane" class="pane collapsed">
        <div class="pane-content" id="logs-list"></div>
      </aside>
    </div>

    <!-- Footer Bar -->
    <footer id="footer-bar">
      <span class="shortcut"><kbd>⇧A</kbd>:run all</span>
      <span class="shortcut"><kbd>⇧R</kbd>:run changed</span>
      <span class="shortcut"><kbd>⌘X</kbd>:cancel</span>
      <span class="shortcut"><kbd>/</kbd>:search</span>
      <span class="shortcut"><kbd>\`</kbd>:logs</span>
      <span class="shortcut"><kbd>?</kbd>:help</span>
    </footer>

    <!-- Spec Context Menu -->
    <div id="context-menu" class="context-menu" style="display: none;">
      <div class="context-menu-title" id="context-menu-title">spec.ts</div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" data-action="run" tabindex="0">▶ Run Spec</div>
      <div class="context-menu-separator"></div>
      <!-- AI items when provider is selected (generic) -->
      <div class="context-menu-item ai-generic" data-action="aiFix" tabindex="0">✨ Fix Errors</div>
      <div class="context-menu-item ai-generic" data-action="aiWrite" tabindex="0">✨ Write Tests</div>
      <div class="context-menu-item ai-generic" data-action="aiRefactor" tabindex="0">✨ Refactor</div>
      <!-- AI items when no provider selected (explicit) -->
      <div class="context-menu-item ai-explicit" data-action="aiFix" data-target="cursor" tabindex="0">✨ Cursor: Fix Errors</div>
      <div class="context-menu-item ai-explicit" data-action="aiWrite" data-target="cursor" tabindex="0">✨ Cursor: Write Tests</div>
      <div class="context-menu-item ai-explicit" data-action="aiRefactor" data-target="cursor" tabindex="0">✨ Cursor: Refactor</div>
      <div class="context-menu-item ai-explicit" data-action="aiFix" data-target="copilot" tabindex="0">✨ Copilot: Fix Errors</div>
      <div class="context-menu-item ai-explicit" data-action="aiWrite" data-target="copilot" tabindex="0">✨ Copilot: Write Tests</div>
      <div class="context-menu-item ai-explicit" data-target="copilot" data-action="aiRefactor" tabindex="0">✨ Copilot: Refactor</div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" data-action="open" tabindex="0">📄 Open File</div>
      <div class="context-menu-item" data-action="pin" tabindex="0">★ Pin/Unpin</div>
    </div>

    <!-- Project Context Menu -->
    <div id="project-context-menu" class="context-menu" style="display: none;">
      <div class="context-menu-title" id="project-context-menu-title">project-name</div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" data-action="runProject" tabindex="0">▶ Run All Listed Specs</div>
      <div class="context-menu-item" data-action="runChanged" tabindex="0">▶ Run Modified Specs Only</div>
    </div>

    <!-- Help Modal -->
    <div id="help-modal" class="modal-overlay" style="display: none;">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-title">Keyboard Shortcuts</span>
          <button class="modal-close" id="help-close">×</button>
        </div>
        <div class="modal-body">
          <div class="help-section">
            <h4>Navigation</h4>
            <div class="help-row"><kbd>Tab</kbd><span>Switch between Projects/Specs panes</span></div>
            <div class="help-row"><kbd>↑</kbd> / <kbd>↓</kbd><span>Move up/down in list</span></div>
            <div class="help-row"><kbd>Enter</kbd><span>Open context menu (both panes)</span></div>
          </div>
          <div class="help-section">
            <h4>Running Tests</h4>
            <div class="help-row"><kbd>⇧A</kbd><span>Run all specs in current project</span></div>
            <div class="help-row"><kbd>⇧R</kbd><span>Run only changed specs</span></div>
          </div>
          <div class="help-section">
            <h4>Specs Pane</h4>
            <div class="help-row"><kbd>Space</kbd><span>Toggle spec selection</span></div>
            <div class="help-row"><kbd>o</kbd><span>Open spec file in editor</span></div>
            <div class="help-row"><kbd>⌘A</kbd><span>Select all specs</span></div>
            <div class="help-row"><kbd>⌘L</kbd><span>Clear selection</span></div>
            <div class="help-row"><kbd>⌘D</kbd><span>Pin/Unpin spec</span></div>
          </div>
          <div class="help-section">
            <h4>Search & Filter</h4>
            <div class="help-row"><kbd>/</kbd> or <kbd>⌘F</kbd><span>Focus search</span></div>
            <div class="help-row"><kbd>Esc</kbd><span>Clear search</span></div>
          </div>
          <div class="help-section">
            <h4>Other</h4>
            <div class="help-row"><kbd>⌘X</kbd><span>Cancel running tests</span></div>
            <div class="help-row"><kbd>\`</kbd><span>Toggle logs pane</span></div>
            <div class="help-row"><kbd>?</kbd><span>Show this help</span></div>
          </div>
        </div>
      </div>
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
      grid-template-rows: auto 1fr auto 40% auto;
      height: 100vh;
    }

    /* Bottom Section (Output + Logs - horizontal layout) */
    #bottom-section {
      display: flex;
      flex-direction: row;
      overflow: hidden;
    }

    #bottom-section #output-pane {
      flex: 1;
      min-width: 200px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    #bottom-section #output-pane .pane-content {
      flex: 1;
      overflow: auto;
    }

    /* Logs toggle bar - vertical bar, always visible */
    .logs-toggle-bar {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 8px 4px;
      background: var(--bg-tertiary);
      border-left: 1px solid var(--border-color);
      cursor: pointer;
      user-select: none;
      width: 22px;
      min-width: 22px;
    }

    .logs-toggle-bar:hover {
      background: var(--bg-secondary);
    }

    .logs-toggle-bar.logs-visible {
      cursor: ew-resize;
      background: var(--accent);
    }

    .logs-toggle-bar.logs-visible:hover {
      background: var(--accent-hover);
    }

    .logs-toggle-title {
      font-size: 9px;
      font-weight: 600;
      color: var(--fg-secondary);
      text-align: center;
      line-height: 1.3;
      letter-spacing: 1px;
    }

    .logs-toggle-bar.logs-visible .logs-toggle-title {
      color: var(--bg-primary);
    }

    /* Logs pane - horizontal expansion from right */
    #logs-pane {
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    #logs-pane.collapsed {
      width: 0;
      display: none;
    }

    #logs-pane:not(.collapsed) {
      width: 300px;
      min-width: 150px;
      display: flex;
    }

    #logs-pane .pane-content {
      flex: 1;
      overflow: auto;
      background: var(--bg-primary);
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

    /* AI Selector in Header */
    .ai-selector {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .ai-label {
      font-size: 10px;
      color: var(--fg-muted);
      margin-right: 2px;
    }

    .ai-btn {
      font-size: 10px;
      padding: 2px 8px;
      border: 1px solid var(--border-color);
      border-radius: 3px;
      background: transparent;
      color: var(--fg-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .ai-btn:hover {
      background: var(--bg-tertiary);
      border-color: var(--fg-muted);
    }

    .ai-btn.active {
      background: var(--accent);
      color: var(--bg-primary);
      border-color: var(--accent);
    }

    .ai-help {
      cursor: pointer;
      font-size: 12px;
      color: var(--fg-muted);
      opacity: 0.7;
      margin-left: 4px;
      transition: all 0.15s ease;
      user-select: none;
    }

    .ai-help:hover {
      opacity: 1;
      color: var(--accent);
    }

    .ai-tooltip {
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 4px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 10px 12px;
      font-size: 11px;
      line-height: 1.5;
      color: var(--fg-primary);
      width: 280px;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .ai-tooltip.visible {
      display: block;
    }

    .ai-tooltip strong {
      color: var(--accent);
    }

    .ai-selector {
      position: relative;
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

    /* Main Content - Projects and Specs panes only */
    #main-content {
      display: grid;
      grid-template-columns: minmax(200px, 30%) 1fr;
      overflow: hidden;
      min-height: 0;
    }

    /* Collapsible pane (logs) */
    .collapsible-pane {
      min-height: 28px;
      transition: max-height 0.2s ease;
    }

    .collapsible-pane.collapsed .collapsible-content {
      display: none;
    }

    .collapsible-pane:not(.collapsed) .collapsible-content {
      display: block;
    }

    .clickable-header {
      cursor: pointer;
      user-select: none;
    }

    .clickable-header:hover {
      background: var(--bg-tertiary);
    }

    .log-count {
      font-size: 10px;
      color: var(--fg-muted);
      margin-left: 6px;
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
      background: rgba(0, 0, 0, 0.08); /* Slightly darker than base */
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

    .pane:focus {
      outline: none;
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

    .btn-small:hover:not(:disabled) {
      background: var(--bg-tertiary);
    }

    .btn-small:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-small.loading {
      color: var(--running);
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
      padding: 3px 8px 3px 8px;
      cursor: pointer;
      border-left: 2px solid transparent;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .project-item:last-child {
      border-bottom: none;
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

    .project-item.focused {
      background: var(--bg-tertiary);
      border-left-color: var(--accent);
    }

    .project-item.disabled {
      opacity: 0.6;
      pointer-events: none;
    }

    .project-name {
      font-weight: 500;
      margin-bottom: 1px;
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
    
    .projects-separator {
      padding: 8px 10px 4px;
      margin-top: 8px;
      border-top: 1px solid var(--border-color);
      font-size: 10px;
      color: var(--fg-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .projects-separator span {
      background: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: 3px;
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
      margin-top: 1px;
      padding-left: 16px;
      align-items: center;
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

    .project-coverage {
      font-size: 10px;
      color: var(--fg-muted);
      padding-left: 16px;
      margin-top: 1px;
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
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      min-height: 24px;
    }

    .spec-item:last-child {
      border-bottom: none;
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
      flex-direction: column;
      justify-content: center;
      gap: 1px;
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
      color: #888; /* Brighter grey, readable but not prominent */
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.2;
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

    /* Output content styling */
    #output-content {
      flex: 1;
      overflow: auto;
    }

    #output-raw {
      margin: 0;
      padding: 8px 12px;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-all;
      height: 100%;
      box-sizing: border-box;
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
    
    .structured-test {
      cursor: pointer;
      border-radius: 3px;
      padding: 3px 4px;
      margin: 0 -4px;
    }
    
    .structured-test:hover {
      background: var(--bg-hover);
    }
    
    .structured-header.clickable {
      cursor: pointer;
    }
    
    .structured-header.clickable:hover {
      filter: brightness(1.2);
    }
    
    .test-name {
      flex: 1;
    }
    
    .test-duration {
      color: var(--fg-muted);
      font-size: 10px;
    }
    
    .structured-location {
      color: var(--info);
      font-size: 10px;
      cursor: pointer;
      text-decoration: underline;
      margin-left: 8px;
    }
    
    .structured-location:hover {
      color: var(--fg);
    }

    .structured-error {
      margin-left: 20px;
      margin-top: 4px;
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

    /* AI menu items visibility based on selected provider */
    .ai-generic { display: none; }
    .ai-explicit { display: block; }

    .context-menu.ai-selected .ai-generic { display: block; }
    .context-menu.ai-selected .ai-explicit { display: none; }

    /* Help Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .modal-content {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      width: 450px;
      max-height: 80vh;
      overflow: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-tertiary);
    }

    .modal-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--fg-primary);
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 18px;
      color: var(--fg-muted);
      cursor: pointer;
      padding: 0 4px;
    }

    .modal-close:hover {
      color: var(--fg-primary);
    }

    .modal-body {
      padding: 16px;
    }

    .help-section {
      margin-bottom: 16px;
    }

    .help-section:last-child {
      margin-bottom: 0;
    }

    .help-section h4 {
      font-size: 11px;
      font-weight: 600;
      color: var(--accent);
      text-transform: uppercase;
      margin: 0 0 8px 0;
      letter-spacing: 0.5px;
    }

    .help-row {
      display: flex;
      align-items: center;
      padding: 4px 0;
      font-size: 12px;
    }

    .help-row kbd {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 3px;
      padding: 2px 6px;
      font-family: var(--vscode-editor-font-family);
      font-size: 10px;
      min-width: 18px;
      text-align: center;
      margin-right: 8px;
    }

    .help-row span {
      color: var(--fg-secondary);
    }

    /* Global Loading Overlay */
    .global-loader {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(2px);
    }

    .global-loader.active {
      display: flex;
    }

    .global-loader-content {
      background: var(--bg-secondary);
      padding: 32px 48px;
      border-radius: 12px;
      border: 2px solid var(--accent);
      text-align: center;
      box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5);
      min-width: 280px;
    }

    .global-loader-spinner-container {
      position: relative;
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
    }

    .global-loader-spinner-ring {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: 4px solid var(--bg-tertiary);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    .global-loader-spinner-icon {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 32px;
      animation: pulse-icon 1.5s ease-in-out infinite;
    }

    @keyframes pulse-icon {
      0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.8; }
    }

    .global-loader-text {
      color: var(--fg-primary);
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .global-loader-subtext {
      color: var(--fg-muted);
      font-size: 12px;
      font-family: var(--vscode-editor-font-family), monospace;
    }
    
    .global-loader-subtext:empty {
      display: none;
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
        searchQuery: '',
        logsVisible: false, // Hidden by default
        focusedPane: 'projects',
        config: { baseRef: '', branch: '', workspacePath: '' },
        aiTarget: null // null (not selected), 'cursor', or 'copilot'
      };

      // DOM Elements
      const elements = {
        projectsList: document.getElementById('projects-list'),
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
        globalLoader: document.getElementById('global-loader')
      };

      // Global loader functions
      const globalLoaderText = document.getElementById('global-loader-text');
      const globalLoaderSubtext = document.getElementById('global-loader-subtext');
      
      function showGlobalLoader(text = 'Loading...', subtext = '') {
        globalLoaderText.textContent = text;
        globalLoaderSubtext.textContent = subtext;
        elements.globalLoader.classList.add('active');
      }
      
      function updateGlobalLoader(text, subtext) {
        if (text) globalLoaderText.textContent = text;
        if (subtext !== undefined) globalLoaderSubtext.textContent = subtext;
      }
      
      function hideGlobalLoader() {
        elements.globalLoader.classList.remove('active');
      }

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
            hideGlobalLoader(); // Hide loader when projects are updated
            state.projects = message.payload.projects;
            
            // Update branch and path if provided
            if (message.payload.branch) {
              elements.branchInfo.textContent = message.payload.branch;
            }
            if (message.payload.workspacePath) {
              elements.workspacePath.textContent = message.payload.workspacePath;
            }
            
            // Auto-select first project if none selected (prefer Jest projects)
            if (!state.selectedProject && state.projects.length > 0) {
              const sorted = getSortedProjects();
              state.selectedProject = sorted[0].name;
              send('selectProject', { projectName: state.selectedProject });
              focusedProjectIndex = 0;
            }
            
            renderProjects();
            renderSpecs();
            updateHeader();
            break;
          case 'showLoader':
            showGlobalLoader(message.payload?.text || 'Loading...');
            break;
          case 'hideLoader':
            hideGlobalLoader();
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
        
        state.runningState = payload.runningState || { isRunning: false };
        state.logs = payload.logs || [];
        
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
        
        // Always update structured view if in structured mode for real-time updates
        if (outputMode === 'structured') {
          renderStructuredOutput();
          // Auto-scroll the structured output container to bottom
          const structuredContainer = elements.outputStructured.parentElement;
          structuredContainer.scrollTop = structuredContainer.scrollHeight;
        } else {
          // Auto-scroll the raw output container to bottom
          const outputContainer = elements.outputRaw.parentElement;
          outputContainer.scrollTop = outputContainer.scrollHeight;
        }

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
        renderSpecs();
        renderLogs();
        updateRunningUI();
        updateHeader();
        updateFooter();
        elements.mainContent.classList.toggle('logs-hidden', !state.logsVisible);
      }

      function renderProjects() {
        // Sort projects: Jest first, then Karma at the bottom
        const jestProjects = state.projects.filter(p => p.runner === 'jest');
        const karmaProjects = state.projects.filter(p => p.runner !== 'jest');
        const sortedProjects = [...jestProjects, ...karmaProjects];
        
        // Track if we need a separator
        let addedKarmaSeparator = false;
        
        const html = sortedProjects.map((project, idx) => {
          const isSelected = project.name === state.selectedProject;
          const isRunning = state.runningState.isRunning && 
                           state.runningState.projectName === project.name;
          const isJest = project.runner === 'jest';
          const runnerTag = isJest ? 'jest' : 'karma';
          const runnerClass = isJest ? 'runner-jest' : 'runner-karma';
          const blockClass = state.runningState.isRunning ? 'disabled' : '';
          
          // Add separator before first Karma project
          let separatorHtml = '';
          if (!isJest && !addedKarmaSeparator && karmaProjects.length > 0) {
            addedKarmaSeparator = true;
            separatorHtml = '<div class="projects-separator"><span>Karma Projects (run disabled)</span></div>';
          }
          
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
            \`;
          } else {
            metricsHtml = '<span class="no-run">not run yet</span>';
            if (!isJest) {
              metricsHtml += ' <span class="no-run">(Karma)</span>';
            }
          }

          // Coverage line (separate from metrics)
          let coverageLineHtml = '';
          if (project.metrics?.coverage) {
            const cov = project.metrics.coverage;
            const fmtPct = v => v !== undefined ? Math.round(v) + '%' : '--';
            coverageLineHtml = \`<div class="project-coverage">Stmts \${fmtPct(cov.statements)}  Funcs \${fmtPct(cov.functions)}  Branch \${fmtPct(cov.branches)}</div>\`;
          }

          return \`\${separatorHtml}
            <div class="project-item \${isSelected ? 'selected' : ''} \${isRunning ? 'running' : ''} \${runnerClass} \${blockClass}"
                 data-project="\${project.name}" data-runner="\${project.runner}">
              <div class="project-name">
                \${statusIcon}
                \${project.name}
                <span class="runner-tag \${runnerClass}">\${runnerTag}</span>
                \${specCountHtml}
              </div>
              <div class="project-metrics">\${metricsHtml}</div>
              \${coverageLineHtml}
            </div>
          \`;
        }).join('');

        elements.projectsList.innerHTML = html || '<div class="empty-state">No projects with changes</div>';
        elements.projectsCount.textContent = \`(\${state.projects.length})\`;

        // Add click handlers
        elements.projectsList.querySelectorAll('.project-item').forEach((el, idx) => {
          el.addEventListener('click', () => {
            const projectName = el.dataset.project;
            const wasSelected = state.selectedProject;
            state.selectedProject = projectName;
            
            // Update focused project index to match clicked project
            focusedProjectIndex = idx;
            
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
            highlightFocusedProject(); // Update focus highlight
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
          const aiBtnStyle = isJestProject ? '' : 'style="display:none"';
          const pinBtnStyle = isJestProject ? '' : 'style="display:none"';

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
                <button class="spec-action-btn pin-btn" tabindex="-1" title="\${isPinned ? 'Unpin' : 'Pin'} (Ctrl+D)" \${pinBtnStyle}>\${isPinned ? '★' : '☆'}</button>
                <button class="spec-action-btn run-btn" tabindex="-1" title="Run" \${runBtnStyle}>▶</button>
                <button class="spec-action-btn ai-btn" tabindex="-1" title="AI Assist" \${aiBtnStyle}>✨</button>
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
              <button class="btn-small create-spec-btn">Create</button>
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
            if (!state.runningState.isRunning) {
              send('runSpecs', { specPaths: [specPath] });
            }
          });

          el.querySelector('.ai-btn').addEventListener('click', e => {
            e.stopPropagation();
            // Find the spec and show context menu at button position
            const spec = filteredSpecs[idx];
            if (spec) {
              // Focus this spec first
              focusedSpecIndex = idx;
              highlightFocusedSpec();
              // Show context menu at button position
              showSpecContextMenuAtElement(spec, e.target);
            }
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
            // Manually set pane focus without resetting the focused index
            currentPane = 'specs';
            Object.values(paneElements).forEach(p => p.classList.remove('focused-pane'));
            paneElements['specs']?.classList.add('focused-pane');
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

        elements.missingSpecsList.querySelectorAll('.missing-item .create-spec-btn').forEach(btn => {
          btn.addEventListener('click', e => {
            e.stopPropagation();
            if (btn.disabled) return;
            
            const item = btn.closest('.missing-item');
            const missingSpec = state.missingSpecs.find(m => 
              m.expectedSpecPath === item.dataset.missing
            );
            if (missingSpec) {
              // Show loading state
              btn.disabled = true;
              btn.textContent = 'Creating...';
              btn.classList.add('loading');
              
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
        const { isRunning, progress, projectName, specPaths } = state.runningState;
        
        elements.progressContainer.style.display = isRunning ? 'flex' : 'none';
        elements.cancelBtn.style.display = isRunning ? 'block' : 'none';
        elements.statusText.textContent = isRunning ? 'Running...' : 'Ready';
        elements.statusText.classList.toggle('running', isRunning);

        // Use single global loader during test runs
        if (isRunning) {
          const specCount = specPaths?.length || 0;
          const displayProject = projectName || state.selectedProject || 'Unknown';
          
          // Main text shows project and spec count
          const mainText = specCount === 1 
            ? \`Running 1 spec in \${displayProject}\`
            : \`Running \${specCount} specs in \${displayProject}\`;
          
          let subText = '';
          if (progress) {
            const pct = Math.round((progress.completed / progress.total) * 100);
            elements.progressFill.style.width = pct + '%';
            elements.progressText.textContent = pct + '%';
            
            // Progress text shows current spec being run
            subText = progress.currentSpec 
              ? \`\${progress.completed}/\${progress.total} · \${progress.currentSpec.split('/').pop()}\`
              : \`\${progress.completed}/\${progress.total} completed\`;
          } else {
            subText = \`\${specCount} spec\${specCount !== 1 ? 's' : ''} queued\`;
          }
          
          showGlobalLoader(mainText, subText);
        } else {
          hideGlobalLoader();
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
      
      // Tab navigation only cycles between projects and specs
      const panes = ['projects', 'specs'];
      const paneElements = {
        projects: document.getElementById('projects-pane'),
        specs: document.getElementById('specs-pane'),
        logs: document.getElementById('logs-pane'),
        output: document.getElementById('output-pane')
      };
      
      function focusPane(paneName) {
        currentPane = paneName;
        Object.values(paneElements).forEach(el => el.classList.remove('focused-pane'));
        paneElements[paneName]?.classList.add('focused-pane');
        paneElements[paneName]?.focus();
        
        // Auto-select first item when switching panes (sync with selected project)
        if (paneName === 'projects') {
          // Sync focusedProjectIndex with the currently selected project (in sorted order)
          const sorted = getSortedProjects();
          const selectedIdx = sorted.findIndex(p => p.name === state.selectedProject);
          focusedProjectIndex = selectedIdx >= 0 ? selectedIdx : (sorted.length > 0 ? 0 : -1);
          highlightFocusedProject();
        } else if (paneName === 'specs') {
          const project = state.projects.find(p => p.name === state.selectedProject);
          if (project) {
            const filtered = filterSpecs(project.specs, state.searchQuery);
            focusedSpecIndex = filtered.length > 0 ? 0 : -1;
            highlightFocusedSpec();
          }
        }
      }

      // Event Handlers
      
      // Click on pane to focus it (always focus when clicking anywhere in the pane)
      Object.entries(paneElements).forEach(([name, el]) => {
        if (!el) return;
        el.addEventListener('click', (e) => {
          // Focus the pane on any click within it
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
        if (!state.runningState.isRunning) {
          send('runSpecs', { specPaths: Array.from(state.selectedSpecs) });
        }
      });

      elements.rerunFailedBtn.addEventListener('click', () => {
        if (!state.runningState.isRunning) {
          send('rerunFailed');
        }
      });

      elements.cancelBtn.addEventListener('click', () => {
        send('cancelRun');
      });

      // Logs toggle bar (click to toggle, drag to resize when visible)
      const logsToggleBar = document.getElementById('logs-toggle-bar');
      const logsPane = document.getElementById('logs-pane');
      let logsResizing = false;
      let logsDragged = false;
      let logsStartX = 0;
      let logsStartWidth = 300;
      
      function toggleLogs() {
        const isCollapsed = logsPane.classList.toggle('collapsed');
        logsToggleBar.classList.toggle('logs-visible', !isCollapsed);
      }
      
      logsToggleBar.addEventListener('mousedown', (e) => {
        const isVisible = !logsPane.classList.contains('collapsed');
        if (isVisible) {
          // Start resizing
          logsResizing = true;
          logsDragged = false;
          logsStartX = e.clientX;
          logsStartWidth = logsPane.offsetWidth;
          document.body.style.cursor = 'ew-resize';
          e.preventDefault();
        }
      });
      
      logsToggleBar.addEventListener('click', (e) => {
        // Only toggle if we didn't drag (resize)
        if (!logsDragged) {
          toggleLogs();
        }
        logsDragged = false;
      });
      
      document.addEventListener('mousemove', (e) => {
        if (logsResizing) {
          const delta = logsStartX - e.clientX;
          // Only consider it a drag if moved more than 5px
          if (Math.abs(delta) > 5) {
            logsDragged = true;
          }
          const newWidth = Math.max(150, Math.min(600, logsStartWidth + delta));
          logsPane.style.width = newWidth + 'px';
        }
      });
      
      document.addEventListener('mouseup', () => {
        if (logsResizing) {
          logsResizing = false;
          document.body.style.cursor = '';
        }
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
      
      function getSortedProjects() {
        // Jest projects first, then Karma at the bottom (same order as rendered)
        const jestProjects = state.projects.filter(p => p.runner === 'jest');
        const karmaProjects = state.projects.filter(p => p.runner !== 'jest');
        return [...jestProjects, ...karmaProjects];
      }
      
      function getFocusedProject() {
        const sorted = getSortedProjects();
        if (focusedProjectIndex < 0 || focusedProjectIndex >= sorted.length) return null;
        return sorted[focusedProjectIndex];
      }

      // Initialize first pane focus
      focusPane('specs');

      // Keyboard Navigation
      document.addEventListener('keydown', e => {
        // Help modal always works, regardless of focus
        if (e.key === '?') {
          toggleHelpModal();
          e.preventDefault();
          return;
        }
        
        // Skip most keys if typing in search input
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
          // Toggle logs pane
          toggleLogs();
          e.preventDefault();
          return;
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
          if (!state.runningState.isRunning && state.selectedSpecs.size > 0) {
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
          showGlobalLoader('Refreshing workspace...');
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
          const sortedProjects = getSortedProjects();
          if (e.key === 'ArrowDown') {
            focusedProjectIndex = Math.min(focusedProjectIndex + 1, sortedProjects.length - 1);
            // Select the project and update specs pane
            const focused = getFocusedProject();
            if (focused && focused.name !== state.selectedProject) {
              state.selectedProject = focused.name;
              send('clearSelection');
              send('selectProject', { projectName: focused.name });
              renderProjects();
              renderSpecs();
              focusedSpecIndex = 0;
            } else {
              highlightFocusedProject();
            }
            e.preventDefault();
          } else if (e.key === 'ArrowUp') {
            focusedProjectIndex = Math.max(focusedProjectIndex - 1, 0);
            // Select the project and update specs pane
            const focused = getFocusedProject();
            if (focused && focused.name !== state.selectedProject) {
              state.selectedProject = focused.name;
              send('clearSelection');
              send('selectProject', { projectName: focused.name });
              renderProjects();
              renderSpecs();
              focusedSpecIndex = 0;
            } else {
              highlightFocusedProject();
            }
            e.preventDefault();
          } else if (e.key === 'Enter') {
            // Show context menu for focused project (not while running, Jest only)
            if (!state.runningState.isRunning) {
              const focused = getFocusedProject();
              if (focused && focused.runner === 'jest') {
                showProjectContextMenu(focused);
              }
            }
            e.preventDefault();
          } else if (e.key === 'A' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
            // Shift+A: Run all specs in focused project (only if jest and not running)
            if (!state.runningState.isRunning) {
              const focused = getFocusedProject();
              if (focused && focused.runner === 'jest') {
                send('runProject', { projectName: focused.name });
              }
            }
            e.preventDefault();
          } else if (e.key === 'R' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
            // Shift+R: Run only changed specs (not while running)
            if (!state.runningState.isRunning) {
              send('runAllChanged');
            }
            e.preventDefault();
          }
        } else if (currentPane === 'specs') {
          if (e.key === 'ArrowDown') {
            const project = state.projects.find(p => p.name === state.selectedProject);
            if (project) {
              const filteredSpecs = filterSpecs(project.specs, state.searchQuery);
              // Ensure we start at 0 if not focused yet
              if (focusedSpecIndex < 0) focusedSpecIndex = -1;
              focusedSpecIndex = Math.min(focusedSpecIndex + 1, filteredSpecs.length - 1);
              highlightFocusedSpec();
            }
            e.preventDefault();
          } else if (e.key === 'ArrowUp') {
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
          } else if (e.key === 'A' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
            // Shift+A: Run all specs in current project (Jest only, not while running)
            if (!state.runningState.isRunning && state.selectedProject && isCurrentProjectJest()) {
              send('runProject', { projectName: state.selectedProject });
            }
            e.preventDefault();
          } else if (e.key === 'o' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
            // 'o' - Open focused spec file in editor
            const focused = getFocusedSpec();
            if (focused) {
              send('openFile', { filePath: focused.absPath });
            }
            e.preventDefault();
          } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && /[a-zA-Z0-9._-]/.test(e.key)) {
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
        const focusedEl = elements.specsList.querySelector('.spec-item.focused');
        if (focusedEl) {
          const rect = focusedEl.getBoundingClientRect();
          showSpecContextMenuAt(spec, rect.left, rect.bottom + 4);
        }
      }
      
      function showSpecContextMenuAtElement(spec, element) {
        const rect = element.getBoundingClientRect();
        // Position menu so it doesn't overflow right edge - align to right side of button
        const menuWidth = 200; // Approximate menu width
        const rightEdge = window.innerWidth;
        let x = rect.left;
        
        // If menu would overflow right edge, align to right side of button instead
        if (rect.left + menuWidth > rightEdge) {
          x = rect.right - menuWidth;
        }
        
        showSpecContextMenuAt(spec, x, rect.bottom + 4);
      }
      
      function showSpecContextMenuAt(spec, x, y) {
        contextMenuSpec = spec;
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        contextMenu.style.display = 'block';
        
        // Adjust position if menu overflows viewport
        const menuRect = contextMenu.getBoundingClientRect();
        if (menuRect.right > window.innerWidth) {
          contextMenu.style.left = (window.innerWidth - menuRect.width - 10) + 'px';
        }
        if (menuRect.bottom > window.innerHeight) {
          contextMenu.style.top = (y - menuRect.height - 8) + 'px';
        }
        
        // Set menu title to spec filename
        const menuTitle = document.getElementById('context-menu-title');
        if (menuTitle) {
          menuTitle.textContent = spec.fileName;
        }
        
        // Update AI items visibility based on selected AI target
        contextMenu.classList.toggle('ai-selected', state.aiTarget !== null);
        
        // Disable all actions for Karma projects (except open file)
        const isJest = isCurrentProjectJest();
        contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
          const action = item.dataset.action;
          // Only allow opening file for Karma projects - disable everything else
          if (!isJest && action !== 'open') {
            item.classList.add('disabled');
          } else {
            item.classList.remove('disabled');
          }
        });
        
        // Focus first visible, non-disabled item in menu
        // Need to wait a tick for CSS to apply the ai-selected class
        setTimeout(() => {
          const items = getVisibleMenuItems(contextMenu);
          if (items.length > 0) {
            items[0].focus();
          }
        }, 0);
      }

      function hideContextMenu() {
        contextMenu.style.display = 'none';
        contextMenuSpec = null;
      }

      // Project Context Menu
      let contextMenuProject = null;
      const projectContextMenu = document.getElementById('project-context-menu');

      function showProjectContextMenu(project) {
        // Try to find the focused element first
        let targetEl = elements.projectsList.querySelector('.project-item.focused');
        
        // Fallback: find by selected project name
        if (!targetEl) {
          targetEl = elements.projectsList.querySelector('.project-item.selected');
        }
        
        // Fallback: find by project name in data attribute
        if (!targetEl && project) {
          targetEl = elements.projectsList.querySelector(\`[data-project="\${project.name}"]\`);
        }
        
        if (targetEl) {
          const rect = targetEl.getBoundingClientRect();
          showProjectContextMenuAt(project, rect.left, rect.bottom + 4);
        } else {
          // Last resort: show at center of projects pane
          const panesRect = elements.projectsList.getBoundingClientRect();
          showProjectContextMenuAt(project, panesRect.left + 20, panesRect.top + 50);
        }
      }
      
      function showProjectContextMenuAt(project, x, y) {
        contextMenuProject = project;
        projectContextMenu.style.left = x + 'px';
        projectContextMenu.style.top = y + 'px';
        projectContextMenu.style.display = 'block';
        
        // Adjust position if menu overflows viewport
        const menuRect = projectContextMenu.getBoundingClientRect();
        if (menuRect.right > window.innerWidth) {
          projectContextMenu.style.left = (window.innerWidth - menuRect.width - 10) + 'px';
        }
        if (menuRect.bottom > window.innerHeight) {
          projectContextMenu.style.top = (y - menuRect.height - 8) + 'px';
        }
        
        // Set menu title to project name
        const menuTitle = document.getElementById('project-context-menu-title');
        if (menuTitle) {
          menuTitle.textContent = project.name;
        }
        
        // Disable actions for Karma projects
        const isJest = project.runner === 'jest';
        projectContextMenu.querySelectorAll('.context-menu-item').forEach(item => {
          if (!isJest) {
            item.classList.add('disabled');
          } else {
            item.classList.remove('disabled');
          }
        });
        
        // Focus first visible, non-disabled item in menu
        const firstItem = projectContextMenu.querySelector('.context-menu-item:not(.disabled)');
        if (firstItem) {
          firstItem.focus();
        }
      }

      function hideProjectContextMenu() {
        projectContextMenu.style.display = 'none';
        contextMenuProject = null;
      }

      // Close project context menu on click outside
      document.addEventListener('click', e => {
        if (!projectContextMenu.contains(e.target)) {
          hideProjectContextMenu();
        }
      });

      // Project context menu keyboard navigation
      projectContextMenu.addEventListener('keydown', e => {
        e.stopPropagation();
        
        const items = Array.from(projectContextMenu.querySelectorAll('.context-menu-item:not(.disabled)'));
        const currentIdx = items.indexOf(document.activeElement);
        
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIdx = (currentIdx + 1) % items.length;
          items[nextIdx]?.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIdx = currentIdx <= 0 ? items.length - 1 : currentIdx - 1;
          items[prevIdx]?.focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          document.activeElement?.click();
        } else if (e.key === 'Escape') {
          hideProjectContextMenu();
          e.preventDefault();
        }
      });

      // Close project menu on Escape (global)
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && projectContextMenu.style.display === 'block') {
          hideProjectContextMenu();
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);

      // Project context menu actions
      projectContextMenu.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', () => {
          if (!contextMenuProject) return;
          if (item.classList.contains('disabled')) return;
          if (state.runningState.isRunning) return; // Don't allow running while already running
          
          const action = item.dataset.action;
          
          switch (action) {
            case 'runProject':
              send('runProject', { projectName: contextMenuProject.name });
              break;
            case 'runChanged':
              send('runProjectChanged', { projectName: contextMenuProject.name });
              break;
          }
          hideProjectContextMenu();
        });
      });

      // Help Modal
      const helpModal = document.getElementById('help-modal');
      
      function toggleHelpModal() {
        if (helpModal.style.display === 'none') {
          helpModal.style.display = 'flex';
        } else {
          helpModal.style.display = 'none';
        }
      }
      
      function hideHelpModal() {
        helpModal.style.display = 'none';
      }
      
      // Close help modal on click outside or close button
      document.getElementById('help-close').addEventListener('click', hideHelpModal);
      helpModal.addEventListener('click', e => {
        if (e.target === helpModal) {
          hideHelpModal();
        }
      });
      
      // Close help modal on Escape
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && helpModal.style.display === 'flex') {
          hideHelpModal();
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);

      // Close context menu on click outside
      document.addEventListener('click', e => {
        // Don't hide if clicking the AI button on a spec item (it opens the menu)
        if (e.target.closest('.spec-action-btn.ai-btn')) {
          return;
        }
        if (!contextMenu.contains(e.target)) {
          hideContextMenu();
        }
      });

      // Helper to get visible, non-disabled menu items
      function getVisibleMenuItems(menu) {
        return Array.from(menu.querySelectorAll('.context-menu-item')).filter(item => {
          // Check if item is disabled
          if (item.classList.contains('disabled')) return false;
          // Check if item is hidden via CSS (display: none)
          const style = window.getComputedStyle(item);
          if (style.display === 'none') return false;
          return true;
        });
      }
      
      // Context menu keyboard navigation
      contextMenu.addEventListener('keydown', e => {
        // Stop propagation to prevent spec navigation while in menu
        e.stopPropagation();
        
        const items = getVisibleMenuItems(contextMenu);
        const currentIdx = items.indexOf(document.activeElement);
        
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          // If not focused on any item, start at first; otherwise go to next
          const nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % items.length;
          items[nextIdx]?.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          // If not focused on any item, start at last; otherwise go to previous
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
              if (!state.runningState.isRunning) {
                send('runSpecs', { specPaths: [contextMenuSpec.absPath] });
              }
              break;
            case 'runAll':
              if (!state.runningState.isRunning) {
                send('runProject', { projectName: state.selectedProject });
              }
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
            case 'aiWrite':
            case 'aiRefactor':
              const aiAction = action.replace('ai', '').toLowerCase();
              // Use explicit target from item, or selected target from header
              const target = item.dataset.target || state.aiTarget || 'cursor';
              send('aiAssist', { specPath: contextMenuSpec.absPath, action: aiAction, target });
              break;
          }
          hideContextMenu();
        });
      });
      
      // AI selector in header
      const aiBtnCursor = document.getElementById('ai-btn-cursor');
      const aiBtnCopilot = document.getElementById('ai-btn-copilot');
      const aiHelpIcon = document.getElementById('ai-help-icon');
      const aiTooltip = document.getElementById('ai-tooltip');
      
      function updateAiSelectorUI() {
        aiBtnCursor.classList.toggle('active', state.aiTarget === 'cursor');
        aiBtnCopilot.classList.toggle('active', state.aiTarget === 'copilot');
        // Update context menu visibility
        contextMenu.classList.toggle('ai-selected', state.aiTarget !== null);
      }
      
      aiBtnCursor.addEventListener('click', () => {
        state.aiTarget = state.aiTarget === 'cursor' ? null : 'cursor';
        updateAiSelectorUI();
        aiTooltip.classList.remove('visible'); // Hide tooltip when selecting
      });
      
      aiBtnCopilot.addEventListener('click', () => {
        state.aiTarget = state.aiTarget === 'copilot' ? null : 'copilot';
        updateAiSelectorUI();
        aiTooltip.classList.remove('visible'); // Hide tooltip when selecting
      });
      
      // AI help tooltip - click to toggle
      aiHelpIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        aiTooltip.classList.toggle('visible');
      });
      
      // Close tooltip when clicking elsewhere
      document.addEventListener('click', (e) => {
        if (!aiTooltip.contains(e.target) && e.target !== aiHelpIcon) {
          aiTooltip.classList.remove('visible');
        }
      });
      
      // Initialize AI selector UI
      updateAiSelectorUI();

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
      let outputMode = 'structured'; // 'raw' or 'structured' - default to structured
      
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
              const errorHtml = test.error ? \`<div class="structured-error">\${escapeHtml(test.error)}</div>\` : '';
              const locationHtml = test.location ? \`<span class="structured-location" data-file="\${escapeHtml(test.location.file)}" data-line="\${test.location.line}">\${escapeHtml(test.location.file)}:\${test.location.line}</span>\` : '';
              
              return \`
                <div class="structured-test \${testClass}" data-file="\${escapeHtml(result.file)}" data-test="\${escapeHtml(test.name)}">
                  <span class="test-icon">\${testIcon}</span>
                  <span class="test-name">\${escapeHtml(test.name)}</span>
                  \${test.duration ? \`<span class="test-duration">(\${test.duration}ms)</span>\` : ''}
                  \${locationHtml}
                  \${errorHtml}
                </div>
              \`;
            }).join('') + '</div>';
          }

          return \`
            <div class="structured-result" data-file="\${escapeHtml(result.file)}">
              <div class="structured-header \${statusClass} clickable">
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
      
      // Helper to resolve relative path to absolute using workspace root
      function resolveStructuredFilePath(relPath) {
        if (!relPath) return null;
        // If already absolute, return as-is
        if (relPath.startsWith('/')) return relPath;
        // Otherwise, prepend workspace root
        if (state.config && state.config.workspacePath) {
          return state.config.workspacePath + '/' + relPath;
        }
        return relPath;
      }
      
      // Use event delegation for structured output clicks (more robust than individual handlers)
      elements.outputStructured.addEventListener('click', (e) => {
        const target = e.target;
        
        // Check if clicked on a location link
        const locationEl = target.closest('.structured-location');
        if (locationEl) {
          e.stopPropagation();
          console.log('[ET WebView] Location clicked');
          const relPath = locationEl.dataset.file;
          const filePath = resolveStructuredFilePath(relPath);
          const line = parseInt(locationEl.dataset.line, 10) || 1;
          console.log('[ET WebView] Opening location:', filePath, 'line:', line);
          if (filePath) {
            send('openFile', { filePath, line });
          }
          return;
        }
        
        // Check if clicked on a test item
        const testEl = target.closest('.structured-test');
        if (testEl) {
          console.log('[ET WebView] Test clicked:', testEl.dataset.test);
          const relPath = testEl.dataset.file;
          const filePath = resolveStructuredFilePath(relPath);
          const testName = testEl.dataset.test;
          console.log('[ET WebView] Opening file:', filePath, 'test:', testName);
          if (filePath) {
            send('openFile', { filePath, searchText: testName });
          }
          return;
        }
        
        // Check if clicked on a header
        const headerEl = target.closest('.structured-header.clickable');
        if (headerEl) {
          console.log('[ET WebView] Header clicked');
          const resultEl = headerEl.closest('.structured-result');
          const relPath = resultEl ? resultEl.dataset.file : null;
          console.log('[ET WebView] Rel path:', relPath);
          const filePath = resolveStructuredFilePath(relPath);
          console.log('[ET WebView] Resolved path:', filePath);
          if (filePath) {
            send('openFile', { filePath });
          }
          return;
        }
      });

      function parseTestOutput(rawText) {
        const results = [];
        const lines = rawText.split('\\n');
        
        let currentResult = null;
        let currentTest = null;
        let capturingError = false;
        let errorLines = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Match PASS/FAIL lines
          const passMatch = line.match(/PASS\\s+(.+?)(?:\\s+\\(([\d.]+)\\s*s\\))?$/);
          const failMatch = line.match(/FAIL\\s+(.+?)(?:\\s+\\(([\d.]+)\\s*s\\))?$/);
          
          if (passMatch || failMatch) {
            // Save any pending error
            if (currentTest && errorLines.length > 0) {
              currentTest.error = errorLines.join('\\n');
              errorLines = [];
            }
            
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
            capturingError = false;
            continue;
          }

          if (currentResult) {
            // Match individual test results - handle various formats
            // Jest uses ✓ for pass and ✕ or × for fail
            const testPassMatch = line.match(/^\\s*[✓✔√]\\s*(.+?)(?:\\s+\\((\\d+)\\s*ms\\))?$/);
            const testFailMatch = line.match(/^\\s*[✗✘×●]\\s*(.+?)(?:\\s+\\((\\d+)\\s*ms\\))?$/);
            
            if (testPassMatch) {
              // Save any pending error from previous test
              if (currentTest && errorLines.length > 0) {
                currentTest.error = errorLines.join('\\n');
                errorLines = [];
              }
              currentTest = { 
                status: 'pass', 
                name: testPassMatch[1].trim(),
                duration: testPassMatch[2] || null
              };
              currentResult.tests.push(currentTest);
              capturingError = false;
            } else if (testFailMatch) {
              // Save any pending error from previous test
              if (currentTest && errorLines.length > 0) {
                currentTest.error = errorLines.join('\\n');
                errorLines = [];
              }
              currentTest = { 
                status: 'fail', 
                name: testFailMatch[1].trim(), 
                duration: testFailMatch[2] || null,
                error: '',
                location: null
              };
              currentResult.tests.push(currentTest);
              capturingError = true;
            } else if (currentTest && currentTest.status === 'fail' && capturingError) {
              // Capture error details
              const trimmedLine = line.trim();
              
              // Look for file location patterns like "at Object.<anonymous> (src/file.ts:123:45)"
              const locationMatch = trimmedLine.match(/at\\s+.+?\\((.+?):(\\d+)(?::\\d+)?\\)/);
              if (locationMatch && !currentTest.location) {
                currentTest.location = {
                  file: locationMatch[1],
                  line: parseInt(locationMatch[2], 10)
                };
              }
              
              // Capture meaningful error content
              if (trimmedLine && !trimmedLine.startsWith('at ')) {
                if (trimmedLine.includes('Expected:') || 
                    trimmedLine.includes('Received:') || 
                    trimmedLine.includes('Error:') ||
                    trimmedLine.includes('expect(') ||
                    trimmedLine.includes('toBe') ||
                    trimmedLine.includes('toEqual') ||
                    trimmedLine.includes('toMatch') ||
                    trimmedLine.includes('toContain') ||
                    trimmedLine.includes('toHaveBeenCalled') ||
                    trimmedLine.startsWith('-') ||
                    trimmedLine.startsWith('+') ||
                    errorLines.length > 0) {
                  // Limit error capture to avoid huge messages
                  if (errorLines.length < 10) {
                    errorLines.push(trimmedLine);
                  }
                }
              }
              
              // Stop capturing on empty line or new section
              if (!trimmedLine || trimmedLine.startsWith('Test Suites:') || trimmedLine.startsWith('Tests:')) {
                if (errorLines.length > 0) {
                  currentTest.error = errorLines.join('\\n');
                  errorLines = [];
                }
                capturingError = false;
              }
            }
          }
        }

        // Save any remaining data
        if (currentTest && errorLines.length > 0) {
          currentTest.error = errorLines.join('\\n');
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
      const logsPaneForResize = document.getElementById('logs-pane');
      
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
            logs: logsPaneForResize?.offsetWidth || 0
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
          
          if (state.logsVisible && logsPaneForResize) {
            const logsWidth = logsPaneForResize.offsetWidth;
            const logsPct = (logsWidth / containerWidth * 100).toFixed(1);
            const specsPct = (remainingPct - parseFloat(logsPct)).toFixed(1);
            mainContent.style.gridTemplateColumns = \`\${projectsPct}% \${specsPct}% \${logsPct}%\`;
          } else {
            mainContent.style.gridTemplateColumns = \`\${projectsPct}% 1fr\`;
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

