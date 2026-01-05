# Quick Start Guide

## Testing the Extension

### 1. Open Extension in VS Code

```bash
cd /Users/piotriw/projects/etoro/et-test-runner-vscode
code .
```

### 2. Launch Extension Development Host

1. Press `F5` (or Run → Start Debugging)
2. A new VS Code window will open with the extension loaded

### 3. Open Your Nx Workspace

In the Extension Development Host window:
1. File → Open Folder
2. Select your Nx workspace (must contain `nx.json`)

### 4. View Test Runner

1. Click the **Testing** icon in the Activity Bar (left sidebar)
2. Expand **ET Test Runner**
3. You should see your projects and specs

### 5. Run Tests

- Click the ▶️ icon next to any spec or project
- View output in the integrated terminal
- Check the Output panel (View → Output → "ET Test Runner") for logs

## Build for Distribution

```bash
npm install -g @vscode/vsce
vsce package
```

This creates a `.vsix` file that can be installed in VS Code.

## Install Locally

The recommended way to install locally is using the install script, which works for both VS Code and Cursor:

```bash
./scripts/install.sh
```

This automatically:
- Builds the extension
- Installs to both VS Code and Cursor
- Uses CLI installation when available, falls back to symlink + `extensions.json` registration otherwise

## Troubleshooting

### Extension Won't Activate

- Check that `nx.json` exists in workspace root
- View → Output → "ET Test Runner" for error messages

### No Projects Showing

- Click refresh button in TreeView title
- Check Output panel for errors
- Verify git repository exists

### Tests Won't Run

- Ensure Nx CLI is available (`npx nx --version`)
- Check that project has Jest configured
- View terminal output for command errors

## Development Tips

### Watch Mode

```bash
npm run watch
```

Then reload the Extension Development Host (Cmd+R or Reload Window).

### View Logs

Output → "ET Test Runner" channel shows:
- Extension activation
- Workspace loading
- Test execution
- Errors and warnings

### Debug Extension

- Set breakpoints in TypeScript files
- Launch with F5
- Debugger attaches to Extension Development Host

### Clear Cache

Command Palette → "ET Test Runner: Clear Test Cache"

## File Structure

```
et-test-runner-vscode/
├── src/
│   ├── extension.ts          # Entry point
│   ├── commands/              # Command handlers
│   ├── views/                 # TreeView providers
│   ├── state/                 # Cache management
│   └── services/              # Core logic (from original)
├── dist/                      # Compiled JavaScript
├── package.json               # Extension manifest
└── tsconfig.json             # TypeScript config
```

## Next Steps

1. **Test with Real Workspace**: Open an actual Nx monorepo
2. **Verify Git Integration**: Make changes and see specs update
3. **Test AI Assist**: Try fixing a failing test
4. **Check Performance**: Test with 50+ projects
5. **Customize Settings**: Adjust `et-test-runner.*` settings

## Configuration

Settings can be changed in:
- User Settings (global)
- Workspace Settings (local to project)

```json
{
  "et-test-runner.baseRef": "origin/main",
  "et-test-runner.coverage": true,
  "et-test-runner.autoRefresh": true
}
```
