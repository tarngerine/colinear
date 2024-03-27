import * as vscode from "vscode";
import { LinearClient, Team } from "@linear/sdk";
import { Git } from "./git";
import { ColinearTreeItem } from "./items";
import { ColinearTreeProvider } from "./tree";
import { Linear } from "./linear";
import { SessionHelper } from "./helpers/SessionHelper";
import { ServerHelper } from "./helpers/ServerHelper";
import { ContextHelper } from "./helpers/ContextHelper";
import { CreateIssueFromCommentCodeActionsProvider } from "./codeActions";
import { LinearLinkProvider } from "./documentLinkProvider";

export async function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "linear" is now active!');
  context.subscriptions.push(
    vscode.commands.registerCommand("colinear.login", async () => {
      const session = await SessionHelper.getSessionOrLogIn();
      if (!session) {
        vscode.window.showErrorMessage(
          `We weren't able to log you into Linear, please try again.`
        );
        return;
      }
      vscode.commands.executeCommand("colinearTree.focus");
      load(context, session);
    }),
    vscode.commands.registerCommand("colinear.reveal", async () => {
      vscode.commands.executeCommand("colinearTree.focus");
    })
  );
  if (firstTime(context)) {
    ContextHelper.set("shouldShowLogin", true);
    return;
  }
  const session = await SessionHelper.getSessionOrLogIn(false);
  if (session) {
    load(context, session);
  }
}

function firstTime(context: vscode.ExtensionContext) {
  const isFirstTime =
    context.globalState.get("linear.hasShownFirstTimeInfo") === undefined;
  if (isFirstTime) {
    vscode.window
      .showInformationMessage("Linear extension installed", "Log in")
      .then((selection) => {
        switch (selection) {
          case "Log in":
            vscode.commands.executeCommand("colinear.login");
            break;
        }
      });
    context.globalState.update("linear.hasShownFirstTimeInfo", true);
  }
  return isFirstTime;
}

async function load(
  context: vscode.ExtensionContext,
  session: vscode.AuthenticationSession
) {
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
      if (
        !vscode.window.state.focused ||
        Git.branchName === provider.lastKnownGitBranch
      ) {
        return;
      }
      provider.refresh(provider.root.currentBranch);
    }),
    /** Check less frequently if branch issue has updates (e.g. new PR is up)  */
    ServerHelper.createLongPoll(() => {
      if (!vscode.window.state.focused) {
        return;
      }
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
    ),
    vscode.commands.registerCommand(
      "colinear.issue.create",
      async (
        document: vscode.TextDocument,
        triggerWord: string,
        triggerWordWithSymbol: string,
        line: number,
        index: number
      ) => {
        // Create a github URL based on the document path
        const url = Git.baseRemoteUrl;
        const sha = Git.commitSha;
        const relativeFilePath = vscode.workspace.asRelativePath(document.uri);
        const linePermalink = `${url}/blob/${sha}/${relativeFilePath}#L${
          line + 1
        }`;

        // Get the line of text and parse out everything after the trigger word
        // to prefill as the title
        const text = document.lineAt(line).text;
        let title = text
          .slice(index + triggerWordWithSymbol.length)
          // any comment prefix and suffix across different languages: // /* */ # <!-- -->
          .replace(/(^\/\/|\/\*|\*\/|#|<!--|-->)/g, "")
          .trim();
        const teams = await linearClient.myTeams();
        if (!teams) {
          vscode.window.showErrorMessage(
            "Failed to fetch teams, please try again."
          );
          return;
        }

        // Show a quick input to the user
        const input = await vscode.window.showInputBox({
          prompt: "Issue title",
          value: title,
        });
        if (!input) {
          return;
        }
        // Show quick pick of teams
        const selectedTeam = await vscode.window.showQuickPick(
          teams.map((team) => ({
            label: team.name,
            detail: team.key,
            iconPath: new vscode.ThemeIcon("organization"),
          })),
          {
            placeHolder: "Select team",
          }
        );
        if (!selectedTeam) {
          return;
        }
        const team = teams.find((team) => team.key === selectedTeam.detail);
        if (!team) {
          return;
        }
        // Get the 5 lines of text following the line with the trigger word + 2 previous
        const linesOfCode = document.getText(
          new vscode.Range(
            new vscode.Position(line - 2, 0),
            new vscode.Position(line + 5, 0)
          )
        );

        vscode.window.showInformationMessage("Creating issue...");
        const result = await linearClient.linear.createIssue({
          title: input,
          description: `[${relativeFilePath}](${linePermalink})\n
\`\`\`
${linesOfCode}
\`\`\``,
          teamId: team.id,
          assigneeId: viewer.id,
        });

        const issue = await result.issue;
        if (!issue) {
          // show error toast
          vscode.window.showErrorMessage(
            "Failed to create issue, please try again."
          );
          return;
        }

        const identifier = issue.identifier;
        vscode.window
          .showInformationMessage(`Issue created: ${identifier}`, "Open")
          .then((selection) => {
            if (selection === "Open") {
              vscode.env.openExternal(vscode.Uri.parse(issue.url));
            }
          });
        const edit = new vscode.WorkspaceEdit();
        const position = new vscode.Position(line, index + triggerWord.length);
        edit.insert(document.uri, position, ` (${identifier})`);
        vscode.workspace.applyEdit(edit);
      }
    ),
    vscode.languages.registerCodeActionsProvider(
      "*",
      new CreateIssueFromCommentCodeActionsProvider(),
      {
        providedCodeActionKinds:
          CreateIssueFromCommentCodeActionsProvider.providedCodeActionKinds,
      }
    ),
    vscode.languages.registerDocumentLinkProvider("*", new LinearLinkProvider())
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
