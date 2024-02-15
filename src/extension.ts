import * as vscode from "vscode";
import { LinearClient } from "@linear/sdk";
import { Git } from "./git";
import {
  AttachmentTreeItem,
  IssueTreeItem,
  ProjectIssuesTreeItem,
} from "./items";
import { ColinearTreeProvider } from "./tree";
import { Linear } from "./linear";

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "colinear" is now active!');

  (async () => {
    const session = await vscode.authentication.getSession(
      "linear", // Linear VS Code authentication provider ID
      ["read"], // OAuth scopes we're requesting
      { createIfNone: true }
    );

    if (!session) {
      vscode.window.showErrorMessage(
        `We weren't able to log you into Linear when trying to open the issue.`
      );
      return;
    }

    // We wrap the Linear SDK with our own class to add our own graphql queries
    const linearClient = new Linear(
      new LinearClient({
        accessToken: session.accessToken,
      })
    );

    // Create tree
    const provider = new ColinearTreeProvider(linearClient, context);
    vscode.window.registerTreeDataProvider("colinearTree", provider);

    // Create commands
    const disposables = [
      vscode.commands.registerCommand("colinear.refresh", async () => {
        provider.refresh();
      }),
      vscode.commands.registerCommand(
        "colinear.issue.checkout",
        async (issue: IssueTreeItem) => {
          if (!Git.isLoaded) {
            vscode.window.showErrorMessage(
              "vscode.git extension not loaded yet. Try again in a few seconds"
            );
            return;
          }
          await Git.checkout(issue.issue.branchName);
          provider.refresh();
        }
      ),
      vscode.commands.registerCommand(
        "colinear.issue.open",
        (issue: IssueTreeItem) => {
          vscode.env.openExternal(vscode.Uri.parse(issue.issue.url));
        }
      ),
      vscode.commands.registerCommand(
        "colinear.attachment.open",
        (attachment: AttachmentTreeItem) => {
          vscode.env.openExternal(vscode.Uri.parse(attachment.attachment.url));
        }
      ),
      vscode.commands.registerCommand(
        "colinear.project.open",
        (project: ProjectIssuesTreeItem) => {
          vscode.env.openExternal(vscode.Uri.parse(project.project.url));
        }
      ),
    ];
    disposables.forEach((disposable) => context.subscriptions.push(disposable));
  })();
}

// This method is called when your extension is deactivated
export function deactivate() {}
