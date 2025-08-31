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

export function ensureConventionalCommit(
  message: string,
  typeHint?: string
): string {
  const validTypes = [
    "feat",
    "fix",
    "docs",
    "style",
    "refactor",
    "perf",
    "test",
    "chore",
    "build",
    "ci",
  ];
  const clean = message.trim().replace(/\.$/, "");
  const conventionalRegex = new RegExp(
    `^(${validTypes.join("|")})(\([^)]*\))?:\\s+.+`,
    "i"
  );

  if (conventionalRegex.test(clean)) {
    const parts = clean.split(/:\s+/);
    const header = parts.shift() ?? "";
    let summary = parts.join(": ") || "";
    if (summary.length > 72) {
      if (summary.includes("Here's a suggested commit message")) {
        summary = summary
          .replace("Here's a suggested commit message", "")
          .trim();
      }
    }
    summary = summary.slice(0, 72).trim();
    return `${header}: ${summary}`;
  }

  const hint = typeHint && validTypes.includes(typeHint) ? typeHint : "chore";
  let summary = clean
    .replace(/^[^a-zA-Z0-9]+/, "")
    .replace(new RegExp(`^(${validTypes.join("|")})[:\s-]+`, "i"), "")
    .trim();

  summary = summary.replace(/^[A-Z]/, (c) => c.toLowerCase());
  if (!summary) summary = "update";
  if (summary.length > 72) summary = summary.slice(0, 72).trim();

  return `${hint}: ${summary}`;
}
