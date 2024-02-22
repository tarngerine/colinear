import * as vscode from "vscode";
import { ContextHelper } from "./ContextHelper";
export class SessionHelper {
  /**
   * Gets the current session or logs the user in to Linear if there is no session
   * Registers the login command if there is no session
   * @param loginIfNone If true, will log the user in if there is no session
   */
  public static async getSessionOrLogIn(loginIfNone = true) {
    const session = await vscode.authentication.getSession(
      "linear", // Linear VS Code authentication provider ID
      ["read"], // OAuth scopes we're requesting
      { createIfNone: loginIfNone }
    );
    ContextHelper.set("hasSession", session !== undefined);
    ContextHelper.set("shouldShowLogin", true);
    return session;
  }

  /**
   * Logs the user out of Linear
   */
  public static async logout() {
    // TODO: this will log out all other extensions depending on linear-connect too
    // we should add a param to pass in the session to log out?
    // but ideally we create a new auth provider with our own clientID so that
    // we can render it differently in linear's authorized app list
    // although maybe the even better way is for that to support showing the extension id
    await vscode.commands.executeCommand("linear-connect.logout");
    ContextHelper.set("hasSession", false);
  }
}
