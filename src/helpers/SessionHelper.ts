import * as vscode from "vscode";
import { ContextHelper } from "./ContextHelper";
export class SessionHelper {
  /**
   * Gets the current session or logs the user in to Linear if there is no session
   * Registers the login command if there is no session
   */
  public static async getSessionOrLogIn() {
    const session = await vscode.authentication.getSession(
      "linear", // Linear VS Code authentication provider ID
      ["read"], // OAuth scopes we're requesting
      { createIfNone: true }
    );
    ContextHelper.set("hasSession", session !== undefined);
    ContextHelper.set("hasCheckedSession", true);
    if (!session) {
      vscode.window.showErrorMessage(
        `We weren't able to log you into Linear, please try again.`
      );
      return;
    }
    return session;
  }

  /**
   * Logs the user out of Linear
   */
  public static async logout() {
    await vscode.commands.executeCommand("linear-connect.logout");
    ContextHelper.set("hasSession", false);
  }
}
