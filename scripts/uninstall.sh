#!/bin/bash

# ET Test Runner - Uninstall Script
# Usage: ./scripts/uninstall.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=========================================="
echo "  ET Test Runner - Uninstall"
echo "=========================================="
echo ""

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")

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

# Function to uninstall from an IDE
uninstall_from_ide() {
    local EXT_DIR="$1"
    local IDE_NAME="$2"

    if [ ! -d "$EXT_DIR" ]; then
        echo "⚠️  $IDE_NAME extensions directory not found: $EXT_DIR"
        return
    fi

    # Remove symlink/folder
    if [ -e "$EXT_DIR/$LINK_NAME" ] || [ -L "$EXT_DIR/$LINK_NAME" ]; then
        rm -rf "$EXT_DIR/$LINK_NAME"
        echo "✓ Removed extension from $IDE_NAME: $EXT_DIR/$LINK_NAME"
    else
        # Try to find any version of the extension
        local FOUND=$(ls -d "$EXT_DIR"/etoro.et-test-runner-* 2>/dev/null)
        if [ -n "$FOUND" ]; then
            rm -rf "$EXT_DIR"/etoro.et-test-runner-*
            echo "✓ Removed extension from $IDE_NAME"
        else
            echo "⚠️  Extension not found in $IDE_NAME"
        fi
    fi

    # Remove from extensions.json
    local EXTENSIONS_JSON="$EXT_DIR/extensions.json"
    if [ -f "$EXTENSIONS_JSON" ]; then
        node -e "
const fs = require('fs');
const extJson = '$EXTENSIONS_JSON';
let extensions = JSON.parse(fs.readFileSync(extJson, 'utf8'));
const before = extensions.length;
extensions = extensions.filter(e => e.identifier.id !== 'etoro.et-test-runner');
if (extensions.length < before) {
  fs.writeFileSync(extJson, JSON.stringify(extensions));
  console.log('✓ Unregistered from $IDE_NAME extensions.json');
}
" 2>/dev/null || true
    fi
}

# Uninstall from both IDEs
uninstall_from_ide "$VSCODE_EXT_DIR" "VS Code"
uninstall_from_ide "$CURSOR_EXT_DIR" "Cursor"

echo ""
echo "=========================================="
echo "  ✅ Uninstall Complete!"
echo "=========================================="
echo ""
echo "Restart VS Code / Cursor for changes to take effect."
echo ""

