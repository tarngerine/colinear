import * as vscode from "vscode";
import {
  AttachmentTreeItem,
  ColinearTreeItem,
  CurrentBranchTreeItem,
  ItemDecorationProvider,
  IssueTreeItem,
  MilestoneTreeItem,
  MyIssuesTreeItem,
  NoMilestoneTreeItem,
  ProjectIssuesTreeItem,
  CycleTreeItem,
  CustomViewTreeItem,
  RoadmapTreeItem,
} from "./items";
import { Git } from "./git";
import {
  IssuePartial,
  Linear,
  ProjectMilestonePartial,
  ProjectPartial,
} from "./linear";

export class ColinearTreeProvider
  implements vscode.TreeDataProvider<ColinearTreeItem>, vscode.Disposable
{
  constructor(
    private linear: Linear,
    private context: vscode.ExtensionContext
  ) {
    this._disposables.push(
      vscode.window.registerFileDecorationProvider(ItemDecorationProvider)
    );
  }

  getTreeItem(element: ColinearTreeItem): vscode.TreeItem {
    switch (element.type) {
      case "currentBranch":
        return new CurrentBranchTreeItem(element.branchName);
      case "myIssues":
        return new MyIssuesTreeItem(element.viewer);
      case "issue":
        return new IssueTreeItem(
          element.issue,
          element.parent,
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
      case "cycle":
        return new CycleTreeItem(element.cycle);
      case "customView":
        return new CustomViewTreeItem(element.customView);
      case "roadmap":
        return new RoadmapTreeItem(element.roadmap);
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
      console.log("ROOT");
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
          return this.linear
            .myIssues()
            .then((issues) => computeIssueList(issues, element));
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
                      case "predefinedView": {
                        switch (favorite.predefinedViewType) {
                          case "activeCycle": {
                            const cycle =
                              favorite.predefinedViewTeam!.activeCycle;
                            return {
                              type: "cycle",
                              cycle,
                              parent: element,
                            };
                          }
                        }
                        return undefined;
                      }
                      case "customView": {
                        return {
                          type: "customView",
                          customView: favorite.customView!,
                          parent: element,
                        };
                      }
                      case "cycle": {
                        return {
                          type: "cycle",
                          cycle: favorite.cycle!,
                          parent: element,
                        };
                      }
                      case "roadmap": {
                        return {
                          type: "roadmap",
                          roadmap: favorite.roadmap!,
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
          const issues = element.milestone.issues.nodes;
          return computeIssueList(issues, element);
        }
        case "noMilestone": {
          const issues = await this.linear.noMilestoneIssues(
            element.project.id
          );
          return computeIssueList(issues, element);
        }
        case "cycle": {
          const issues = await this.linear.cycleIssues(element.cycle.id);
          return computeIssueList(issues, element);
        }
        case "customView": {
          const type = element.customView.modelName.toLowerCase();
          switch (type) {
            case "issue": {
              const issues = await this.linear.customViewIssues(
                element.customView.id
              );
              return computeIssueList(issues, element);
            }
            case "project": {
              // LIN-18880
              return [
                {
                  type: "message",
                  message: "Custom view for projects not supported yet",
                  parent: element,
                },
              ];
            }
          }
          break;
        }
        case "roadmap": {
          element.type;
          const projects = await this.linear.roadmapProjects(
            element.roadmap.id
          );
          return computeProjectList(projects, element);
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

  private _disposables: vscode.Disposable[] = [];
  dispose() {
    this._disposables.forEach((dispose) => dispose.dispose());
  }
}

function computeIssueList(
  issues: IssuePartial[] | undefined,
  parent: ColinearTreeItem
): ColinearTreeItem[] {
  if (!issues || issues.length === 0) {
    return [
      {
        type: "message",
        message: "No issues",
        parent,
      },
    ];
  }
  return issues
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((issue) => ({
      type: "issue",
      issue,
      parent,
    }));
}
function computeProjectList(
  projects: ProjectPartial[] | undefined,
  parent: ColinearTreeItem
): ColinearTreeItem[] {
  if (!projects || projects.length === 0) {
    return [
      {
        type: "message",
        message: "No projects",
        parent,
      },
    ];
  }
  return projects
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((project) => ({
      type: "project",
      project,
      parent,
    }));
}
