/**
 * Masks the middle part of an API key, showing only the first and last 4 characters.
 * @param apiKey The API key to mask.
 * @param visibleChars The number of characters to show at the start and end of the API key.
 *
 * @returns The masked API key.
 */
export function maskApiKey(apiKey: string, visibleChars = 4): string {
  if (apiKey.length <= visibleChars * 2) {
    return apiKey;
  }

  const maskedPart = "*".repeat(apiKey.length - visibleChars * 2);
  const startVisible = apiKey.slice(0, visibleChars);
  const endVisible = apiKey.slice(-visibleChars);

  return `${startVisible}${maskedPart}${endVisible}`;
}
