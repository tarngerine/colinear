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
  ProjectTreeItem,
  CycleTreeItem,
  CustomViewTreeItem,
  RoadmapTreeItem,
  FavoriteFolderTreeItem,
  FavoritesTreeItem,
} from "./items";
import { Git } from "./git";
import {
  FavoritePartial,
  IssuePartial,
  Linear,
  ProjectMilestonePartial,
  ProjectPartial,
} from "./linear";
import { User } from "@linear/sdk";

export class ColinearTreeProvider
  implements vscode.TreeDataProvider<ColinearTreeItem>, vscode.Disposable
{
  public lastKnownGitBranch: string | undefined;
  constructor(
    private linear: Linear,
    private readonly viewer: User,
    private context: vscode.ExtensionContext
  ) {
    this._disposables.push(
      vscode.window.registerFileDecorationProvider(ItemDecorationProvider),
      vscode.commands.registerCommand("colinear.refresh", async () => {
        this.refresh();
      })
    );
  }

  getTreeItem(element: ColinearTreeItem): vscode.TreeItem {
    switch (element.type) {
      case "currentBranch":
        return new CurrentBranchTreeItem(element);
      case "myIssues":
        return new MyIssuesTreeItem(element);
      case "issue":
        return new IssueTreeItem(element);
      case "attachment":
        return new AttachmentTreeItem(element);
      case "project":
        return new ProjectTreeItem(element);
      case "milestone":
        return new MilestoneTreeItem(element);
      case "noMilestone":
        return new NoMilestoneTreeItem(element);
      case "favorites":
        return new FavoritesTreeItem(element);
      case "favoriteFolder":
        return new FavoriteFolderTreeItem(element);
      case "cycle":
        return new CycleTreeItem(element);
      case "customView":
        return new CustomViewTreeItem(element);
      case "roadmap":
        return new RoadmapTreeItem(element);
      case "message":
        return new vscode.TreeItem(
          element.message,
          vscode.TreeItemCollapsibleState.None
        );
    }
  }

  /**
   * Items for the root of the tree
   * Defined here so that they can be referenced externally for targeted refreshing
   */
  public root: Record<"currentBranch" | "favorites", ColinearTreeItem> = {
    currentBranch: {
      type: "currentBranch",
      uri: "currentBranch",
    },
    favorites: { type: "favorites", uri: "favorites" },
  };

  async getChildren(element?: ColinearTreeItem): Promise<ColinearTreeItem[]> {
    console.log("getChildren", element);
    // Root
    if (!element) {
      return [
        this.root.currentBranch,
        {
          type: "myIssues",
          uri: "myIssues",
          viewer: this.viewer,
        },
        this.root.favorites,
      ];
    }

    if (element) {
      switch (element.type) {
        case "currentBranch": {
          if (!Git.branchName) {
            // Wait for the vscode.git extension to be available, should be in 1s
            setTimeout(() => {
              console.log("refreshing");
              this.refresh(element);
            }, 1000);
            return [
              {
                type: "message",
                uri: "loadingCurrentBranch",
                message: "Loading current branch...",
                parent: element,
              },
            ];
          }
          this.lastKnownGitBranch = Git.branchName;
          return this.linear.branchIssue(Git.branchName).then(async (issue) => {
            if (!issue) {
              return [
                {
                  type: "message",
                  uri: "noMatchingIssue",
                  message: "No matching Linear issue for branch",
                  parent: element,
                },
              ];
            }
            return [
              {
                type: "issue",
                issue,
                uri: issue.id,
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
          return this.linear
            .favorites()
            .then((favorites) =>
              favorites ? computeFavoritesList(favorites, element) : []
            );
        }
        case "favoriteFolder": {
          return computeFavoritesList(element.children, element);
        }
        case "issue": {
          const attachments = element.issue.attachments.nodes.map(
            (attachment) =>
              ({
                type: "attachment",
                attachment,
                parent: element,
                uri: attachment.id,
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
                  uri: milestone.id,
                  parent: element,
                } as ColinearTreeItem)
            ),
            {
              type: "noMilestone",
              project: element.project,
              parent: element,
              uri: "noMilestone",
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
                  uri: "customViewProjectsNotSupported",
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
        uri: "noIssues",
      },
    ];
  }
  return issues
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((issue) => ({
      type: "issue",
      issue,
      parent,
      uri: issue.id,
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
        uri: "noProjects",
      },
    ];
  }
  return projects
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((project) => ({
      type: "project",
      project,
      parent,
      uri: project.id,
    }));
}

/**
 * Generates a list of tree items for the immediate level, if an item has a parent, it's not included
 * It will be included via the `folder` favorite that contains it
 * @param favorites The favorites to generate tree items for
 * @param element The parent tree item
 */
function computeFavoritesList(
  favorites: FavoritePartial[],
  element: ColinearTreeItem
): ColinearTreeItem[] {
  return favorites
    .map((favorite): ColinearTreeItem | undefined => {
      // If the favorite has a parent, it's not included in this level, but will be included in the `folder` item it belongs to
      if (favorite.parent) {
        return undefined;
      }
      switch (favorite.type) {
        case "issue": {
          return {
            type: "issue",
            issue: favorite.issue!,
            uri: favorite.issue!.id,
            parent: element,
          };
        }
        case "project": {
          return {
            type: "project",
            project: favorite.project!,
            uri: favorite.project!.id,
            parent: element,
          };
        }
        case "predefinedView": {
          switch (favorite.predefinedViewType) {
            case "activeCycle": {
              const cycle = favorite.predefinedViewTeam!.activeCycle;
              return {
                type: "cycle",
                cycle,
                uri: cycle.id,
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
            uri: favorite.customView!.id,
            parent: element,
          };
        }
        case "cycle": {
          return {
            type: "cycle",
            cycle: favorite.cycle!,
            uri: favorite.cycle!.id,
            parent: element,
          };
        }
        case "roadmap": {
          return {
            type: "roadmap",
            roadmap: favorite.roadmap!,
            uri: favorite.roadmap!.id,
            parent: element,
          };
        }
        case "folder": {
          return {
            type: "favoriteFolder",
            uri: favorite.id,
            name: favorite.folderName!,
            children: favorites
              .filter((fav) => fav.parent?.id === favorite.id)
              // Unset the parent so that in the next pass it will be rendered
              .map((fav) => ({ ...fav, parent: undefined })),
            parent: element,
          };
        }
        default: {
          return undefined;
        }
      }
    })
    .filter((item): item is ColinearTreeItem => Boolean(item));
}
