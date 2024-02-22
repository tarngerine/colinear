# colinear README

Linear extension for Visual Studio Code.

## Features

- Show your Linear sidebar in Visual Studio Code
- See linked attachments (e.g. GitHub PRs, Figma designs, Slack conversations)...
- Check out branches from any Linear issue (shift + V then S in Linear)
- Detects current branch name and shows the issue

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

### 0.0.2

Quick follow tweaks: hide command menu items, remove duplicate toasts when checking out branch.

### 0.0.1

Initial prototype
