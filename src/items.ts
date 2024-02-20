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
import { Git } from "./git";

export type ColinearTreeItem =
  | {
      /**
       * The unique identifier of the tree item, e.g. the model ID
       */
      uri: string;
      /**
       * The parent of the tree item
       */
      parent?: ColinearTreeItem;
    } & (
      | {
          type: "currentBranch";
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
    props: ColinearTreeItem,
    collapsed?: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsed ?? vscode.TreeItemCollapsibleState.Collapsed);
    this.id = getFullURI(props);
  }
}

/**
 * Recursively calls up parent tree items to build the full URI
 */
function getFullURI(item: ColinearTreeItem): string {
  return item.parent ? getFullURI(item.parent) + "/" + item.uri : item.uri;
}

export class CurrentBranchTreeItem extends BaseTreeItem {
  constructor(
    public readonly props: Extract<ColinearTreeItem, { type: "currentBranch" }>
  ) {
    super(
      Git.branchName ?? "Current branch",
      props,
      vscode.TreeItemCollapsibleState.Expanded
    );
    this.iconPath = new vscode.ThemeIcon("git-branch");
  }
  contextValue = "currentBranch";
}

export class MyIssuesTreeItem extends BaseTreeItem {
  constructor(
    public readonly props: Extract<ColinearTreeItem, { type: "myIssues" }>
  ) {
    const { viewer } = props;
    super("My issues", props, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = viewer.avatarUrl
      ? vscode.Uri.parse(viewer.avatarUrl)
      : new vscode.ThemeIcon("account");
  }
  contextValue = "myIssues";
}

export class IssueTreeItem extends BaseTreeItem {
  constructor(
    public readonly props: Extract<ColinearTreeItem, { type: "issue" }>
  ) {
    const { issue, parent } = props;
    const collapsed =
      issue.attachments.nodes.length === 0
        ? vscode.TreeItemCollapsibleState.None
        : parent?.type === "currentBranch"
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed;
    super(issue.title, props, collapsed);
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
  constructor(
    public readonly props: Extract<ColinearTreeItem, { type: "attachment" }>
  ) {
    const { attachment } = props;
    super(attachment.title, props, vscode.TreeItemCollapsibleState.None);
    this.description = attachment.sourceType;

    switch (attachment.sourceType) {
      case "github": {
        this.description = "GitHub";
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
      case "githubCommit": {
        this.iconPath = new vscode.ThemeIcon("git-commit");
        this.description = "GitHub";
        break;
      }
      case "figma": {
        this.description = "Figma";
        this.iconPath = new vscode.ThemeIcon("symbol-color");
        break;
      }
      case "slack": {
        this.description = "Slack";
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

export class ProjectTreeItem extends BaseTreeItem {
  constructor(
    public readonly props: Extract<ColinearTreeItem, { type: "project" }>
  ) {
    const { project } = props;
    super(project.name, props);
    this.description = Math.round(project.progress * 100) + "%";
  }
  iconPath = new vscode.ThemeIcon("archive");
  contextValue = "project";
}

export class MilestoneTreeItem extends BaseTreeItem {
  constructor(
    public readonly props: Extract<ColinearTreeItem, { type: "milestone" }>
  ) {
    const { milestone } = props;
    super(milestone.name, props);
    this.description = String(milestone.issues.nodes.length);
  }
  contextValue = "milestone";
}

export class NoMilestoneTreeItem extends BaseTreeItem {
  constructor(
    public readonly props: Extract<ColinearTreeItem, { type: "noMilestone" }>
  ) {
    super("No milestone", props);
  }
  contextValue = "noMilestone";
}

export class CycleTreeItem extends BaseTreeItem {
  constructor(
    public readonly props: Extract<ColinearTreeItem, { type: "cycle" }>
  ) {
    const { cycle } = props;
    super(cycle.name ?? String(cycle.number), props);
  }
  iconPath = new vscode.ThemeIcon("play-circle");
  contextValue = "cycle";
}

export class CustomViewTreeItem extends BaseTreeItem {
  constructor(
    public readonly props: Extract<ColinearTreeItem, { type: "customView" }>
  ) {
    const { customView } = props;
    super(customView.name, props);
  }
  iconPath = new vscode.ThemeIcon("list-filter");
  contextValue = "customView";
}

export class RoadmapTreeItem extends BaseTreeItem {
  constructor(
    public readonly props: Extract<ColinearTreeItem, { type: "roadmap" }>
  ) {
    const { roadmap } = props;
    super(roadmap.name, props);
  }
  iconPath = new vscode.ThemeIcon("milestone");
}

/**
 * Displays an icon on the right side of tree items
 * You must call `ItemDecorationProvider.setDecoration` to set the decoration from the tree item
 */
class DecorationProvider
  implements vscode.FileDecorationProvider, vscode.Disposable
{
  private _store: Map<string, vscode.FileDecoration> = new Map();
  /**
   * Set a decoration for a tree item
   * @param uri The URI of the tree item
   * @param decoration The decoration to set, can't be more than 1 character long if you use a string
   */
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
