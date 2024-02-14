import * as vscode from "vscode";
import { Attachment, User } from "@linear/sdk";
import {
  AttachmentTreeItem,
  CurrentBranchTreeItem,
  IssueTreeItem,
  MilestoneTreeItem,
  MyIssuesTreeItem,
  NoMilestoneTreeItem,
  ProjectIssuesTreeItem,
} from "./items";
import { Git } from "./git";
import {
  IssuePartial,
  Linear,
  ProjectMilestonePartial,
  ProjectPartial,
} from "./linear";

type ColinearTreeItem = {
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
      type: "message";
      message: string;
    }
);

export class ColinearTreeProvider
  implements vscode.TreeDataProvider<ColinearTreeItem>
{
  constructor(
    private linear: Linear,
    private context: vscode.ExtensionContext
  ) {}

  getTreeItem(element: ColinearTreeItem): vscode.TreeItem {
    switch (element.type) {
      case "currentBranch":
        return new CurrentBranchTreeItem(element.branchName);
      case "myIssues":
        return new MyIssuesTreeItem(element.viewer);
      case "issue":
        return new IssueTreeItem(
          element.issue,
          element.issue.attachments.nodes.length === 0
            ? vscode.TreeItemCollapsibleState.None
            : element.parent?.type === "currentBranch"
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.Collapsed
        );
      case "attachment":
        return new AttachmentTreeItem(element.attachment);
      case "project":
        return new ProjectIssuesTreeItem(element.project);
      case "milestone":
        return new MilestoneTreeItem(element.milestone);
      case "noMilestone":
        return new NoMilestoneTreeItem(element.project);
      case "favorites":
        return new vscode.TreeItem(
          "Favorites",
          vscode.TreeItemCollapsibleState.Expanded
        );
      case "message":
        return new vscode.TreeItem(
          element.message,
          vscode.TreeItemCollapsibleState.None
        );
    }
  }

  async getChildren(element?: ColinearTreeItem): Promise<ColinearTreeItem[]> {
    if (!this.linear) {
      vscode.window.showInformationMessage("Not logged in to Linear");
      return [];
    }

    // Root
    if (!element) {
      return [
        {
          type: "currentBranch",
          branchName: Git.branchName,
        },
        {
          type: "myIssues",
          viewer: await this.linear.viewer(),
        },
        { type: "favorites" },
      ];
    }

    if (element) {
      switch (element.type) {
        case "currentBranch": {
          if (!Git.branchName) {
            // Wait for the branch name to be available
            setTimeout(() => {
              console.log("refreshing");
              this.refresh(element);
            }, 1000);
            return [
              {
                type: "message",
                message: "Loading current branch...",
                parent: element,
              },
            ];
          }
          return this.linear.branchIssue(Git.branchName).then(async (issue) => {
            if (!issue) {
              return [
                {
                  type: "message",
                  message: "No matching Linear issue for branch",
                  parent: element,
                },
              ];
            }
            return [
              {
                type: "issue",
                issue,
                parent: element,
              },
            ];
          });
        }
        case "myIssues": {
          return this.linear.myIssues().then((issues) =>
            issues
              ? issues.map((issue) => ({
                  type: "issue",
                  issue,
                  parent: element,
                }))
              : []
          );
        }
        case "favorites": {
          return this.linear.favorites().then((favorites) =>
            favorites
              ? favorites
                  .map((favorite): ColinearTreeItem | undefined => {
                    switch (favorite.type) {
                      case "issue": {
                        return {
                          type: "issue",
                          issue: favorite.issue!,
                          parent: element,
                        };
                      }
                      case "project": {
                        return {
                          type: "project",
                          project: favorite.project!,
                          parent: element,
                        };
                      }
                      default: {
                        return undefined;
                      }
                    }
                  })
                  .filter((item): item is ColinearTreeItem => Boolean(item))
              : []
          );
        }
        case "issue": {
          const attachments = element.issue.attachments.nodes.map(
            (attachment) =>
              ({
                type: "attachment",
                attachment,
                parent: element,
              } as ColinearTreeItem)
          );
          return [...attachments];
        }
        case "project": {
          const milestones = (
            await Promise.all(
              element.project.projectMilestones.nodes.map((milestone) =>
                this.linear.milestone(milestone.id)
              )
            )
          )
            .filter((milestone): milestone is ProjectMilestonePartial =>
              Boolean(milestone)
            )
            .sort((a, b) => a.sortOrder - b.sortOrder);
          return [
            ...milestones.map(
              (milestone) =>
                ({
                  type: "milestone",
                  milestone,
                  parent: element,
                } as ColinearTreeItem)
            ),
            {
              type: "noMilestone",
              project: element.project,
              parent: element,
            },
          ];
        }
        case "milestone": {
          return element.milestone.issues.nodes.map((issue) => ({
            type: "issue",
            issue,
            parent: element,
          }));
        }
        case "noMilestone": {
          const issues = await this.linear.noMilestoneIssues(
            element.project.id
          );
          return issues
            ? issues.map((issue) => ({
                type: "issue",
                issue,
                parent: element,
              }))
            : [];
        }
      }
    }
    return [];
  }

  private _onDidChangeTreeData: vscode.EventEmitter<
    ColinearTreeItem | undefined | null | void
  > = new vscode.EventEmitter<ColinearTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    ColinearTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  refresh(item?: ColinearTreeItem): void {
    this._onDidChangeTreeData.fire(item);
  }
}
