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

# Package (skip if vsce has issues with Node version)
echo ""
echo "📦 Packaging extension..."

# Try to package, fall back to symlink install if it fails
if npx vsce package --allow-missing-repository -o "$VSIX_FILE" 2>/dev/null; then
    echo "✓ Created $VSIX_FILE"
    
    # Install to VS Code
    echo ""
    echo "🚀 Installing extension..."
    
    if command -v cursor &> /dev/null; then
        cursor --install-extension "$VSIX_FILE" --force
        echo "✓ Installed to Cursor"
    fi
    
    if command -v code &> /dev/null; then
        code --install-extension "$VSIX_FILE" --force
        echo "✓ Installed to VS Code"
    fi
else
    echo "⚠️  VSIX packaging failed (Node version issue)"
    echo ""
    echo "📋 Alternative: Use symlink installation"
    echo ""
    
    # Symlink install for development
    EXTENSIONS_DIR=""
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        EXTENSIONS_DIR="$HOME/.vscode/extensions"
        CURSOR_DIR="$HOME/.cursor/extensions"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        EXTENSIONS_DIR="$HOME/.vscode/extensions"
        CURSOR_DIR="$HOME/.cursor/extensions"
    else
        EXTENSIONS_DIR="$USERPROFILE/.vscode/extensions"
        CURSOR_DIR="$USERPROFILE/.cursor/extensions"
    fi
    
    LINK_NAME="etoro.et-test-runner-${VERSION}"
    
    # VS Code
    if [ -d "$EXTENSIONS_DIR" ]; then
        rm -rf "$EXTENSIONS_DIR/$LINK_NAME"
        ln -sf "$PROJECT_DIR" "$EXTENSIONS_DIR/$LINK_NAME"
        echo "✓ Symlinked to VS Code: $EXTENSIONS_DIR/$LINK_NAME"
        
        # Register in VS Code extensions.json (required for symlink installs)
        EXTENSIONS_JSON="$EXTENSIONS_DIR/extensions.json"
        if [ -f "$EXTENSIONS_JSON" ]; then
            node -e "
const fs = require('fs');
const path = '$EXTENSIONS_DIR/$LINK_NAME';
const extJson = '$EXTENSIONS_JSON';
let extensions = JSON.parse(fs.readFileSync(extJson, 'utf8'));
// Remove old entries
extensions = extensions.filter(e => e.identifier.id !== 'etoro.et-test-runner');
// Add new entry
extensions.push({
  identifier: { id: 'etoro.et-test-runner' },
  version: '$VERSION',
  location: { '\$mid': 1, path: path, scheme: 'file' },
  relativeLocation: '$LINK_NAME',
  metadata: { installedTimestamp: Date.now(), source: 'gallery' }
});
fs.writeFileSync(extJson, JSON.stringify(extensions));
console.log('✓ Registered in VS Code extensions.json');
" 2>/dev/null || echo "⚠️  Could not register in extensions.json (VS Code may still work)"
        fi
    fi
    
    # Cursor
    if [ -d "$CURSOR_DIR" ]; then
        rm -rf "$CURSOR_DIR/$LINK_NAME"
        ln -sf "$PROJECT_DIR" "$CURSOR_DIR/$LINK_NAME"
        echo "✓ Symlinked to Cursor: $CURSOR_DIR/$LINK_NAME"
    fi
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

