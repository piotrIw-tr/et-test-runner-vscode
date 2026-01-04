# ET Test Runner - Installation Guide

This guide explains how to install the ET Test Runner VS Code extension for use with your Nx monorepo.

## Prerequisites

Before installing, ensure you have:

- **Node.js 18+** - Check with `node -v`
- **VS Code** or **Cursor IDE**
- **Git** - To clone the repository
- **An Nx workspace** - The extension only activates in folders containing `nx.json`

> **Using nvm?** If you manage Node.js versions with nvm, make sure to activate Node 18+ before running the install script:
> ```bash
> nvm use 18
> ```

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url> ~/projects/et-test-runner-vscode
cd ~/projects/et-test-runner-vscode
```

> **Note:** You can clone to any location. The install script will detect the path automatically.

### 2. Run the Install Script

```bash
./scripts/install.sh
```

The script will:
1. Verify Node.js 18+ is installed
2. Install npm dependencies
3. Build the TypeScript source
4. Create symlinks in your VS Code and/or Cursor extensions folder

You should see output like:
```
==========================================
  ET Test Runner - Build & Install
==========================================

✓ Node.js v18.x.x
📦 Installing dependencies...
🔨 Building extension...
⚠️  VSIX packaging failed (Node version issue)
📋 Alternative: Use symlink installation
✓ Symlinked to Cursor: ~/.cursor/extensions/etoro.et-test-runner-1.1.0

==========================================
  ✅ Installation Complete!
==========================================
```

### 3. Restart Your IDE

Completely quit and reopen VS Code or Cursor. The extension won't load until you restart.

### 4. Open Your Nx Workspace

Open the folder containing your Nx monorepo (must have `nx.json` at the root).

The **ET Test Runner** icon should now appear in the Activity Bar on the left.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+E` / `Ctrl+E` | Refresh workspace |
| `Cmd+R` / `Ctrl+R` | Run selected tests |
| `Cmd+Shift+R` / `Ctrl+Shift+R` | Run current file's spec |
| `Cmd+X` / `Ctrl+X` | Cancel running test |
| `` ` `` (backtick) | Toggle logs panel |
| `c` | Toggle compact mode |

## Updating the Extension

When updates are available:

```bash
cd ~/projects/et-test-runner-vscode
git pull
npm install
npm run build
```

Then restart your IDE. The symlink points to the same folder, so no reinstallation is needed.

## Uninstalling

To remove the extension:

```bash
# For Cursor
rm ~/.cursor/extensions/etoro.et-test-runner-*

# For VS Code
rm ~/.vscode/extensions/etoro.et-test-runner-*
```

Then restart your IDE.

## Troubleshooting

### Extension Not Visible

- Ensure you restarted VS Code/Cursor after installation
- Verify the symlink exists: `ls -la ~/.cursor/extensions/ | grep et-test-runner`
- Check that `nx.json` exists in your workspace root
- **Important:** Make sure you open an Nx workspace (folder with `nx.json`), not just any folder

### Extension Not Visible in VS Code (but works in Cursor)

The install script now automatically registers the extension in VS Code's `extensions.json`. If you still have issues:

1. Re-run the install script: `./scripts/install.sh`
2. Restart VS Code
3. Open an Nx workspace (folder with `nx.json`)

If that doesn't work, you can manually register:

```bash
cd <path-to>/et-test-runner-vscode
node -e '
const fs = require("fs");
const path = require("path");
const extJsonPath = path.join(process.env.HOME, ".vscode/extensions/extensions.json");
const extensions = JSON.parse(fs.readFileSync(extJsonPath, "utf8"));
if (!extensions.some(e => e.identifier.id === "etoro.et-test-runner")) {
  extensions.push({
    identifier: { id: "etoro.et-test-runner" },
    version: "1.1.0",
    location: { "$mid": 1, path: path.join(process.env.HOME, ".vscode/extensions/etoro.et-test-runner-1.1.0"), scheme: "file" },
    relativeLocation: "etoro.et-test-runner-1.1.0",
    metadata: { installedTimestamp: Date.now(), source: "gallery" }
  });
  fs.writeFileSync(extJsonPath, JSON.stringify(extensions));
  console.log("Extension registered");
} else {
  console.log("Already registered");
}
'
```

Then restart VS Code.

### No Projects Showing

- Click the refresh button in the extension panel
- View logs: **View → Output → "ET Test Runner"**
- Ensure your projects have Jest configured

### Tests Won't Run

- Verify Nx CLI works: `npx nx --version`
- Check that Jest is configured for the project
- View the Output panel for detailed error messages

### Build Errors

If `npm run build` fails:
- Delete `node_modules` and run `npm install` again
- Ensure TypeScript is installed: `npm list typescript`
- Check for syntax errors in the Output panel

## Configuration

Optional settings can be configured in VS Code Settings (JSON):

```json
{
  "et-test-runner.baseRef": "origin/main",
  "et-test-runner.coverage": false,
  "et-test-runner.autoRefresh": true,
  "et-test-runner.skipGitFetch": false,
  "et-test-runner.verbose": false,
  "et-test-runner.compactMode": false,
  "et-test-runner.logsVisible": true
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `baseRef` | `origin/main` | Git reference for detecting changed files |
| `coverage` | `false` | Run tests with coverage enabled |
| `autoRefresh` | `true` | Automatically refresh when files change |
| `skipGitFetch` | `false` | Skip git fetch when detecting changes |
| `verbose` | `false` | Enable verbose logging |
| `compactMode` | `false` | Use compact display mode for specs |
| `logsVisible` | `true` | Show logs pane by default |

## AI Assistance

The extension includes AI-powered test assistance for fixing, writing, and refactoring tests. It works with both **Cursor AI** and **GitHub Copilot**.

For detailed instructions on using AI features, see [AI_USAGE.md](AI_USAGE.md).

**Quick start:**
1. Right-click a spec file in the Specs pane
2. Select "AI Assist"
3. Choose an action (Fix / Write / Refactor)
4. Paste the generated context into your AI chat

