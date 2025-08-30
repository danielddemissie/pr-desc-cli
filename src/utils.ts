export function maskApiKey(apiKey: string, visibleChars = 4): string {
  if (apiKey.length <= visibleChars * 2) {
    return apiKey;
  }

  const maskedPart = "*".repeat(apiKey.length - visibleChars * 2);
  const startVisible = apiKey.slice(0, visibleChars);
  const endVisible = apiKey.slice(-visibleChars);

  return `${startVisible}${maskedPart}${endVisible}`;
}

export function formatCommitMessage(message: string): string {
  return message
    .split(/\r?\n/)[0]
    .trim()
    .replace(/^['"`]|['"`]$/g, "");
}
