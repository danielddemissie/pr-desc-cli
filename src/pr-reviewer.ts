import chalk from "chalk";
import { generateText } from "ai";
import type { GitChanges } from "./types.js";
import { getAIModel } from "./models.js";
import { ReviewAnalysisEngine } from "./analysis-engine.js";
import {
  ReviewOptions,
  ReviewResult,
  ReviewIssue,
  ReviewMetrics,
  AnalysisResult,
} from "./types.js";

export async function generatePRReview(
  changes: GitChanges,
  options: ReviewOptions
): Promise<ReviewResult> {
  const analysisEngine = new ReviewAnalysisEngine();
  const preAnalysis = await analysisEngine.analyzeChanges(changes);

  const model = getAIModel(options.provider, options.model);
  const prompt = buildReviewPrompt(
    changes,
    options.reviewType,
    options.severity,
    options.maxFiles || 20,
    options.maxDiffLines || 500,
    preAnalysis // Pass pre-analysis to prompt
  );

  const { text } = await generateText({
    model,
    prompt,
    temperature: 0.2,
    maxTokens: 3000,
  });

  const aiResult = parseReviewResponse(text, changes);

  return mergeAnalysisResults(aiResult, preAnalysis);
}

function buildReviewPrompt(
  changes: GitChanges,
  reviewType: string,
  severity: string,
  maxFiles: number,
  maxDiffLines: number,
  preAnalysis?: AnalysisResult // Added pre-analysis parameter
): string {
  const gitDataSection = `
## Git Context for Code Review
**Base Branch:** ${changes.baseBranch}  
**Current Branch:** ${changes.currentBranch}  
**Files Changed:** ${changes.files.length}  
**Total Insertions:** ${changes.stats.insertions}  
**Total Deletions:** ${changes.stats.deletions}  

### Recent Commits Context
${changes.commits
  .map(
    (commit) =>
      `- ${commit.message.trim()} (${commit.hash.slice(0, 7)}) by ${
        commit.author
      }`
  )
  .join("\n")}

### File Changes Analysis
${changes.files
  .slice(0, maxFiles)
  .map((file, index) => {
    const patch = file.patch
      ? file.patch.slice(0, maxDiffLines) +
        (file.patch.length > maxDiffLines ? "\n... (truncated)" : "")
      : "";

    const fileExtension = file.path.split(".").pop()?.toLowerCase() || "";
    const fileType = getFileTypeContext(fileExtension);

    return `
**File ${index + 1}: ${file.path}**
- Status: ${file.status}
- Changes: +${file.additions} lines, -${file.deletions} lines
- File Type: ${fileType}
${patch ? `\`\`\`diff\n${patch}\n\`\`\`` : ""}`;
  })
  .join("\n\n")}

${
  changes.files.length > maxFiles
    ? `\n**Note:** ${
        changes.files.length - maxFiles
      } additional files were changed but not shown for brevity.`
    : ""
}
`;

  const preAnalysisSection = preAnalysis
    ? `
## Pre-Analysis Results
**Risk Score:** ${preAnalysis.riskScore}/100
**Detected Patterns:** ${preAnalysis.patterns.length} issues found
**Code Metrics:**
- Complexity: ${preAnalysis.metrics.complexity}
- Technical Debt: ${preAnalysis.metrics.technicalDebt}
- Security Risk: ${preAnalysis.metrics.securityRisk}

**Key Patterns Detected:**
${preAnalysis.patterns
  .filter((p) => p.severity === "critical" || p.severity === "high")
  .slice(0, 5)
  .map((p) => `- ${p.type.toUpperCase()}: ${p.description}`)
  .join("\n")}

**Pre-Analysis Recommendations:**
${preAnalysis.recommendations
  .slice(0, 3)
  .map((r) => `- ${r}`)
  .join("\n")}

Please use this pre-analysis to focus your review and provide additional insights beyond these automated findings.
`
    : "";

  const reviewTypeInstructions = getReviewTypeInstructions(reviewType);
  const severityFilter = getSeverityInstructions(severity);
  const contextualGuidance = getContextualGuidance(changes);

  return `
You are a senior software engineer and security expert performing a thorough code review.
Your goal is to provide actionable, specific feedback that improves code quality and prevents issues.

${gitDataSection}

${preAnalysisSection}

## Review Focus: ${reviewType.toUpperCase()}
${reviewTypeInstructions}

${severityFilter}

${contextualGuidance}

## Analysis Guidelines
- Be specific about line numbers when possible
- Provide concrete examples and fix suggestions
- Consider the broader context of the changes
- Focus on real issues, not nitpicks
- Prioritize security and correctness over style (unless style review is requested)
- Build upon the pre-analysis findings with deeper insights

## Response Format
Respond with a JSON object in this exact format:
{
  "summary": "2-3 sentence overall assessment focusing on key findings",
  "issues": [
    {
      "file": "exact/file/path.js",
      "line": 42,
      "type": "security|performance|bug|style|maintainability",
      "severity": "low|medium|high|critical", 
      "message": "Specific description of the issue and why it matters",
      "suggestion": "Concrete fix or improvement recommendation",
      "codeSnippet": "relevant code snippet if helpful"
    }
  ],
  "suggestions": [
    "Actionable general improvements for the entire changeset"
  ],
  "score": 8,
  "metrics": {
    "totalFiles": ${changes.files.length},
    "linesAnalyzed": ${changes.stats.insertions + changes.stats.deletions},
    "issuesFound": 0,
    "criticalIssues": 0,
    "securityIssues": 0,
    "performanceIssues": 0
  }
}

**CRITICAL:** Return ONLY the JSON object. No additional text, explanations, or formatting.
`;
}

function getFileTypeContext(extension: string): string {
  const typeMap: Record<string, string> = {
    js: "JavaScript",
    ts: "TypeScript",
    jsx: "React JSX",
    tsx: "React TypeScript",

    // only ts, js and react supported
  };

  return typeMap[extension] || "Unknown";
}

// Get detailed review instructions based on review type
function getReviewTypeInstructions(reviewType: string): string {
  const instructions = {
    comprehensive: `
Perform a thorough multi-dimensional code review covering:

**Security Analysis:**
- Authentication/authorization vulnerabilities
- Input validation and sanitization gaps
- Injection attacks (SQL, XSS, Command injection)
- Sensitive data exposure or logging
- Insecure dependencies or configurations

**Performance Review:**
- Inefficient algorithms or data structures
- Database query optimization opportunities
- Memory leaks and resource management issues
- Unnecessary computations or redundant operations
- Caching strategies and bottlenecks

**Code Quality & Maintainability:**
- Code organization and architectural patterns
- Error handling and exception management
- Type safety and validation
- Code duplication and reusability
- Documentation and code clarity

**Bug Detection:**
- Logic errors and edge cases
- Null/undefined handling issues
- Race conditions and concurrency problems
- Boundary condition failures
- Integration and API contract violations
`,

    security: `
Focus exclusively on security vulnerabilities and risks:

**Critical Security Patterns to Check:**
- **Authentication flaws:** Weak password policies, session management, token handling
- **Authorization issues:** Privilege escalation, access control bypasses
- **Input validation:** SQL injection, XSS, command injection, path traversal
- **Data protection:** Sensitive data in logs, unencrypted storage, insecure transmission
- **Configuration security:** Default credentials, exposed secrets, insecure defaults
- **Dependency security:** Known vulnerable packages, supply chain risks
- **API security:** Rate limiting, CORS misconfigurations, exposed endpoints

**Security-First Mindset:**
- Assume all input is malicious
- Check for proper sanitization and validation
- Verify secure defaults are used
- Look for information disclosure risks
`,

    performance: `
Focus on performance optimization and efficiency:

**Performance Analysis Areas:**
- **Algorithm efficiency:** Time/space complexity, unnecessary iterations
- **Database performance:** N+1 queries, missing indexes, inefficient joins
- **Memory management:** Memory leaks, excessive allocations, garbage collection pressure
- **Network optimization:** Unnecessary API calls, large payloads, missing caching
- **Frontend performance:** Bundle size, render blocking, unnecessary re-renders
- **Resource utilization:** CPU-intensive operations, blocking I/O, inefficient data structures

**Performance Metrics to Consider:**
- Response times and throughput
- Memory usage patterns
- Database query execution plans
- Bundle size and loading performance
- Scalability implications
`,

    style: `
Focus on code style, consistency, and maintainability:

**Code Style Review:**
- **Naming conventions:** Clear, consistent, descriptive names
- **Code organization:** Logical structure, proper separation of concerns
- **Formatting consistency:** Indentation, spacing, line breaks
- **Documentation:** Comments, JSDoc, README updates
- **Code patterns:** Consistent use of language idioms and frameworks

**Maintainability Factors:**
- Code readability and clarity
- Proper abstraction levels
- Consistent error handling patterns
- Test coverage and quality
- Configuration management
`,

    bugs: `
Focus on identifying potential bugs and correctness issues:

**Bug Detection Patterns:**
- **Logic errors:** Incorrect conditions, wrong operators, flawed algorithms
- **Null/undefined handling:** Missing null checks, optional chaining issues
- **Type errors:** Incorrect type assumptions, missing type guards
- **Edge cases:** Boundary conditions, empty arrays/objects, extreme values
- **Concurrency issues:** Race conditions, deadlocks, shared state problems
- **Error handling:** Unhandled exceptions, incorrect error propagation
- **Integration bugs:** API contract violations, data format mismatches

**Correctness Verification:**
- Verify business logic implementation
- Check error handling completeness
- Validate input/output contracts
- Ensure proper state management
`,
  };

  return (
    instructions[reviewType as keyof typeof instructions] ||
    instructions.comprehensive
  );
}

//Get severity filtering instructions
function getSeverityInstructions(severity: string): string {
  const severityMap = {
    all: "Report all issues regardless of severity level.",
    high: "Only report HIGH and CRITICAL severity issues. Skip low and medium severity items.",
    critical:
      "Only report CRITICAL severity issues that could cause security vulnerabilities, data loss, or system failures.",
  };

  const severityDefinitions = `
**Severity Definitions:**
- **CRITICAL:** Security vulnerabilities, data corruption risks, system crashes
- **HIGH:** Performance bottlenecks, logic errors, significant maintainability issues  
- **MEDIUM:** Code quality issues, minor performance problems, style inconsistencies
- **LOW:** Minor style issues, documentation gaps, non-critical suggestions
`;

  return (
    severityMap[severity as keyof typeof severityMap] +
    "\n" +
    severityDefinitions
  );
}

// Get contextual guidance based on the changes
function getContextualGuidance(changes: GitChanges): string {
  const hasConfigFiles = changes.files.some(
    (f) =>
      f.path.includes("config") ||
      f.path.includes(".env") ||
      f.path.includes("package.json") ||
      f.path.includes("docker")
  );

  const hasSecurityFiles = changes.files.some(
    (f) =>
      f.path.includes("auth") ||
      f.path.includes("security") ||
      f.path.includes("login") ||
      f.path.includes("password")
  );

  const hasAPIFiles = changes.files.some(
    (f) =>
      f.path.includes("api") ||
      f.path.includes("endpoint") ||
      f.path.includes("route") ||
      f.path.includes("controller")
  );

  const hasDatabaseFiles = changes.files.some(
    (f) =>
      f.path.includes("model") ||
      f.path.includes("schema") ||
      f.path.includes("migration") ||
      f.path.includes("query")
  );

  let guidance = "## Contextual Review Focus\n";

  if (hasConfigFiles) {
    guidance +=
      "- **Configuration Changes Detected:** Pay special attention to security settings, environment variables, and deployment configurations.\n";
  }

  if (hasSecurityFiles) {
    guidance +=
      "- **Security-Related Changes:** Thoroughly review authentication, authorization, and security implementations.\n";
  }

  if (hasAPIFiles) {
    guidance +=
      "- **API Changes:** Focus on input validation, error handling, rate limiting, and API security.\n";
  }

  if (hasDatabaseFiles) {
    guidance +=
      "- **Database Changes:** Review for SQL injection risks, query performance, and data integrity.\n";
  }

  return guidance;
}

// Parse the AI response into a structured ReviewResult with enhanced error handling.
function parseReviewResponse(
  response: string,
  changes: GitChanges
): ReviewResult {
  try {
    // Clean the response to extract JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (
      !parsed.summary ||
      !Array.isArray(parsed.issues) ||
      !Array.isArray(parsed.suggestions) ||
      typeof parsed.score !== "number"
    ) {
      throw new Error("Invalid response structure");
    }

    // Calculate metrics if not provided
    const metrics = parsed.metrics || calculateMetrics(parsed.issues, changes);

    return {
      summary: parsed.summary,
      issues: parsed.issues.map(validateIssue),
      suggestions: parsed.suggestions,
      score: Math.max(1, Math.min(10, parsed.score)), // Clamp between 1-10
      metrics,
    };
  } catch (error) {
    console.error("Failed to parse review response:", error);

    // Enhanced fallback with basic analysis
    return {
      summary:
        "Review completed, but response parsing failed. Manual review recommended.",
      issues: [],
      suggestions: [
        "Consider running the review again with a different AI model",
        "Manually review the changes for potential issues",
        "Check the AI response format and model compatibility",
      ],
      score: 5,
      metrics: {
        totalFiles: changes.files.length,
        linesAnalyzed: changes.stats.insertions + changes.stats.deletions,
        issuesFound: 0,
        criticalIssues: 0,
        securityIssues: 0,
        performanceIssues: 0,
      },
    };
  }
}

// Validate and sanitize individual issues
function validateIssue(issue: any): ReviewIssue {
  return {
    file: issue.file || "unknown",
    line: typeof issue.line === "number" ? issue.line : undefined,
    type: [
      "security",
      "performance",
      "bug",
      "style",
      "maintainability",
    ].includes(issue.type)
      ? issue.type
      : "maintainability",
    severity: ["low", "medium", "high", "critical"].includes(issue.severity)
      ? issue.severity
      : "medium",
    message: issue.message || "Issue description not provided",
    suggestion: issue.suggestion,
    codeSnippet: issue.codeSnippet,
  };
}

// Calculate metrics from issues and changes
function calculateMetrics(issues: any[], changes: GitChanges): ReviewMetrics {
  const criticalIssues = issues.filter((i) => i.severity === "critical").length;
  const securityIssues = issues.filter((i) => i.type === "security").length;
  const performanceIssues = issues.filter(
    (i) => i.type === "performance"
  ).length;

  return {
    totalFiles: changes.files.length,
    linesAnalyzed: changes.stats.insertions + changes.stats.deletions,
    issuesFound: issues.length,
    criticalIssues,
    securityIssues,
    performanceIssues,
  };
}

// Merge AI analysis results with pre-analysis findings
function mergeAnalysisResults(
  aiResult: ReviewResult,
  preAnalysis: AnalysisResult
): ReviewResult {
  // Convert pre-analysis patterns to review issues
  const preAnalysisIssues: ReviewIssue[] = preAnalysis.patterns.map(
    (pattern) => ({
      file: pattern.files[0] || "unknown",
      type: pattern.type,
      severity: pattern.severity,
      message: pattern.description,
      suggestion: pattern.suggestion,
    })
  );

  // Merge issues, avoiding duplicates
  const allIssues = [...aiResult.issues];

  for (const preIssue of preAnalysisIssues) {
    const isDuplicate = allIssues.some(
      (issue) =>
        issue.file === preIssue.file &&
        issue.type === preIssue.type &&
        issue.message.includes(preIssue.message.substring(0, 20))
    );

    if (!isDuplicate) {
      allIssues.push(preIssue);
    }
  }

  // Merge suggestions
  const allSuggestions = [
    ...aiResult.suggestions,
    ...preAnalysis.recommendations.filter(
      (rec) =>
        !aiResult.suggestions.some((sug) => sug.includes(rec.substring(0, 20)))
    ),
  ];

  // Calculate enhanced metrics
  const enhancedMetrics = {
    ...aiResult.metrics,
    totalFiles:
      preAnalysis.metrics.complexity > 0
        ? preAnalysis.metrics.complexity
        : aiResult.metrics?.totalFiles || 0,
    issuesFound: allIssues.length,
    criticalIssues: allIssues.filter((i) => i.severity === "critical").length,
    securityIssues: allIssues.filter((i) => i.type === "security").length,
    performanceIssues: allIssues.filter((i) => i.type === "performance").length,
  };

  // Adjust score based on pre-analysis risk
  let adjustedScore = aiResult.score;
  if (preAnalysis.riskScore > 50) {
    adjustedScore = Math.max(
      1,
      adjustedScore - Math.floor(preAnalysis.riskScore / 20)
    );
  }

  return {
    summary: `${aiResult.summary} Pre-analysis detected ${preAnalysis.patterns.length} patterns with risk score ${preAnalysis.riskScore}/100.`,
    issues: allIssues,
    suggestions: allSuggestions,
    score: adjustedScore,
    metrics: enhancedMetrics,
  };
}

export function displayReviewResults(
  review: any,
  scoreThreshold?: { pass: number; warn: number; fail: number }
) {
  console.log("\n" + chalk.blue("═".repeat(60)));
  console.log(chalk.bold.cyan("🔍 AI Code Review Results"));
  console.log(chalk.blue("═".repeat(60)));

  // Overall score with custom thresholds
  const thresholds = scoreThreshold || { pass: 8, warn: 6, fail: 4 };
  const scoreColor =
    review.score >= thresholds.pass
      ? chalk.green
      : review.score >= thresholds.warn
      ? chalk.yellow
      : chalk.red;

  console.log(
    `\n${chalk.bold("Overall Score:")} ${scoreColor(review.score + "/10")}`
  );

  // Summary
  console.log(`\n${chalk.bold("Summary:")}`);
  console.log(chalk.gray(review.summary));

  // Issues
  if (review.issues.length > 0) {
    console.log(
      `\n${chalk.bold("Issues Found:")} ${chalk.red(review.issues.length)}`
    );

    review.issues.forEach((issue: any, index: number) => {
      const severityColor =
        {
          critical: chalk.red.bold,
          high: chalk.red,
          medium: chalk.yellow,
          low: chalk.gray,
        }[issue.severity as "critical" | "high" | "medium" | "low"] ||
        chalk.gray;

      const typeIcon =
        (
          {
            security: "🔒",
            performance: "⚡",
            bug: "🐛",
            style: "🎨",
            maintainability: "🔧",
          } as Record<string, string>
        )[issue.type] || "⚠️";

      console.log(
        `\n${index + 1}. ${typeIcon} ${severityColor(
          issue.severity.toUpperCase()
        )} - ${issue.type}`
      );
      console.log(
        `   ${chalk.bold("File:")} ${issue.file}${
          issue.line ? `:${issue.line}` : ""
        }`
      );
      console.log(`   ${chalk.bold("Issue:")} ${issue.message}`);
      if (issue.suggestion) {
        console.log(
          `   ${chalk.bold("Fix:")} ${chalk.green(issue.suggestion)}`
        );
      }
    });
  } else {
    console.log(`\n${chalk.green("✅ No issues found!")}`);
  }

  // Suggestions
  if (review.suggestions.length > 0) {
    console.log(`\n${chalk.bold("General Suggestions:")}`);
    review.suggestions.forEach((suggestion: string, index: number) => {
      console.log(`${index + 1}. ${chalk.cyan(suggestion)}`);
    });
  }

  console.log("\n" + chalk.blue("═".repeat(60)));

  // Action recommendations with custom thresholds
  if (review.score >= thresholds.pass) {
    console.log(chalk.green("🚀 Code looks great! Ready to create PR."));
  } else if (review.score >= thresholds.warn) {
    console.log(
      chalk.yellow("⚠️  Consider addressing issues before creating PR.")
    );
  } else {
    console.log(chalk.red("🛑 Please fix critical issues before proceeding."));
  }

  console.log(
    chalk.gray(
      "\nRun 'pr-desc generate' when ready to create your PR description."
    )
  );
  console.log(
    chalk.gray("Use 'pr-desc profiles list' to see available review profiles.")
  );
}
