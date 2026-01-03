# Feature Comparison: Console TUI vs VS Code Extension

## Summary

| Category | Console TUI | VS Code Extension | Status |
|----------|-------------|-------------------|--------|
| **Core Features** | ✅ Fully implemented | ⚠️ Partially implemented | 70% parity |
| **UI/UX** | ✅ Rich terminal UI | ⚠️ Basic TreeView | Limited |
| **Keyboard Navigation** | ✅ Extensive | ⚠️ Minimal | Limited |
| **AI Integration** | ✅ Full | ✅ Full | ✅ Complete |
| **Test Execution** | ✅ PTY with colors | ⚠️ Basic terminal | Functional |
| **Visual Feedback** | ✅ Rich styling | ⚠️ Icons only | Limited |

---

## Detailed Feature Comparison

### ✅ FULLY MIGRATED (100% Parity)

#### Core Services
- ✅ **Git Change Detection** - Identical logic (Unstaged > Staged > Committed priority)
- ✅ **Spec Resolution** - Same algorithm for deriving specs from source files
- ✅ **Missing Spec Detection** - Tracks source files without tests
- ✅ **Nx Workspace Discovery** - Same workspace/project indexing
- ✅ **Test Result Parsing** - Reuses parseJestResults/parseJestSummary
- ✅ **Cache Persistence** - Stores per-spec metrics (now in VS Code storage)
- ✅ **AI Context Generation** - Same markdown context for AI assistance
- ✅ **Multi-Spec Execution** - Single Nx command with regex pattern

#### Functional Features
- ✅ **Run Single Spec** - Click to run individual test
- ✅ **Run All Project Tests** - Execute entire project
- ✅ **Run All Changed Tests** - Run specs with git changes
- ✅ **AI Assist Actions** - Fix/Write/Refactor options
- ✅ **Refresh Workspace** - Reload git changes and specs
- ✅ **Clear Cache** - Reset cached metrics
- ✅ **Coverage Support** - Optional coverage flag

---

### ⚠️ PARTIALLY IMPLEMENTED (Functional but Limited)

#### UI/UX Features

| Feature | Console TUI | VS Code Extension | Gap |
|---------|-------------|-------------------|-----|
| **Layout** | 4-pane (Projects, Specs, Output, Logs) | 2-pane (TreeView, Output) | No logs pane as separate view |
| **Project Display** | 3-line cards with metrics | Tree items with description | Less visual prominence |
| **Spec Display** | Rich formatting, checkboxes | Tree items with icons | No checkboxes |
| **Status Icons** | ✔ ✗ ○ ⏳ with colors | 🧪 icons | Limited variety |
| **Metrics Display** | Inline counts, durations | Tooltip on hover | Less prominent |
| **Search/Filter** | Inline search box (Ctrl+F) | Not implemented | ❌ Missing |

#### Navigation & Controls

| Feature | Console TUI | VS Code Extension | Implementation |
|---------|-------------|-------------------|----------------|
| **Multi-Selection** | Space to toggle checkboxes | Cmd+Click (native) | ✅ Enabled |
| **Focus Cycling** | Tab/Shift+Tab between panes | Native VS Code | ⚠️ Different UX |
| **Vim Navigation** | j/k for up/down | Not supported | ❌ Missing |
| **Pointer Indicator** | ▸ shows current item | VS Code highlight | Different |
| **Select All** | Ctrl+A | Native selection | Different UX |
| **Clear Selection** | Ctrl+L | Native | Different UX |

#### Keyboard Shortcuts

| Action | Console TUI | VS Code Extension | Status |
|--------|-------------|-------------------|--------|
| **Run Selected** | Ctrl+R | Cmd+R (Ctrl+R) | ✅ Implemented |
| **Run All Changed** | Shift+R | No keybinding | ⚠️ Menu only |
| **Run All Tests** | Shift+A | No keybinding | ⚠️ Menu only |
| **Refresh** | Ctrl+E | Cmd+E (Ctrl+E) | ✅ Implemented |
| **Cancel Test** | Ctrl+X | No keybinding | ❌ Missing |
| **AI Assist** | Enter on spec | Right-click menu | ⚠️ Different |
| **Search** | Ctrl+F or / | Not implemented | ❌ Missing |
| **Toggle Logs** | Backtick (`) | View → Output | Different |
| **Cycle Layout** | Shift+L | N/A | N/A for VS Code |
| **Help** | ? | Not implemented | ❌ Missing |

#### Visual Feedback

| Feature | Console TUI | VS Code Extension | Notes |
|---------|-------------|-------------------|-------|
| **Running State** | Yellow spinner ⏳ | No visual indicator | ❌ Missing |
| **Dimmed Display** | Non-running specs dimmed | All visible | ❌ Missing |
| **Busy Overlay** | "Refreshing..." modal | Progress notification | Different |
| **Test Metrics** | Inline (45 passed, 2 failed) | Tooltip only | Less prominent |
| **Coverage %** | Shown on project card | Not displayed | ❌ Missing |
| **Duration** | Shown inline (2.5s) | Tooltip only | Less prominent |
| **Change Status** | U/S/C badges | Icon colors | Less clear |

---

### ❌ NOT IMPLEMENTED (Missing Features)

#### Advanced UI Features
- ❌ **Inline Search/Filter** - No Ctrl+F search box for filtering specs
- ❌ **Logs Pane** - Output channel exists but not as prominent sidebar pane
- ❌ **Real-time Status Updates** - No live updates during test execution
- ❌ **Layout Presets** - No adjustable pane sizes (Shift+L in TUI)
- ❌ **Progress Indicators** - No spinner/progress during test runs
- ❌ **Color-coded Output** - Plain text output (vs ANSI colors in TUI)
- ❌ **Project Cards** - No multi-line card display with metrics
- ❌ **Missing Specs View** - Missing specs not shown prominently
- ❌ **Cache Statistics** - No display of cache info in header

#### Interaction Patterns
- ❌ **Checkbox Selection** - Native multi-select instead of checkboxes
- ❌ **Keyboard-only Navigation** - Requires mouse for many actions
- ❌ **Contextual Help** - No ? key for help overlay
- ❌ **Quick Actions Menu** - Enter on spec doesn't show action menu
- ❌ **Inline Coverage** - Coverage % not shown in tree view
- ❌ **Status Bar Info** - Limited header/status information

#### Test Execution
- ❌ **PTY Output** - Uses pipe execution (no ANSI colors, spinners)
- ❌ **Cancel Test** - No Ctrl+X to cancel running tests
- ❌ **Live Output Streaming** - Output appears after test completes
- ❌ **Test Isolation Indicators** - No visual separation of multi-spec runs
- ❌ **Terminal Resize** - Not applicable in VS Code context

#### Missing Spec Management
- ❌ **Create Missing Spec** - No command to scaffold missing tests
- ❌ **Missing Spec Count** - Not prominently displayed
- ❌ **Missing Spec List** - Not shown as separate tree section

---

## Priority Improvements Needed

### 🔴 High Priority (Major UX Issues)

1. **Inline Search/Filter**
   - Console: Ctrl+F opens search, filters specs live
   - Extension: No search - must scroll through large lists
   - **Impact:** Critical for large monorepos (50+ projects)

2. **Real-time Test Status**
   - Console: See running tests with spinner, live updates
   - Extension: No feedback until tests complete
   - **Impact:** Unclear if tests are running or hung

3. **Prominent Metrics Display**
   - Console: Test counts visible inline (45/50 passed)
   - Extension: Hidden in tooltips
   - **Impact:** Hard to see project health at a glance

4. **Missing Specs Visibility**
   - Console: Shown in tree and highlighted
   - Extension: Not visible at all
   - **Impact:** Can't identify coverage gaps

5. **AI Assist Quick Access**
   - Console: Press Enter on spec → menu
   - Extension: Right-click → menu
   - **Impact:** Extra steps for common action

### 🟡 Medium Priority (Usability Improvements)

6. **Cancel Test Execution**
   - Console: Ctrl+X stops running test
   - Extension: Must kill terminal manually
   - **Impact:** Can't stop long-running tests

7. **Coverage Display**
   - Console: Shows % on project cards
   - Extension: Not visible
   - **Impact:** Can't see coverage metrics

8. **Live Output**
   - Console: Streaming output with colors
   - Extension: Plain text after completion
   - **Impact:** Harder to read, no progress indication

9. **Keyboard Navigation**
   - Console: Full keyboard control (j/k, Tab, etc.)
   - Extension: Requires mouse for most actions
   - **Impact:** Slower workflow for power users

10. **Visual Status Indicators**
    - Console: Color-coded, animated indicators
    - Extension: Static icons
    - **Impact:** Less clear project state

### 🟢 Low Priority (Nice to Have)

11. **Layout Customization** - Adjustable pane sizes
12. **Help System** - ? key for shortcuts
13. **Vim Navigation** - j/k for up/down
14. **Project Cards** - Multi-line display format
15. **Change Status Badges** - U/S/C labels vs icons

---

## Recommended Implementation Plan

### Phase 1: Critical Features (Week 1-2)
- [ ] Add inline search/filter (QuickPick or WebView)
- [ ] Show missing specs in tree
- [ ] Display metrics inline (not just tooltips)
- [ ] Add cancel test command (Ctrl+X)

### Phase 2: Enhanced UX (Week 3-4)
- [ ] Real-time test status updates
- [ ] Live output streaming
- [ ] Coverage % display
- [ ] Keyboard shortcuts for all actions

### Phase 3: Polish (Week 5+)
- [ ] AI assist quick menu (Enter key)
- [ ] Better visual indicators (spinners, colors)
- [ ] Logs panel as WebView
- [ ] Project card-style display

---

## Architecture Differences

### Console TUI
```
blessed Screen
  ├── Header (2 lines)
  ├── Logs Pane (20% width, toggleable)
  ├── Main Area (80% width)
  │   ├── Projects List (40% height)
  │   ├── Specs List (60% height)
  │   └── Output Pane (full width)
  └── Footer (status bar)
```

### VS Code Extension
```
Activity Bar Icon
  └── TreeView Container
      ├── Projects (TreeDataProvider)
      │   └── Specs (children)
      └── Output Channel (separate panel)
```

**Key Difference:** TUI has 4 synchronized panes; VS Code uses native TreeView with limited layout control.

---

## What Can't Be Migrated

Some TUI features are **impossible** in VS Code extensions:

1. **Custom Layout** - VS Code controls TreeView layout
2. **ANSI Colors** - Terminal output doesn't support full ANSI
3. **Blessed Widgets** - No equivalent in VS Code API
4. **PTY Control** - VS Code Terminal API is more limited
5. **Custom Rendering** - TreeView has fixed styling

**Alternatives:**
- WebView for custom UI (but separate from TreeView)
- Task API for test execution
- Output Channel for logs
- Decorations for inline metrics

---

## Conclusion

The VS Code extension has **70% feature parity** with the console TUI:

✅ **Strengths:**
- All core services work identically
- Better IDE integration
- Native VS Code UI patterns
- Persistent cache via workspaceState

⚠️ **Weaknesses:**
- Limited visual customization
- Less keyboard-driven
- Missing search/filter
- Metrics less prominent
- No real-time updates

**Recommendation:**
Focus on Phase 1 critical features to bring parity to **90%**, making the extension usable for large monorepos while accepting that some TUI features (custom layouts, full keyboard control) aren't possible in VS Code's architecture.
