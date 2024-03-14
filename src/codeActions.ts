import * as vscode from "vscode";
/**
 * Code actions that detect TODO/FIXME comment trigger words and creates Linear issues
 */
export class CreateIssueFromCommentCodeActionsProvider
  implements vscode.CodeActionProvider
{
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    const trigger = this.applicableCommentTrigger(document, range.start.line);
    if (!trigger) {
      return;
    }
    const [triggerWord, line, index] = trigger;
    const action = new vscode.CodeAction(
      "Create Linear issue from comment",
      vscode.CodeActionKind.QuickFix
    );
    action.command = {
      command: "colinear.issue.create",
      title: "Create Linear issue",
      arguments: [document, triggerWord, line, index],
    };
    return [action];
  }

  /**
   * Returns the trigger word, the line it's in, and the index in the line
   */
  private applicableCommentTrigger(
    document: vscode.TextDocument,
    line: number
  ): [string, number, number] | undefined {
    const text = document.lineAt(line).text;
    const triggers = ["TODO", "FIXME", "BUG", "HACK", "ISSUE"];
    for (const trigger of triggers) {
      if (text.includes(trigger)) {
        const index = text.indexOf(trigger);
        return [trigger, line, index];
      }
    }
  }
}
