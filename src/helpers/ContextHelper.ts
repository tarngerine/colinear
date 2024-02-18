import * as vscode from "vscode";

type ContextTypes = {
  hasCheckedSession: boolean;
  hasSession: boolean;
};

/**
 * Helps set Context Keys and values to use with `when` clauses
 */
export class ContextHelper {
  /**
   * Sets a context key to a value
   * @param key The context key to set, will be prefixed with "linear."
   * @param value The value to set the context key to
   *
   */
  public static set<T extends keyof ContextTypes, U extends ContextTypes[T]>(
    key: T,
    value: U
  ) {
    vscode.commands.executeCommand<U>("setContext", "linear." + key, value);
  }
}
