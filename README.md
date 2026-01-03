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
- **Projects Pane** - Browse projects with test metrics, coverage, and runner tags (Jest/Karma)
- **Specs Pane** - Select, search, and run specs with inline failure preview
- **Output Pane** - Live test streaming with clickable stack traces
- **Logs Pane** - Timestamped debug/info/error entries (toggleable)

### Header Information
The header displays comprehensive status information similar to the console app:
- **Status** - Ready / Running indicator with project count
- **Project** - Currently selected project name
- **Cache** - Number of cached test results
- **Logs Toggle** - Click to show/hide logs (ON/OFF indicator)
- **Base Branch** - Git base reference for change detection
- **Current Branch** - Your active git branch
- **Workspace Path** - Nx workspace location

### Core Features
- 🔍 **Git-Based Change Detection** - Detects unstaged, staged, and committed changes
- 📊 **Smart Spec Resolution** - Maps source files to their test specs
- ⚡ **Efficient Execution** - Runs multiple specs in a single Nx command
- 💾 **Metrics Caching** - Stores results, durations, and pass/fail counts
- 🤖 **AI-Assisted Debugging** - Integrates with Cursor/GitHub Copilot
- 📈 **Coverage Display** - Shows coverage % from Jest reports
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

---

## Keyboard Shortcuts

### Global
| Shortcut | Action |
|----------|--------|
| `Ctrl+E` / `Cmd+E` | Refresh workspace |
| `Ctrl+R` / `Cmd+R` | Run selected specs |
| `Ctrl+X` / `Cmd+X` | Cancel running test |
| `Ctrl+Shift+R` | Quick run current file's spec |
| `` ` `` (backtick) | Toggle logs pane |
| `c` | Toggle compact mode |
| `Tab` | Navigate between panes |

### Projects Pane
| Shortcut | Action |
|----------|--------|
| `j` / `k` or `↑` / `↓` | Navigate projects |
| `Enter` | Select project |
| `r` | Run all specs in project |
| `R` | Run only changed specs |

### Specs Pane
| Shortcut | Action |
|----------|--------|
| `j` / `k` or `↑` / `↓` | Navigate specs |
| `Space` | Toggle spec selection |
| `Enter` | Show context menu |
| `r` | Run focused spec |
| `R` | Run all specs in project |
| `/` or `Ctrl+F` | Focus search |
| `Escape` | Clear search |
| `Backspace` | Remove last search character |
| Any letter/number | Type-to-search |

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
  "et-test-runner.compactMode": false,
  "et-test-runner.logsVisible": true
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `baseRef` | `origin/main` | Git ref for change detection |
| `coverage` | `false` | Run with `--coverage` flag |
| `autoRefresh` | `true` | Auto-refresh on file changes |
| `skipGitFetch` | `false` | Skip `git fetch` on refresh |
| `compactMode` | `false` | Use dense UI layout |
| `logsVisible` | `true` | Show logs pane by default |

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
- Coverage percentage

### 3. Run Tests
- **Single spec**: Press `r` or right-click → Run
- **Multiple specs**: `Space` to select, then `Cmd+R`
- **All project**: Press `R` in specs pane
- **Current file**: `Ctrl+Shift+R` from any `.ts` file

Note: Run is disabled for Karma projects (only Jest supported).

### 4. AI Assistance
1. Click ✨ on a failing spec or select "AI Assist" from menu
2. Context is copied to clipboard
3. Cursor/Copilot chat opens automatically
4. Press Cmd+V to paste context

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
└── types/                   # TypeScript types
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
