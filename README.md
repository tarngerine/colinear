# colinear README

Linear extension for Visual Studio Code.

## Features

- Show your Linear sidebar in Visual Studio Code
- See linked attachments (e.g. GitHub PRs, Figma designs, Slack conversations)...
- Check out branches from any Linear issue (shift + V then S in Linear)
- Detects current branch name and shows the issue
- Code action for comment lines with TODO, FIXME, HACK, etc. to create an issue
- Linkifies any Linear issue identifier like `LIN-12345` (cmd + click to open)

## Requirements

A Linear account 🫠, login via OAuth.

## Extension Settings

None yet, but some we might add:

- `linear.groupBy`: How to group issues in the sidebar.
- `linear.sortBy`: How to sort issues in the sidebar.

## Known Issues

- Loading is slow and waterfally, we need to sync the data separately from the tree view provider rendering process.
- No live sync, limited live polling due to the above.

## Release Notes

### 0.0.9

- Self dismissing toast for code action creating issue

### 0.0.8

- Improve team ranking for creating issues from code actions
- Assign created issues to yourself, and show a toast after creation
- Fix code formatting in the created issue description, add a few more lines of context

### 0.0.7

- Filter out issues that are complete
- Remove 'ISSUE' trigger word for code action that was causing false positives

### 0.0.6

- Improve the issue generated from code action to include GitHub permalink and more context

### 0.0.5

- Added code action to create an issue from any comment line with `TODO`, `FIXME`, `HACK`...
- Linkifies any Linear issue identifier like `LIN-12345` (cmd + click to open in linear)

### 0.0.4

- Reduce polling so only when window is focused
- Fix first time info showing every time

### 0.0.3

- Improve first time launch experience
- Long poll current branch every 5s to keep it up to date

### 0.0.2

Quick follow tweaks: hide command menu items, remove duplicate toasts when checking out branch.

### 0.0.1

Initial prototype
