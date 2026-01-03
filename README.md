# ET Test Runner

A VS Code/Cursor extension for smart test running in Nx monorepos with Git-based change detection and AI-assisted debugging.

## 🚀 Quick Install (Team)

```bash
# Clone the repo
git clone <repo-url> et-test-runner-vscode
cd et-test-runner-vscode

# Build and install
./scripts/install.sh
```

Then restart VS Code/Cursor and open your Nx workspace (e.g., `etoro-assets`).

---

## Features

### Multi-Pane WebView UI
- **Projects Pane** - Browse projects with test metrics, coverage (Stmts/Funcs/Branch), and runner tags (Jest/Karma). Subtle separators between items.
- **Specs Pane** - Select, search, and run specs with inline failure preview. Paths displayed below filenames.
- **Output Pane** - Live test streaming with clickable stack traces (40% height, resizable)
- **Logs Pane** - Vertical toggle bar on the right side of output; click to expand/collapse, drag to resize width

### Header Information
The header displays comprehensive status information similar to the console app:
- **Status** - Ready / Running indicator with project count
- **Project** - Currently selected project name
- **Cache** - Number of cached test results
- **Base Branch** - Git base reference for change detection
- **Current Branch** - Your active git branch
- **Workspace Path** - Nx workspace location

### Core Features
- 🔍 **Git-Based Change Detection** - Detects unstaged, staged, and committed changes
- 📊 **Smart Spec Resolution** - Maps source files to their test specs
- ⚡ **Efficient Execution** - Runs specs within a single project (no multi-project runs)
- 💾 **Metrics Caching** - Stores results, durations, and pass/fail counts
- 🤖 **AI-Assisted Debugging** - Integrates with Cursor/GitHub Copilot
- 📈 **Coverage Display** - Shows detailed coverage (Stmts/Funcs/Branch %)
- 🔄 **Auto-Refresh** - Updates on file/git changes
- 🎯 **Auto-Select First Project** - First project is selected on load

### Runner Support
- **Jest** - Full support: run tests, select specs, view metrics
- **Karma** - Limited: view specs, generate missing spec files (run disabled)

### Power User Features
- **Type-to-Search** - Just start typing while in specs pane (no need to focus input)
- **Fuzzy Search** - Type `status:fail` or `change:unstaged` to filter
- **Pinned Specs** - Pin frequently-used specs (★ separated at top)
- **Run History** - Collapsible history pane with recent runs
- **Compact Mode** - Dense layout for large spec lists
- **Performance Tracking** - SLOW and FLAKY badges on specs
- **Structured Output** - Toggle between raw and parsed test results
- **Running Overlay** - Blocks interaction during test runs
- **Resizable Panes** - Drag separators to adjust pane sizes
- **Help Modal** - Press `?` to see all available shortcuts
- **Jest Testing Rules** - Auto-creates `.cursor/rules/jest-testing.mdc` with AI patterns

---

## Keyboard Shortcuts

Press `?` at any time to see the help modal with all shortcuts.

### Navigation
| Shortcut | Action |
|----------|--------|
| `Tab` | Switch between Projects/Specs panes |
| `j` / `k` or `↑` / `↓` | Navigate up/down (projects pane also selects) |
| `Enter` | Open spec context menu |
| Click on pane | Make pane active |

### Specs Pane
| Shortcut | Action |
|----------|--------|
| `Space` | Toggle spec selection |
| `Ctrl+R` / `Cmd+R` | Run focused spec |
| `Ctrl+A` | Select all specs |
| `Ctrl+L` | Clear selection |
| `Ctrl+D` | Pin/Unpin spec |

### Search & Filter
| Shortcut | Action |
|----------|--------|
| `/` or `Ctrl+F` | Focus search input |
| `Escape` | Clear search |
| Any letter/number | Type-to-search (while in specs pane) |

### Other
| Shortcut | Action |
|----------|--------|
| `Ctrl+X` / `Cmd+X` | Cancel running test |
| `` ` `` (backtick) | Toggle logs pane |
| `c` | Toggle compact mode |
| `?` | Show help modal |

---

## Search Syntax

| Filter | Example | Description |
|--------|---------|-------------|
| `status:` | `status:fail` | Show only failed/pass/pending |
| `change:` | `change:unstaged` | Filter by git status |
| `name:` | `name:auth` | Fuzzy match on filename |
| Plain text | `service` | Fuzzy match anywhere |

Combine filters: `status:fail change:unstaged`

---

## Configuration

In VS Code settings (`Cmd+,`):

```json
{
  "et-test-runner.baseRef": "origin/main",
  "et-test-runner.coverage": false,
  "et-test-runner.autoRefresh": true,
  "et-test-runner.skipGitFetch": false,
  "et-test-runner.compactMode": false
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `baseRef` | `origin/main` | Git ref for change detection |
| `coverage` | `false` | Run with `--coverage` flag |
| `autoRefresh` | `true` | Auto-refresh on file changes |
| `skipGitFetch` | `false` | Skip `git fetch` on refresh |
| `compactMode` | `false` | Use dense UI layout |

---

## Usage

### 1. Open the Panel
Click the **eToro test icon** in the Activity Bar to open ET Test Runner.

### 2. Select Project
Click a project in the left pane (or first one auto-selects). Projects show:
- Status icon (✓ pass / ✗ fail / ○ not run)
- Project name with runner tag (JEST/KARMA)
- Spec count
- Metrics: `✓12 ✗0 ~2 Σ14` (passed, failed, skipped, total)
- Coverage: `Stmts 96% Funcs 90% Branch 95%`

### 3. Run Tests
- **Single spec**: Press `Ctrl+R` or right-click → Run
- **Multiple specs**: `Space` to select, then click "Run Selected"
- **Current file**: `Ctrl+Shift+R` from any `.ts` file

Note: Run is disabled for Karma projects (only Jest supported).

### 4. AI Assistance
1. Press `Enter` on a failing spec or select from context menu
2. Choose action: **Fix** (fix failures), **Write** (add tests), or **Refactor** (improve tests)
3. Context is generated with:
   - Failing test names and error messages (for Fix action)
   - Related source file references
   - Console output excerpts
   - Jest testing rules (auto-created in `.cursor/rules/jest-testing.mdc`)
4. Context is copied to clipboard
5. Cursor/Copilot chat opens automatically
6. Press Cmd+V to paste context

**Update Testing Rules**: Run command `ET Test Runner: Update Jest Testing Rules` to refresh the rules template.

### 5. Resize Panes
- Drag the vertical separator between Projects and Specs panes
- Drag the horizontal separator above the Output pane
- Output pane defaults to 40% height

### 6. Toggle Logs
- Click on the vertical "LOGS" bar (right side of output pane) to expand/collapse
- When expanded, drag the bar to resize logs width (150px - 600px)
- Press backtick (`` ` ``) to toggle from keyboard

---

## Requirements

- VS Code 1.85+ or Cursor
- Node.js 18+
- Nx workspace with `nx.json`
- Git repository

---

## Development

### Build from Source

```bash
npm install
npm run build
```

### Run in Debug Mode

1. Open extension folder in VS Code/Cursor
2. Press `F5` to launch Extension Development Host
3. Open your Nx workspace in the new window

### Watch Mode

```bash
npm run watch
```

### Local Installation

```bash
./scripts/install.sh
```

This creates a symlink in your VS Code/Cursor extensions directory.

### Debugging

- **Extension logs**: View → Output → "ET Test Runner"
- **WebView errors**: Developer Tools (Ctrl+Shift+I in Extension Host)
- **TypeScript errors**: Debug Console in original window

---

## Architecture

```
src/
├── extension.ts              # Entry point
├── commands/                 # Command handlers
│   ├── runTests.ts          # Test execution
│   ├── aiAssist.ts          # AI integration
│   ├── createSpec.ts        # Missing spec creation
│   └── refresh.ts           # Workspace refresh
├── webview/                  # WebView UI
│   ├── TestRunnerViewProvider.ts
│   └── getWebviewContent.ts  # HTML/CSS/JS
├── services/                 # Business logic
│   ├── ai/                  # AI context generation
│   ├── coverage/            # Coverage parsing
│   ├── git/                 # Change detection
│   ├── nx/                  # Nx CLI resolution
│   ├── specs/               # Spec resolution
│   ├── workspace/           # Nx workspace detection
│   └── test/                # Jest parsing
├── state/                   # State management
│   ├── workspaceCache.ts    # Test metrics cache
│   ├── uiState.ts           # UI persistence
│   └── runningState.ts      # Running process
├── types/                   # TypeScript types
docs/
└── jest-testing-template.mdc # Jest testing rules template
```

---

## Troubleshooting

### Extension doesn't activate
- Ensure `nx.json` exists in workspace root or a direct subdirectory
- Check Output → "ET Test Runner" for errors

### No projects shown
- Run `git status` to verify changes exist
- Check `baseRef` setting matches your branch
- Ensure workspace is detected (check header for path)

### Tests not running
- Verify `nx test <project>` works from terminal
- Check Output pane for command errors
- Ensure project uses Jest (Karma projects have run disabled)

### AI assist not opening chat
- Ensure Cursor or GitHub Copilot is installed
- Context is always copied to clipboard as fallback

### Branch not showing
- Ensure you're in a git repository
- Check that `git rev-parse --abbrev-ref HEAD` works

---

## License

MIT

## Contributing

1. Fork the repo
2. Create feature branch
3. Make changes
4. Run `npm run build` to verify
5. Submit PR
