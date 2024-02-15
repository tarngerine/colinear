export class DocumentHelper {
  /**
   * Removes unhelpful markdown from a string, like images and links, preserving the underlying text.
   * Images are replaced with their alt text, if available, e.g. [image] or [image: alt text goes here]
   * Links are replaced with their display text, if available, e.g. [link text goes here]
   */
  public static sanitizeMarkdown(markdown: string): string {
    return markdown
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "[image]")
      .replace(/\[[^\]]*\]\([^)]*\)/g, (match) => {
        const linkText = match.match(/\[([^\]]*)\]/)?.[1];
        return linkText ? `[${linkText}]` : match;
      });
  }
}
