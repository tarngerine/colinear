import * as vscode from "vscode";
import { LinearClient } from "@linear/sdk";
import { Git } from "./git";
import { ColinearTreeItem } from "./items";
import { ColinearTreeProvider } from "./tree";
import { Linear } from "./linear";
import { SessionHelper } from "./helpers/SessionHelper";
import { ServerHelper } from "./helpers/ServerHelper";

export async function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "linear" is now active!');
  context.subscriptions.push(
    vscode.commands.registerCommand("colinear.login", async () => {
      load(context);
    })
  );
  load(context);
}

async function load(context: vscode.ExtensionContext) {
  const session = await SessionHelper.getSessionOrLogIn();

  if (!session) {
    return;
  }

  // We wrap the Linear SDK with our own class to add our own graphql queries
  const linearClient = new Linear(
    new LinearClient({
      accessToken: session.accessToken,
    })
  );

  // TODO: populate/store initial cache for my issues, favorites, current branch and call refresh so the tree can render immediately
  const viewer = await linearClient.viewer();
  const provider = new ColinearTreeProvider(linearClient, viewer, context);
  const tree = vscode.window.createTreeView("colinearTree", {
    treeDataProvider: provider,
  });
  const treeDisposable = {
    dispose: () => {
      tree.dispose();
      provider.dispose();
    },
  };

  context.subscriptions.push(
    treeDisposable,
    /** Constantly check if branch has changed via a git client */
    ServerHelper.createLongPoll(() => {
      if (Git.branchName === provider.lastKnownGitBranch) {
        return;
      }
      provider.refresh(provider.root.currentBranch);
    }),
    /** Check less frequently if branch issue has updates (e.g. new PR is up)  */
    ServerHelper.createLongPoll(() => {
      provider.refresh(provider.root.currentBranch);
    }, 5000),
    vscode.commands.registerCommand("colinear.logout", async () => {
      await SessionHelper.logout();
      treeDisposable.dispose();
    }),
    vscode.commands.registerCommand(
      "colinear.issue.checkout",
      async (item: Extract<ColinearTreeItem, { type: "issue" }>) => {
        if (!Git.isLoaded) {
          vscode.window.showErrorMessage(
            "vscode.git extension not loaded yet. Try again in a few seconds"
          );
          return;
        }
        await Git.checkout(item.issue.branchName);
        provider.refresh();
      }
    ),
    vscode.window.registerUriHandler({
      handleUri: async (uri) => {
        switch (true) {
          // vscode://tlshp.colinear/checkout/branch/name
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
      (item: Extract<ColinearTreeItem, { type: "issue" }>) => {
        vscode.env.openExternal(vscode.Uri.parse(item.issue.url));
      }
    ),
    vscode.commands.registerCommand(
      "colinear.attachment.open",
      (item: Extract<ColinearTreeItem, { type: "attachment" }>) => {
        vscode.env.openExternal(vscode.Uri.parse(item.attachment.url));
      }
    ),
    vscode.commands.registerCommand(
      "colinear.project.open",
      (item: Extract<ColinearTreeItem, { type: "project" }>) => {
        vscode.env.openExternal(vscode.Uri.parse(item.project.url));
      }
    )
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
