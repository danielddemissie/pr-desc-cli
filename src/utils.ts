import { DetectedPattern, PatterTypes } from "./types";

export function maskApiKey(apiKey: string, visibleChars = 4): string {
  if (!apiKey || apiKey.length <= visibleChars * 2) {
    return apiKey; // No masking needed if the key is too short
  }

  const maskedPart = "*".repeat(apiKey.length - visibleChars * 2);
  const startVisible = apiKey.slice(0, visibleChars);
  const endVisible = apiKey.slice(-visibleChars);

  return `${startVisible}${maskedPart}${endVisible}`;
}

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

export function formatFileSize(bytes: number): string {
  const sizes = ["B", "KB", "MB", "GB"];
  if (bytes === 0) return "0 B";

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

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

export const reviewPatters = {
  // Security vulnerability patterns
  securityPatterns: [
    /eval\s*\(/gi, // eval() usage
    /innerHTML\s*=/gi, // innerHTML assignment (XSS risk)
    /document\.write\s*\(/gi, // document.write (XSS risk)
    /\$\{[^}]*\}/g, // Template literal injection risk
    /SELECT\s+.*\s+FROM\s+.*\s+WHERE\s+.*\+/gi, // SQL injection pattern
    /password\s*=\s*['"]/gi, // Hardcoded passwords
    /api[_-]?key\s*=\s*['"]/gi, // Hardcoded API keys
    /secret\s*=\s*['"]/gi, // Hardcoded secrets
    /token\s*=\s*['"]/gi, // Hardcoded tokens
    /crypto\.createHash\s*\(\s*['"]md5['"]/gi, // Weak hashing
    /Math\.random\s*$$\s*$$/gi, // Insecure random for security
  ],
  // Performance issue patterns
  performancePatterns: [
    /for\s*$$[^)]*$$\s*{[^}]*for\s*\(/gi, // Nested loops
    /while\s*$$[^)]*$$\s*{[^}]*while\s*\(/gi, // Nested while loops
    /\.map\s*$$[^)]*$$\.map\s*\(/gi, // Chained array operations
    /JSON\.parse\s*\(\s*JSON\.stringify/gi, // Inefficient deep clone
    /new\s+RegExp\s*\(/gi, // RegExp in loops (should be outside)
    /console\.log\s*\(/gi, // Console logs in production
    /debugger\s*;/gi, // Debugger statements
    /alert\s*\(/gi, // Alert statements
  ],

  // Bug-prone patterns
  bugPatterns: [
    /==\s*null/gi, // Should use === null
    /!=\s*null/gi, // Should use !== null
    /==\s*undefined/gi, // Should use === undefined
    /!=\s*undefined/gi, // Should use !== undefined
    /\+\+\w+\[/gi, // Increment with array access
    /\w+\[\+\+/gi, // Array access with increment
    /catch\s*$$[^)]*$$\s*{\s*}/gi, // Empty catch blocks
    /if\s*$$[^)]*$$\s*;\s*$/gm, // Empty if statements
    /else\s*;\s*$/gm, // Empty else statements
  ],

  // Style and maintainability patterns
  stylePatterns: [
    /function\s+\w+\s*$$[^)]*$$\s*{[\s\S]{500,}?}/gi, // Large functions
    /class\s+\w+\s*{[\s\S]{1000,}?}/gi, // Large classes
    /\/\*[\s\S]*?\*\//g, // Block comments (check for TODO/FIXME)
    /\/\/\s*(TODO|FIXME|HACK|XXX)/gi, // Technical debt comments
    /var\s+/gi, // var usage (should use let/const)
  ],
};

export const patternsInfo: Record<
  Exclude<PatterTypes, "maintainability">,
  Record<
    string,
    {
      severity: DetectedPattern["severity"];
      description: string;
      suggestion: string;
    }
  >
> = {
  security: {
    "eval\\s*\\(": {
      severity: "critical",
      description: "Use of eval() can lead to code injection vulnerabilities",
      suggestion:
        "Avoid eval() and use safer alternatives like JSON.parse() for data",
    },
    "innerHTML\\s*=": {
      severity: "high",
      description:
        "Direct innerHTML assignment can lead to XSS vulnerabilities",
      suggestion: "Use textContent or sanitize HTML content before assignment",
    },
    "password\\s*=\\s*['\"]": {
      severity: "critical",
      description: "Hardcoded password detected in source code",
      suggestion:
        "Use environment variables or secure configuration for passwords",
    },
  },

  bug: {
    "==\\s*null": {
      severity: "medium",
      description: "Loose equality with null can cause unexpected behavior",
      suggestion: "Use strict equality (===) for null checks",
    },
    "catch\\s*$$[^)]*$$\\s*{\\s*}": {
      severity: "high",
      description:
        "Empty catch blocks hide errors and make debugging difficult",
      suggestion: "Add proper error handling or at least log the error",
    },
  },
  performance: {
    "for\\s*$$[^)]*$$\\s*{[^}]*for\\s*\\(": {
      severity: "medium",
      description:
        "Nested loops can cause performance issues with large datasets",
      suggestion:
        "Consider optimizing algorithm or using more efficient data structures",
    },
    "console\\.log\\s*\\(": {
      severity: "low",
      description: "Console logs should be removed from production code",
      suggestion:
        "Remove console.log statements or use proper logging framework",
    },
  },

  style: {
    "var\\s+": {
      severity: "low",
      description: "var has function scope and can cause confusion",
      suggestion: "Use let or const for block-scoped variables",
    },
    "\\/\\/\\s*(TODO|FIXME|HACK|XXX)": {
      severity: "low",
      description: "Technical debt comment indicates incomplete work",
      suggestion: "Address the TODO/FIXME or create a proper issue to track it",
    },
  },
};
