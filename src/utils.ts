/**
 * Masks the middle part of an API key, showing only the first and last 4 characters.
 * @param apiKey The API key to mask.
 * @param visibleChars The number of characters to show at the start and end of the API key.
 *
 * @returns The masked API key.
 */
export function maskApiKey(apiKey: string, visibleChars = 4): string {
  if (!apiKey || apiKey.length <= visibleChars * 2) {
    return apiKey; // No masking needed if the key is too short
  }

  const maskedPart = "*".repeat(apiKey.length - visibleChars * 2);
  const startVisible = apiKey.slice(0, visibleChars);
  const endVisible = apiKey.slice(-visibleChars);

  return `${startVisible}${maskedPart}${endVisible}`;
}

/**
 * Validate file patterns against file path
 * @param filePath The file path to check against the patterns.
 * @param patterns An array of glob patterns to match against the file path.
 *
 * Returns true if the file path matches any of the patterns, false otherwise.
 */
export function matchesFilePattern(
  filePath: string,
  patterns: string[]
): boolean {
  if (!patterns || patterns.length === 0) return true;

  return patterns.some((pattern) => {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, "\\.")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");

    const regex = new RegExp(`^${regexPattern}$`, "i");
    return regex.test(filePath);
  });
}

/**
 * Format file size in human readable format
 * @param bytes The size in bytes to format.
 *
 * Returns a string representing the size in B, KB, MB, or GB.
 */
export function formatFileSize(bytes: number): string {
  const sizes = ["B", "KB", "MB", "GB"];
  if (bytes === 0) return "0 B";

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
}

/**
 * Truncate text to specified length
 * @param text The text to truncate.
 * @param maxLength The maximum length of the text.
 *
 * Returns the truncated text, appending "..." if it exceeds maxLength.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Get relative time string
 * @param date The date to compare against the current time.
 *
 * Returns a string representing the time difference in a human-readable format.
 * For example, "just now", "5m ago", "2h ago"
 */
export function getRelativeTime(date: string | Date): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return target.toLocaleDateString();
}
