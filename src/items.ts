import * as vscode from "vscode";
import { Attachment, User } from "@linear/sdk";
import {
  IssuePartial,
  ProjectPartial,
  ProjectMilestonePartial,
} from "./linear";

class BaseTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    id: string,
    collapsed?: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsed ?? vscode.TreeItemCollapsibleState.Collapsed);
    if (id) {
      this.id = id;
    }
  }
}

export class CurrentBranchTreeItem extends BaseTreeItem {
  constructor(public readonly branchName: string | undefined) {
    super(
      branchName ?? "Current issue",
      "current-branch",
      vscode.TreeItemCollapsibleState.Expanded
    );
    this.iconPath = new vscode.ThemeIcon("git-branch");
  }
  contextValue = "currentBranch";
}

export class MyIssuesTreeItem extends BaseTreeItem {
  constructor(public readonly viewer: User) {
    super("My issues", "my-issues", vscode.TreeItemCollapsibleState.Expanded);
    if (viewer.avatarUrl) {
      this.iconPath = vscode.Uri.parse(viewer.avatarUrl);
    }
  }
  contextValue = "myIssues";
}

export class IssueTreeItem extends BaseTreeItem {
  constructor(
    public readonly issue: IssuePartial,
    collapsed?: vscode.TreeItemCollapsibleState
  ) {
    super(issue.title, issue.id, collapsed);
    this.description = issue.identifier;
    if (issue.description) {
      this.tooltip = issue.description;
    }

    switch (issue.state.type) {
      case "completed": {
        this.iconPath = new vscode.ThemeIcon("circle-large-filled");
        break;
      }
      case "started": {
        this.iconPath = new vscode.ThemeIcon("color-mode");
        break;
      }
      case "canceled": {
        this.iconPath = new vscode.ThemeIcon("error");
        break;
      }
      default: {
        this.iconPath = new vscode.ThemeIcon("circle-large-outline");
        break;
      }
    }
  }
  contextValue = "issue";
}

export class AttachmentTreeItem extends BaseTreeItem {
  constructor(public readonly attachment: Attachment) {
    super(
      attachment.title,
      attachment.id,
      vscode.TreeItemCollapsibleState.None
    );
    this.description = attachment.sourceType;
    switch (attachment.sourceType) {
      case "github": {
        this.iconPath = new vscode.ThemeIcon("github");
        break;
      }
      case "figma": {
        this.iconPath = new vscode.ThemeIcon("symbol-color");
        break;
      }
      case "slack": {
        this.iconPath = new vscode.ThemeIcon("comment-discussion");
        break;
      }
      default: {
        this.iconPath = new vscode.ThemeIcon("file");
        break;
      }
    }
  }
  contextValue = "attachment";
}

export class ProjectIssuesTreeItem extends BaseTreeItem {
  constructor(public readonly project: ProjectPartial) {
    super(project.name, project.id);
    this.description = Math.round(project.progress * 100) + "%";
  }
  iconPath = new vscode.ThemeIcon("archive");
  contextValue = "project";
}

export class MilestoneTreeItem extends BaseTreeItem {
  constructor(public readonly milestone: ProjectMilestonePartial) {
    super(milestone.name, milestone.id);
    this.description = String(milestone.issues.nodes.length);
  }
  contextValue = "milestone";
}

export class NoMilestoneTreeItem extends BaseTreeItem {
  constructor(public readonly project: ProjectPartial) {
    super("No milestone", project.id + "-noMilestone");
  }
  contextValue = "noMilestone";
}

export class RefreshTreeItem extends vscode.TreeItem {
  constructor() {
    super("Refresh", vscode.TreeItemCollapsibleState.None);
  }
}
