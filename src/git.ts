import * as vscode from "vscode";
import { GitExtension } from "./types.d/git";

// Uses the built-in vscode.git extension to manage git
export class Git {
  public static get extension(): vscode.Extension<GitExtension> | undefined {
    return vscode.extensions.getExtension<GitExtension>("vscode.git");
  }
  public static get isLoaded(): boolean {
    return this.extension !== undefined;
  }
  public static get branchName(): string | undefined {
    if (!this.isLoaded) {
      return;
    }
    const git = this.extension?.exports?.getAPI(1);
    const branchName = git?.repositories[0]?.state.HEAD?.name;
    return branchName;
  }
  public static async checkout(branchName: string) {
    if (!this.isLoaded) {
      vscode.window.showErrorMessage(
        "vscode.git extension not loaded yet. Try again in a few seconds"
      );
      return;
    }
    const git = this.extension?.exports?.getAPI(1);
    try {
      const existingBranch = await git?.repositories[0]?.getBranch(branchName);
      await git?.repositories[0]?.checkout(branchName);
      vscode.window.showInformationMessage(
        `Checking out existing branch ${existingBranch?.name}`
      );
    } catch (e) {
      vscode.window.showInformationMessage(`Creating new branch ${branchName}`);
      await git?.repositories[0]?.createBranch(branchName, true);
      vscode.window.showInformationMessage(
        `Created and checked out ${Git.branchName}`
      );
    }
  }
}
