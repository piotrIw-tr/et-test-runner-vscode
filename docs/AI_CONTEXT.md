# AI Context: ET Test Runner VS Code Extension

Use this document as a starting point when discussing bugs, features, or improvements with AI assistants.

## Project Overview

**ET Test Runner** is a VS Code/Cursor extension for running Jest tests in Nx monorepos. It provides a WebView-based UI with multiple panes for project selection, spec management, and test output viewing.

### Key Technologies
- **VS Code Extension API** - Commands, WebView, FileSystemWatcher, StatusBar
- **TypeScript** - Compiled to CommonJS (not ESM)
- **WebView UI** - Single HTML file with embedded CSS/JS (no framework)
- **Nx** - Monorepo tooling, uses `nx test` for running tests

## Architecture

```
src/
├── extension.ts              # Entry point, command registration, file watchers
├── commands/                 # Command handlers
│   ├── runTests.ts          # Test execution via Nx CLI
│   ├── aiAssist.ts          # AI context generation (Cursor/Copilot)
│   ├── createSpec.ts        # Missing spec file creation
│   └── refresh.ts           # Workspace scanning
├── webview/
│   ├── TestRunnerViewProvider.ts  # Bridge between extension and WebView
│   └── getWebviewContent.ts       # ALL HTML/CSS/JS for the UI
├── services/
│   ├── ai/generateTestContext.ts  # Markdown context for AI
│   ├── coverage/parseCoverage.ts  # Jest coverage-summary.json parsing
│   ├── git/                       # Change detection
│   ├── specs/                     # Spec file resolution
│   └── test/parseJestResults.ts   # Jest JSON result parsing
├── state/
│   ├── workspaceCache.ts    # Persisted test metrics
│   ├── uiState.ts           # UI preferences
│   └── runningState.ts      # Running process management
└── types/
    └── webview.ts           # Message types between extension ↔ WebView
```

## Critical Files

### `src/webview/getWebviewContent.ts`
- **Contains the entire WebView UI** - HTML structure, CSS styles, JavaScript logic
- Very large file (~1500+ lines)
- Uses vanilla JS, no framework
- State managed via `state` object
- Communication via `vscode.postMessage()` and `window.addEventListener('message')`

### `src/extension.ts`
- Command registration
- File watchers for `.spec.ts` files (with 2-second debounce)
- `skipFileWatcherRefresh` flag to prevent duplicate refreshes
- Initial workspace load (runs in background to not block activation)

### `src/webview/TestRunnerViewProvider.ts`
- Handles messages from WebView
- Manages WebView lifecycle
- `_initialStateSent` flag to prevent duplicate initial data sends

### `src/types/webview.ts`
- **All message types** between extension and WebView
- Update this when adding new message types

## Common Patterns

### Adding a New Keyboard Shortcut
1. Add key handler in `getWebviewContent.ts` → keyboard event listener
2. Update help modal content in same file
3. Update pane-commands section if it's a pane-specific shortcut
4. Navigation is done via arrow keys only (↑/↓), not j/k

### Adding a New Command
1. Register in `extension.ts` with `vscode.commands.registerCommand`
2. Add to `package.json` → `contributes.commands`
3. Optionally add menu contribution in `package.json` → `contributes.menus`
4. For webview commands that run tests, create a `*FromWebview` variant in `runTests.ts` that uses `runTestsWithWebview` for proper output streaming

### Running State Guards
- All test run commands check `runningState.isRunning` before starting
- WebView click handlers and keyboard shortcuts check `state.runningState.isRunning`
- Shows warning message if user tries to run while tests are already running

### Adding WebView ↔ Extension Communication
1. Define message type in `src/types/webview.ts`
2. Send from WebView: `vscode.postMessage({ type: 'myMessage', payload: {...} })`
3. Handle in `TestRunnerViewProvider.ts` → `_handleMessage` switch

### Refresh Flow
- **Manual refresh**: `et-test-runner.refresh` → shows loader, refreshes, hides loader
- **Internal refresh**: `et-test-runner.refreshInternal` → no loader (caller manages)
- **File watcher**: Debounced 2s, skipped if `skipFileWatcherRefresh` is true

## Known Gotchas

### Double Refresh Issues
- File watcher triggers on `.spec.ts` changes with 2s debounce
- Use `skipFileWatcherRefresh` flag when doing manual refresh that creates files
- Reset flag after 3s (longer than debounce)

### CommonJS vs ESM
- Project uses CommonJS output
- Don't use `import.meta.url` - use `extensionRoot` variable set in `extension.ts`
- Template paths resolved via `setExtensionRoot()` in `generateTestContext.ts`

### WebView State
- `retainContextWhenHidden: true` keeps WebView alive
- `_initialStateSent` flag prevents duplicate data on re-focus
- WebView sends `ready` message on load

### Karma Projects
- Run is disabled for Karma (only Jest supported)
- Check `project.runner === 'karma'` to disable actions
- UI shows disabled state for buttons/menu items

### Context Menu Positioning
- Menu can overflow screen edge
- Use `Math.min(x, window.innerWidth - menuWidth)` for positioning

## Debugging Tips

1. **Extension logs**: View → Output → "ET Test Runner"
2. **WebView DevTools**: Help → Toggle Developer Tools (in Extension Host window)
3. **Message tracing**: Add `console.log` in `_handleMessage` and WebView's message listener
4. **Timing logs**: Enable `verbose: true` in settings to see timing for git operations and project indexing
5. **Startup loader**: WebView shows loading state with status updates during initialization

## Common Bug Report Template

When reporting a bug, provide:
```
**What happened**: [Describe the issue]
**Expected**: [What should happen]
**Steps to reproduce**:
1. [Step 1]
2. [Step 2]

**Relevant pane**: Projects / Specs / Output / Logs
**Trigger**: Keyboard shortcut / Click / Automatic
```

## Feature Request Template

When requesting a feature:
```
**Feature**: [Brief description]
**Use case**: [Why is this needed]
**Affected panes**: Projects / Specs / Output / Logs / Header
**Keyboard shortcut needed**: Yes/No
**Similar to**: [Reference existing feature if applicable]
```

## Quick Reference: Message Types

### WebView → Extension
- `ready` - WebView loaded
- `refresh` - Request workspace refresh
- `runTests` - Run selected specs
- `aiAssist` - Trigger AI context generation
- `createSpec` - Create missing spec file
- `openFile` - Open file in editor
- `log` - Add log entry

### Extension → WebView
- `initialize` - Initial state (projects, config, branches)
- `updateProjects` - Refreshed project list
- `testOutput` - Streaming test output
- `testComplete` - Test run finished
- `showLoader` / `hideLoader` - Global loading overlay

## UI Layout

```
┌─────────────────────────────────────────────────────────┐
│ Header: Status | Project | Cache | Branches | AI btns  │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│   Projects   │              Specs                       │
│   (list)     │              (list + search)             │
│              │                                          │
├──────────────┴──────────────────────────────────────────┤
│  OUTPUT / LOGS header (click to collapse)   [▲]        │
├────────────────────────────────────┬────────────────────┤
│                                    │                    │
│              Output                │       Logs         │
│         (Structured/Raw)           │     (side panel)   │
│                                    │                    │
└────────────────────────────────────┴────────────────────┘
```

**Bottom Section:**
- Output and Logs panes are side by side
- Shared header bar spans both panes
- Click header to collapse/expand entire bottom section
- Drag vertical separator to resize logs width

### Keyboard Shortcuts

**Projects Pane:**
- `↑/↓` - Navigate between projects (auto-selects)
- `Enter` - Open project menu (Run All / Run Changed)
- `⇧A` - Run all specs in focused project
- `⇧R` - Run only changed specs
- `Tab` - Switch to Specs pane

**Specs Pane:**
- `↑/↓` - Navigate between specs
- `Space` - Toggle selection
- `o` - Open spec file in editor
- `Enter` - Open context menu
- `⇧A` - Run all specs in project
- `Tab` - Switch to Projects pane

**Output Pane:**
- Defaults to Structured view with real-time updates
- Raw view available for detailed console output

### Running Tests
- Single global loader shows during test runs with project name and progress
- Failed specs are logged with names after test completion
- Extensive logging in Logs pane shows what's happening
- Duplicate run prevention: cannot start new tests while tests are running
- All webview commands use dedicated `*FromWebview` functions for proper output streaming

## Style Guidelines

- Use CSS variables for colors (defined in `:root`)
- Pane backgrounds slightly darker than VS Code default
- Left border highlight for focused items
- Dimmed horizontal separators between list items
- Condensed vertical spacing in project items

