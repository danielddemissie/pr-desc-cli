import type {
  GitChanges,
  FileChange,
  AnalysisResult,
  DetectedPattern,
  CodeMetrics,
} from "./types.js";
import { patternsInfo, reviewPatters } from "./utils.js";

export class ReviewAnalysisEngine {
  private securityPatterns!: RegExp[];
  private performancePatterns!: RegExp[];
  private bugPatterns!: RegExp[];
  private stylePatterns!: RegExp[];

  constructor() {
    this.initializePatterns();
  }

  // Perform comprehensive analysis of git changes
  async analyzeChanges(changes: GitChanges): Promise<AnalysisResult> {
    const patterns = this.detectPatterns(changes);
    const metrics = this.calculateMetrics(changes);
    const riskScore = this.calculateRiskScore(patterns, metrics);
    const recommendations = this.generateRecommendations(patterns, metrics);

    return {
      patterns,
      metrics,
      riskScore,
      recommendations,
    };
  }

  // Initialize pattern detection rules
  private initializePatterns(): void {
    this.securityPatterns = reviewPatters.securityPatterns;
    this.performancePatterns = reviewPatters.performancePatterns;
    this.stylePatterns = reviewPatters.stylePatterns;
    this.bugPatterns = reviewPatters.bugPatterns;
  }

  //Detect patterns in code changes
  private detectPatterns(changes: GitChanges): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    for (const file of changes.files) {
      if (!file.patch) continue;

      // Only analyze added lines (lines starting with +)
      const addedLines = file.patch
        .split("\n")
        .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
        .map((line) => line.substring(1));

      const addedCode = addedLines.join("\n");

      // Check security patterns
      patterns.push(
        ...this.checkPatterns(
          addedCode,
          file.path,
          this.securityPatterns,
          "security",
          this.getSecurityPatternInfo()
        )
      );

      // Check performance patterns
      patterns.push(
        ...this.checkPatterns(
          addedCode,
          file.path,
          this.performancePatterns,
          "performance",
          this.getPerformancePatternInfo()
        )
      );

      // Check bug patterns
      patterns.push(
        ...this.checkPatterns(
          addedCode,
          file.path,
          this.bugPatterns,
          "bug",
          this.getBugPatternInfo()
        )
      );

      // Check style patterns
      patterns.push(
        ...this.checkPatterns(
          addedCode,
          file.path,
          this.stylePatterns,
          "style",
          this.getStylePatternInfo()
        )
      );

      // File-specific analysis
      patterns.push(...this.analyzeFileSpecific(file));
    }

    return patterns;
  }

  //Check specific patterns in code
  private checkPatterns(
    code: string,
    filePath: string,
    patterns: RegExp[],
    type: DetectedPattern["type"],
    patternInfo: Record<
      string,
      {
        severity: DetectedPattern["severity"];
        description: string;
        suggestion: string;
      }
    >
  ): DetectedPattern[] {
    const detected: DetectedPattern[] = [];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) {
        const patternKey = pattern.source;
        const info = patternInfo[patternKey] || {
          severity: "medium" as const,
          description: `Detected pattern: ${pattern.source}`,
          suggestion: "Review this pattern for potential issues",
        };

        detected.push({
          type,
          severity: info.severity,
          pattern: pattern.source,
          files: [filePath],
          description: info.description,
          suggestion: info.suggestion,
        });
      }
    }

    return detected;
  }

  // Analyze file-specific patterns
  private analyzeFileSpecific(file: FileChange): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const extension = file.path.split(".").pop()?.toLowerCase();

    if (!file.patch) return patterns;

    if (["ts", "tsx", "js", "jsx"].includes(extension || "")) {
      // I needed TypeScript/JavaScript specific checks only, you can add more Language as needed
      patterns.push(...this.analyzeJavaScriptFile(file));
    }

    // Configuration file checks
    if (["json", "yaml", "yml", "env"].includes(extension || "")) {
      patterns.push(...this.analyzeConfigFile(file));
    }

    return patterns;
  }

  // JavaScript/TypeScript specific analysis/
  private analyzeJavaScriptFile(file: FileChange): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const addedCode =
      file.patch
        ?.split("\n")
        .filter((line) => line.startsWith("+"))
        .join("\n") || "";

    // Check for async/await issues
    if (addedCode.includes("await") && !addedCode.includes("async")) {
      patterns.push({
        type: "bug",
        severity: "high",
        pattern: "await-without-async",
        files: [file.path],
        description: "Using await without async function declaration",
        suggestion: "Ensure functions using await are declared as async",
      });
    }

    // Check for Promise handling
    if (addedCode.includes(".then(") && !addedCode.includes(".catch(")) {
      patterns.push({
        type: "bug",
        severity: "medium",
        pattern: "promise-without-catch",
        files: [file.path],
        description: "Promise chain without error handling",
        suggestion: "Add .catch() to handle promise rejections",
      });
    }

    // Check for React-specific issues
    if (file.path.includes(".tsx") || file.path.includes(".jsx")) {
      patterns.push(...this.analyzeReactFile(file, addedCode));
    }

    return patterns;
  }

  // React-specific analysis
  private analyzeReactFile(
    file: FileChange,
    addedCode: string
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // Check for missing key prop in lists
    if (addedCode.includes(".map(") && !addedCode.includes("key=")) {
      patterns.push({
        type: "bug",
        severity: "medium",
        pattern: "missing-react-key",
        files: [file.path],
        description: "Missing key prop in React list rendering",
        suggestion: "Add unique key prop to list items",
      });
    }

    // Check for direct state mutation
    if (addedCode.includes("useState") && addedCode.match(/\w+\.\w+\s*=/)) {
      patterns.push({
        type: "bug",
        severity: "high",
        pattern: "direct-state-mutation",
        files: [file.path],
        description: "Potential direct state mutation in React",
        suggestion: "Use state setter functions instead of direct mutation",
      });
    }

    return patterns;
  }

  // Configuration file analysis

  private analyzeConfigFile(file: FileChange): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const addedCode =
      file.patch
        ?.split("\n")
        .filter((line) => line.startsWith("+"))
        .join("\n") || "";

    // Check for hardcoded secrets in config
    if (addedCode.match(/(password|secret|key|token)\s*[:=]\s*['"]\w+/gi)) {
      patterns.push({
        type: "security",
        severity: "critical",
        pattern: "hardcoded-secrets",
        files: [file.path],
        description: "Hardcoded secrets in configuration file",
        suggestion: "Use environment variables for sensitive data",
      });
    }

    return patterns;
  }

  // Calculate code metrics
  private calculateMetrics(changes: GitChanges): CodeMetrics {
    let complexity = 0;
    let testCoverage = 0;
    const duplicateCode = 0;
    let technicalDebt = 0;
    let securityRisk = 0;

    for (const file of changes.files) {
      if (!file.patch) continue;

      const addedLines = file.patch
        .split("\n")
        .filter((line) => line.startsWith("+"));

      // Complexity calculation (simplified)
      complexity += this.calculateComplexity(addedLines);

      // Test coverage estimation
      if (file.path.includes("test") || file.path.includes("spec")) {
        testCoverage += addedLines.length;
      }

      // Technical debt indicators
      technicalDebt += this.calculateTechnicalDebt(addedLines);

      // Security risk assessment
      securityRisk += this.calculateSecurityRisk(addedLines);
    }

    return {
      complexity: Math.min(100, complexity),
      testCoverage: Math.min(100, testCoverage),
      duplicateCode: Math.min(100, duplicateCode),
      technicalDebt: Math.min(100, technicalDebt),
      securityRisk: Math.min(100, securityRisk),
    };
  }

  // Calculate cyclomatic complexity (simplified)
  private calculateComplexity(lines: string[]): number {
    let complexity = 1; // Base complexity

    for (const line of lines) {
      const cleanLine = line.substring(1).trim();

      // Count decision points
      if (
        cleanLine.match(/\b(if|else|while|for|switch|case|catch|&&|\|\|)\b/g)
      ) {
        complexity += 1;
      }
    }

    return complexity;
  }

  // Calculate technical debt score
  private calculateTechnicalDebt(lines: string[]): number {
    let debt = 0;

    for (const line of lines) {
      const cleanLine = line.substring(1).trim();

      // any TODO or FIXME comments
      if (cleanLine.match(/\b(TODO|FIXME|HACK|XXX)\b/gi)) {
        debt += 5;
      }

      // Long lines
      if (cleanLine.length > 120) {
        debt += 1;
      }

      // Complex expressions
      if (cleanLine.match(/[()]{3,}/g)) {
        debt += 2;
      }
    }

    return debt;
  }

  // Calculate security risk score
  private calculateSecurityRisk(lines: string[]): number {
    let risk = 0;

    for (const line of lines) {
      const cleanLine = line.substring(1).trim();

      // High-risk patterns
      if (cleanLine.match(/eval\s*\(|innerHTML\s*=|document\.write/gi)) {
        risk += 10;
      }

      // Medium-risk patterns
      if (cleanLine.match(/password|secret|token|key/gi)) {
        risk += 5;
      }

      // Low-risk patterns
      if (cleanLine.match(/http:|localhost/gi)) {
        risk += 1;
      }
    }

    return risk;
  }

  private calculateRiskScore(
    patterns: DetectedPattern[],
    metrics: CodeMetrics
  ): number {
    let score = 0;

    // Pattern-based scoring
    for (const pattern of patterns) {
      switch (pattern.severity) {
        case "critical":
          score += 25;
          break;
        case "high":
          score += 15;
          break;
        case "medium":
          score += 8;
          break;
        case "low":
          score += 3;
          break;
      }
    }

    // Metrics-based scoring
    score += metrics.complexity * 0.2;
    score += metrics.technicalDebt * 0.3;
    score += metrics.securityRisk * 0.5;

    return Math.min(100, Math.round(score));
  }

  // Generate recommendations based on analysis
  private generateRecommendations(
    patterns: DetectedPattern[],
    metrics: CodeMetrics
  ): string[] {
    const recommendations: string[] = [];

    // Pattern-based recommendations
    const securityIssues = patterns.filter((p) => p.type === "security").length;
    const performanceIssues = patterns.filter(
      (p) => p.type === "performance"
    ).length;
    const bugIssues = patterns.filter((p) => p.type === "bug").length;

    if (securityIssues > 0) {
      recommendations.push(
        `Address ${securityIssues} security issue(s) before merging`
      );
    }

    if (performanceIssues > 2) {
      recommendations.push(
        "Consider performance optimization for better user experience"
      );
    }

    if (bugIssues > 0) {
      recommendations.push(
        `Fix ${bugIssues} potential bug(s) to improve code reliability`
      );
    }

    // Metrics-based recommendations
    if (metrics.complexity > 15) {
      recommendations.push(
        "Consider breaking down complex functions for better maintainability"
      );
    }

    if (metrics.technicalDebt > 20) {
      recommendations.push(
        "Address technical debt comments and code quality issues"
      );
    }

    if (metrics.securityRisk > 30) {
      recommendations.push(
        "Conduct thorough security review before deployment"
      );
    }

    return recommendations;
  }

  // load pattern info
  private getSecurityPatternInfo() {
    return patternsInfo.security;
  }

  private getPerformancePatternInfo() {
    return patternsInfo.performance;
  }

  private getBugPatternInfo() {
    return patternsInfo.bug;
  }

  private getStylePatternInfo() {
    return patternsInfo.style;
  }
}
