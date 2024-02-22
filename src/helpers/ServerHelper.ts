export class ServerHelper {
  private static INTERVAL_MS: number = 1000;

  /**
   * Create a long poll that will call the callback
   * @param callback The function to call every second
   * @returns A cleanup function to stop the long poll
   */
  public static createLongPoll(
    callback: () => void,
    timeout?: number
  ): { dispose: () => void } {
    const interval = setInterval(() => {
      callback();
    }, timeout ?? this.INTERVAL_MS);
    return {
      dispose() {
        clearInterval(interval);
      },
    };
  }
}
