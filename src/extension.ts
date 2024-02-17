import * as vscode from "vscode";
import { LinearClient } from "@linear/sdk";
import { Git } from "./git";
import { AttachmentTreeItem, IssueTreeItem, ProjectTreeItem } from "./items";
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
          await Git.checkout(issue.props.issue.branchName);
          provider.refresh();
        }
      ),
      vscode.window.registerUriHandler({
        handleUri: async (uri) => {
          switch (true) {
            // vscode://Linear.linear/checkout/branch/name
            case uri.path.startsWith("/checkout"): {
              const branchName = uri.path.split("/").slice(2).join("/");
              await Git.checkout(branchName);
              provider.refresh(provider.root.currentBranch);
            }
          }
        },
      }),
      vscode.commands.registerCommand(
        "colinear.issue.open",
        (issue: IssueTreeItem) => {
          vscode.env.openExternal(vscode.Uri.parse(issue.props.issue.url));
        }
      ),
      vscode.commands.registerCommand(
        "colinear.attachment.open",
        (attachment: AttachmentTreeItem) => {
          vscode.env.openExternal(
            vscode.Uri.parse(attachment.props.attachment.url)
          );
        }
      ),
      vscode.commands.registerCommand(
        "colinear.project.open",
        (project: ProjectTreeItem) => {
          vscode.env.openExternal(vscode.Uri.parse(project.props.project.url));
        }
      ),
    ];
    disposables.forEach((disposable) => context.subscriptions.push(disposable));
  })();
}

// This method is called when your extension is deactivated
export function deactivate() {}
