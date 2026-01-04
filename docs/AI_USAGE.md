# ET Test Runner - AI Usage Guide

The ET Test Runner extension includes AI-powered assistance for working with Jest tests. This guide explains how to use these features with Cursor AI or GitHub Copilot.

## Overview

The AI Assist feature generates context about a spec file and copies it to your clipboard. You then paste this context into your AI chat to get help with:

- **Fix** - Diagnose and fix failing tests
- **Write** - Add new test cases for better coverage
- **Refactor** - Improve test structure and readability

## Supported AI Tools

| Tool | Support | Notes |
|------|---------|-------|
| **Cursor AI** | Full | Creates `.cursor/rules/jest-testing.mdc` with testing guidelines |
| **GitHub Copilot** | Full | Creates `.github/copilot-instructions.md` with testing guidelines |

## How to Use AI Assist

### Step 1: Select a Spec File

In the ET Test Runner panel, navigate to a spec file you want to work on.

### Step 2: Open AI Assist

**Option A: Context Menu**
- Right-click the spec file
- Select "AI Assist"

**Option B: Keyboard**
- Focus the spec file
- Press the AI Assist shortcut (if configured)

### Step 3: Choose an Action

A menu appears with three options:

| Action | Use When |
|--------|----------|
| **Fix Failing Tests** | Tests are failing and you need help debugging |
| **Write New Tests** | You want to add more test coverage |
| **Refactor Tests** | Tests work but need cleanup or improvement |

### Step 4: Select AI Target

Choose your AI tool:
- **Cursor** - Uses Cursor's built-in AI chat
- **Copilot** - Uses GitHub Copilot Chat

### Step 5: Paste Context

The extension:
1. Generates context about the spec file
2. Copies it to your clipboard
3. Opens the AI chat panel (if possible)

Simply **paste** (`Cmd+V` / `Ctrl+V`) into the chat to start the conversation.

## What Context is Generated

The AI receives:

### For All Actions
- Spec file path and project name
- Reference to testing rules file
- Test command to run the spec
- Related source file (if found)

### For "Fix" Action (Additional)
- Names of failing tests
- Error messages and stack traces
- Relevant console output
- Jest result details

## Auto-Generated Rules Files

On **first use**, the extension creates a testing rules file in your workspace.

**Important:** The rules file is only created once. Subsequent AI Assist calls will **skip** the copy to preserve any customizations you've made to the file.

### For Cursor
**Location:** `.cursor/rules/jest-testing.mdc`

This file is automatically included in Cursor AI context when you work with `.spec.ts` files. It contains:
- Jest best practices
- Angular testing patterns
- Common mistake warnings
- AAA pattern examples

### For GitHub Copilot
**Location:** `.github/copilot-instructions.md`

This file provides Copilot with the same testing guidelines in a compatible format.

## Updating Rules Files

Since rules files are preserved to allow customization, you must explicitly request an update to get the latest template.

To update:

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run: **ET Test Runner: Update Jest Testing Rules**

**Warning:** This overwrites the existing rules file, discarding any customizations you've made.

## Workflow Example

### Fixing a Failing Test

1. Run your tests - some fail
2. In ET Test Runner, find the failing spec
3. Right-click → **AI Assist** → **Fix Failing Tests** → **Cursor**
4. Paste into Cursor chat
5. AI analyzes the failures and suggests fixes
6. Apply the fixes
7. Run tests again to verify

### Writing New Tests

1. Select a spec with low coverage
2. Right-click → **AI Assist** → **Write New Tests** → **Cursor**
3. Paste into Cursor chat
4. AI suggests new test cases based on the source file
5. Review and accept the suggestions
6. Run tests to verify they pass

## Tips for Best Results

### Provide Context
- Run tests before using "Fix" so error details are available
- The extension extracts failure info from the most recent test run

### Use the Rules File
- The auto-generated rules file teaches the AI your project's patterns
- Customize it with project-specific conventions

### Iterate
- If the AI's first suggestion doesn't work, provide feedback
- Share the new error message for another iteration

### Check the Source File
- The extension tries to find the corresponding source file (e.g., `my.service.ts` for `my.service.spec.ts`)
- This helps the AI understand what to test

## Troubleshooting

### Context Not Copying

- Check clipboard permissions in your OS settings
- Try the action again

### Chat Panel Not Opening

- Manually open the chat panel:
  - **Cursor:** `Cmd+L` / `Ctrl+L`
  - **Copilot:** View → Chat
- Paste the context manually

### Rules File Not Created

- Check write permissions in your workspace
- Look for errors in: **View → Output → "ET Test Runner"**

### AI Gives Generic Advice

- Ensure you're using the "Fix" action when tests are failing
- Run tests first so failure details are captured
- The more context available, the better the AI's suggestions

## Context File Location

The extension also saves context to `.cursor/test-context.md` for reference. This file is overwritten each time you use AI Assist.

