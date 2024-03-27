import * as vscode from "vscode";

export const linearIssueIdentifierRegex = /([A-Z]{2,4}-\d{1,5})/g;
export class LinearLinkProvider implements vscode.DocumentLinkProvider {
  provideDocumentLinks(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DocumentLink[]> {
    // Regex that matches something like LIN-12345 where there are 2-4 alphabets, followed by a hyphen, followed by 1-5 digits

    // Find every instance of the issue regex in the document
    const links = [];
    let match;
    while (
      (match = linearIssueIdentifierRegex.exec(document.getText())) !== null
    ) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const link = new vscode.DocumentLink(
        new vscode.Range(startPos, endPos),
        vscode.Uri.parse(`https://linear.app/issue/${match[0]}`)
      );
      links.push(link);
    }
    return links;
  }
}
