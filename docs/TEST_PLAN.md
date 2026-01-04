# ET Test Runner - Test Plan

This document provides a step-by-step verification plan to confirm the ET Test Runner extension is installed and working correctly.

## Pre-flight Checklist

Before testing, verify:

- [ ] Node.js 18+ is installed (`node -v`)
- [ ] VS Code or Cursor is installed
- [ ] You have an Nx workspace with Jest tests available
- [ ] Git is installed and configured

## Test Execution

### Test 1: Installation

**Objective:** Verify the install script completes successfully

**Steps:**
1. Open a terminal
2. Navigate to the extension folder: `cd <path-to>/et-test-runner-vscode`
3. Run: `./scripts/install.sh`

**Expected Results:**
- [ ] Script shows "Node.js v18.x.x" (or higher)
- [ ] Dependencies install without errors
- [ ] Build completes without errors
- [ ] Symlink is created (message shows path to extensions folder)
- [ ] "Installation Complete!" message appears

**Pass Criteria:** All checkboxes above are satisfied

---

### Test 2: Extension Activation

**Objective:** Verify the extension loads in the IDE

**Steps:**
1. Completely quit VS Code/Cursor
2. Reopen VS Code/Cursor
3. Open an Nx workspace (folder containing `nx.json`)
4. Look at the Activity Bar (left sidebar)

**Expected Results:**
- [ ] ET Test Runner icon appears in the Activity Bar
- [ ] Clicking the icon opens the extension panel
- [ ] No error messages appear in the Output panel

**Pass Criteria:** Extension icon is visible and panel opens without errors

---

### Test 3: Project Discovery

**Objective:** Verify projects are detected and displayed

**Steps:**
1. With Nx workspace open, click the ET Test Runner icon
2. Wait for the workspace to load (may show a loading spinner)
3. Observe the Projects pane

**Expected Results:**
- [ ] Projects with Jest tests are listed
- [ ] Each project shows spec count or status
- [ ] No "No projects found" error

**Pass Criteria:** At least one project is displayed

---

### Test 4: Spec File Display

**Objective:** Verify spec files are shown for a project

**Steps:**
1. Click on a project in the Projects pane
2. Observe the Specs pane

**Expected Results:**
- [ ] Spec files for the selected project are listed
- [ ] Changed specs (vs base branch) may be highlighted
- [ ] Spec file paths are displayed correctly

**Pass Criteria:** Spec files are visible for the selected project

---

### Test 5: Run a Single Test

**Objective:** Verify tests can be executed

**Steps:**
1. Select a spec file in the Specs pane
2. Run the test (click run button or use `Cmd+R` / `Ctrl+R`)
3. Observe the Output pane

**Expected Results:**
- [ ] Test execution begins (loading indicator shown)
- [ ] Output pane shows Jest output
- [ ] Test completes with pass/fail result
- [ ] Logs pane shows execution details

**Pass Criteria:** Test runs and produces output

---

### Test 6: Keyboard Shortcuts

**Objective:** Verify keyboard shortcuts work

**Steps:**
1. Focus the extension panel
2. Press `Cmd+E` / `Ctrl+E` to refresh
3. Select a spec, press `Cmd+R` / `Ctrl+R` to run
4. Press `` ` `` (backtick) to toggle logs

**Expected Results:**
- [ ] `Cmd+E` / `Ctrl+E` refreshes the workspace
- [ ] `Cmd+R` / `Ctrl+R` runs the selected test
- [ ] Backtick toggles the logs panel visibility

**Pass Criteria:** All shortcuts trigger the expected action

---

### Test 7: Cancel Running Test

**Objective:** Verify test cancellation works

**Steps:**
1. Start a test run on a project with many specs
2. While running, press `Cmd+X` / `Ctrl+X` or click the stop button

**Expected Results:**
- [ ] Test execution stops
- [ ] UI returns to ready state
- [ ] No orphan processes remain

**Pass Criteria:** Test is cancelled and UI is responsive

---

### Test 8: View Logs

**Objective:** Verify logging works

**Steps:**
1. Open Output panel: **View → Output**
2. Select "ET Test Runner" from the dropdown
3. Perform actions (refresh, run tests, etc.)

**Expected Results:**
- [ ] Log entries appear for actions
- [ ] Errors are logged with details
- [ ] Timestamps are shown

**Pass Criteria:** Logs are visible and informative

---

## Test Summary

| Test | Description | Status |
|------|-------------|--------|
| 1 | Installation | ⬜ |
| 2 | Extension Activation | ⬜ |
| 3 | Project Discovery | ⬜ |
| 4 | Spec File Display | ⬜ |
| 5 | Run a Single Test | ⬜ |
| 6 | Keyboard Shortcuts | ⬜ |
| 7 | Cancel Running Test | ⬜ |
| 8 | View Logs | ⬜ |

**Legend:** ⬜ Not tested | ✅ Passed | ❌ Failed

## Troubleshooting Failed Tests

### Test 1 Fails (Installation)
- Check Node.js version: `node -v`
- Ensure you have write permissions to extensions folder
- Check for npm errors in the output

### Test 2 Fails (Activation)
- Verify symlink exists: `ls -la ~/.cursor/extensions/ | grep et-test-runner`
- Check that `nx.json` exists in workspace root
- Look for errors in: **View → Output → "ET Test Runner"**

### Test 3 Fails (Project Discovery)
- Ensure projects have Jest configured
- Try clicking the refresh button
- Check Output panel for errors

### Test 5 Fails (Run Tests)
- Verify Nx CLI works: `npx nx --version`
- Ensure Jest is configured for the project
- Check terminal output for command errors

## Notes

- Tests should be run in order, as later tests depend on earlier ones
- If a test fails, fix the issue before proceeding
- Record any unexpected behavior for bug reports

