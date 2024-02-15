import * as vscode from "vscode";
import { Attachment, User } from "@linear/sdk";
import {
  IssuePartial,
  ProjectPartial,
  ProjectMilestonePartial,
  CyclePartial,
  CustomViewPartial,
  RoadmapPartial,
} from "./linear";
import { DocumentHelper } from "./helpers/DocumentHelper";
import { Item } from "./items/Item";

export type ColinearTreeItem =
  | {
      parent?: ColinearTreeItem;
    } & (
      | {
          type: "currentBranch";
          branchName?: string;
        }
      | {
          type: "myIssues";
          viewer: User;
        }
      | {
          type: "issue";
          issue: IssuePartial;
        }
      | {
          type: "attachment";
          attachment: Attachment;
        }
      | {
          type: "project";
          project: ProjectPartial;
        }
      | {
          type: "milestone";
          milestone: ProjectMilestonePartial;
        }
      | {
          type: "noMilestone";
          project: ProjectPartial;
        }
      | {
          type: "favorites";
        }
      | {
          type: "cycle";
          cycle: CyclePartial;
        }
      | {
          type: "customView";
          customView: CustomViewPartial;
        }
      | {
          type: "roadmap";
          roadmap: RoadmapPartial;
        }
      | {
          type: "message";
          message: string;
        }
    );

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
    public readonly parent?: ColinearTreeItem,
    collapsed?: vscode.TreeItemCollapsibleState
  ) {
    const idPrefix =
      parent?.type === "milestone"
        ? parent.milestone.id
        : parent?.type === "cycle"
        ? parent.cycle.id
        : parent?.type === "currentBranch"
        ? "currentBranch"
        : "";
    super(issue.title, idPrefix + issue.id, collapsed);
    this.description = issue.identifier;
    this.tooltip =
      `${issue.title}` +
      "\n" +
      `${[issue.state.name, issue.assignee?.displayName]
        .filter(Boolean)
        .join(" · ")}`;

    if (issue.description) {
      this.tooltip +=
        "\n----------\n" + DocumentHelper.sanitizeMarkdown(issue.description);
    }

    const githubAttachment = issue.attachments.nodes.find(
      (attachment) => attachment.sourceType === "github"
    );
    const isBacklog = issue.state.name === "Backlog";
    const isInReview = githubAttachment?.metadata.status === "inReview";
    const isReadytoMerge = githubAttachment?.metadata.reviews?.find(
      (review: any) => review.state === "approved"
    );
    switch (issue.state.type) {
      case "completed": {
        this.iconPath = new vscode.ThemeIcon(
          "circle-large-filled",
          new vscode.ThemeColor("linear.issue.done")
        );
        break;
      }
      case "started": {
        this.iconPath = new vscode.ThemeIcon(
          "color-mode",
          new vscode.ThemeColor(
            isReadytoMerge
              ? "linear.issue.readyToMerge"
              : isInReview
              ? "linear.issue.inReview"
              : "linear.issue.inProgress"
          )
        );
        break;
      }
      case "canceled": {
        this.iconPath = new vscode.ThemeIcon("error");
        break;
      }
      default: {
        this.iconPath = new vscode.ThemeIcon(
          "circle-large-outline",
          isBacklog ? new vscode.ThemeColor("linear.issue.backlog") : undefined
        );
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
        this.resourceUri = vscode.Uri.parse(attachment.url);
        const isApproved =
          attachment.metadata.reviews &&
          attachment.metadata.reviews.length > 0 &&
          attachment.metadata.reviews.find(
            (review: any) => review.state === "approved"
          );
        const decoration: vscode.FileDecoration | undefined = (() => {
          const status = attachment.metadata.status;
          if (status === "merged") {
            return {
              badge: "🚀",
              tooltip: "Merged",
            };
          }
          if (isApproved) {
            return {
              badge: "✅",
              tooltip: "Approved",
            };
          }
          if (status === "inReview") {
            return {
              badge: "⏳",
              tooltip: "In review",
            };
          }
          if (status === "closed") {
            return {
              badge: "❌",
              tooltip: "Closed",
            };
          }
        })();
        if (decoration) {
          ItemDecorationProvider.setDecoration(this.resourceUri, {
            propagate: false,
            ...decoration,
          });
        }
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

export class CycleTreeItem extends BaseTreeItem {
  constructor(public readonly cycle: CyclePartial) {
    super(cycle.name ?? String(cycle.number), cycle.id);
  }
  iconPath = new vscode.ThemeIcon("play-circle");
  contextValue = "cycle";
}

export class CustomViewTreeItem extends BaseTreeItem {
  constructor(public readonly customView: CustomViewPartial) {
    super(customView.name, customView.id);
  }
  iconPath = new vscode.ThemeIcon("list-filter");
  contextValue = "customView";
}

export class RoadmapTreeItem extends BaseTreeItem {
  constructor(public readonly roadmap: RoadmapPartial) {
    super(roadmap.name, roadmap.id);
  }
  iconPath = new vscode.ThemeIcon("milestone");
}

export class RefreshTreeItem extends vscode.TreeItem {
  constructor() {
    super("Refresh", vscode.TreeItemCollapsibleState.None);
  }
}

class DecorationProvider
  implements vscode.FileDecorationProvider, vscode.Disposable
{
  private _store: Map<string, vscode.FileDecoration> = new Map();
  public setDecoration(uri: vscode.Uri, decoration: vscode.FileDecoration) {
    this._store.set(uri.path, decoration);
    this._onDidChangeFileDecorations.fire(uri);
  }

  provideFileDecoration(
    uri: vscode.Uri,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.FileDecoration> {
    if (this._store.has(uri.path)) {
      return this._store.get(uri.path);
    }
    return undefined;
  }

  _onDidChangeFileDecorations: vscode.EventEmitter<vscode.Uri | vscode.Uri[]> =
    new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
  onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[]> =
    this._onDidChangeFileDecorations.event;

  dispose() {
    this._store.clear();
  }
}

export const ItemDecorationProvider = new DecorationProvider();
