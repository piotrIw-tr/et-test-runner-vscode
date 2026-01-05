#!/bin/bash

# ET Test Runner - Local Build & Install Script
# Usage: ./scripts/install.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=========================================="
echo "  ET Test Runner - Build & Install"
echo "=========================================="
echo ""

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current: $(node -v)"
    exit 1
fi
echo "✓ Node.js $(node -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm ci --silent

# Build
echo ""
echo "🔨 Building extension..."
npm run build

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
VSIX_FILE="et-test-runner-${VERSION}.vsix"

# Set up extension directories based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    VSCODE_EXT_DIR="$HOME/.vscode/extensions"
    CURSOR_EXT_DIR="$HOME/.cursor/extensions"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    VSCODE_EXT_DIR="$HOME/.vscode/extensions"
    CURSOR_EXT_DIR="$HOME/.cursor/extensions"
else
    VSCODE_EXT_DIR="$USERPROFILE/.vscode/extensions"
    CURSOR_EXT_DIR="$USERPROFILE/.cursor/extensions"
fi

LINK_NAME="etoro.et-test-runner-${VERSION}"

# Function to install via symlink and register in extensions.json
install_symlink() {
    local EXT_DIR="$1"
    local IDE_NAME="$2"

    if [ ! -d "$EXT_DIR" ]; then
        echo "⚠️  $IDE_NAME extensions directory not found: $EXT_DIR"
        return
    fi

    # Create symlink
    rm -rf "$EXT_DIR/$LINK_NAME"
    ln -sf "$PROJECT_DIR" "$EXT_DIR/$LINK_NAME"
    echo "✓ Symlinked to $IDE_NAME: $EXT_DIR/$LINK_NAME"

    # Register in extensions.json (required for symlink installs)
    local EXTENSIONS_JSON="$EXT_DIR/extensions.json"
    if [ -f "$EXTENSIONS_JSON" ]; then
        node -e "
const fs = require('fs');
const extPath = '$EXT_DIR/$LINK_NAME';
const extJson = '$EXTENSIONS_JSON';
let extensions = JSON.parse(fs.readFileSync(extJson, 'utf8'));
// Remove old entries
extensions = extensions.filter(e => e.identifier.id !== 'etoro.et-test-runner');
// Add new entry
extensions.push({
  identifier: { id: 'etoro.et-test-runner' },
  version: '$VERSION',
  location: { '\$mid': 1, path: extPath, scheme: 'file' },
  relativeLocation: '$LINK_NAME',
  metadata: { installedTimestamp: Date.now(), source: 'gallery' }
});
fs.writeFileSync(extJson, JSON.stringify(extensions));
console.log('✓ Registered in $IDE_NAME extensions.json');
" 2>/dev/null || echo "⚠️  Could not register in extensions.json ($IDE_NAME may still work)"
    fi
}

# Package (skip if vsce has issues with Node version)
echo ""
echo "📦 Packaging extension..."

VSCODE_INSTALLED=false
CURSOR_INSTALLED=false

# Try to package VSIX
if npx vsce package --allow-missing-repository -o "$VSIX_FILE" 2>/dev/null; then
    echo "✓ Created $VSIX_FILE"

    echo ""
    echo "🚀 Installing extension..."

    # Try CLI install for Cursor
    if command -v cursor &> /dev/null; then
        cursor --install-extension "$VSIX_FILE" --force
        echo "✓ Installed to Cursor via CLI"
        CURSOR_INSTALLED=true
    fi

    # Try CLI install for VS Code
    if command -v code &> /dev/null; then
        code --install-extension "$VSIX_FILE" --force
        echo "✓ Installed to VS Code via CLI"
        VSCODE_INSTALLED=true
    fi
fi

# Fallback to symlink for IDEs where CLI wasn't available
if [ "$VSCODE_INSTALLED" = false ]; then
    echo ""
    echo "📋 Using symlink installation for VS Code..."
    install_symlink "$VSCODE_EXT_DIR" "VS Code"
fi

if [ "$CURSOR_INSTALLED" = false ]; then
    echo ""
    echo "📋 Using symlink installation for Cursor..."
    install_symlink "$CURSOR_EXT_DIR" "Cursor"
fi

echo ""
echo "=========================================="
echo "  ✅ Installation Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Restart VS Code / Cursor"
echo "  2. Open your Nx workspace (e.g., etoro-assets)"
echo "  3. Click the beaker icon (🧪) in the sidebar"
echo ""
echo "Keyboard shortcuts:"
echo "  Ctrl+E / Cmd+E     - Refresh"
echo "  Ctrl+R / Cmd+R     - Run selected"
echo "  Ctrl+X / Cmd+X     - Cancel"
echo "  Ctrl+Shift+R       - Run current file"
echo "  \` (backtick)       - Toggle logs"
echo "  c                  - Compact mode"
echo ""

