export interface GitChanges {
  baseBranch: string;
  currentBranch: string;
  files: FileChange[];
  commits: CommitInfo[];
  stats: GitStats;
}

export interface FileChange {
  path: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  patch: string | null;
}

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitStats {
  insertions: number;
  deletions: number;
  filesChanged: number;
}

export type FileStatus =
  | "added"
  | "deleted"
  | "modified"
  | "renamed"
  | "binary"
  | "unknown";

export interface GenerateOptions {
  provider: string;
  model?: string;
  template: string;
  customTemplateContent?: string;
  maxFiles?: number;
  maxDiffLines?: number;
}

export interface SimpleGitFile {
  file: string;
  changes: number;
  binary?: boolean;
}

export interface PackageJson {
  name: string;
  version: string;
  description: string;
  main?: string;
  scripts?: {
    [key: string]: string;
  };
  keywords?: string[];
  author?: string;
  license?: string;
  dependencies?: {
    [key: string]: string;
  };
  devDependencies?: {
    [key: string]: string;
  };
}

export interface ProviderConfig {
  baseURL: string;
  apiKey?: string;
}

export interface SupportedProviders {
  [key: string]: ProviderConfig;
}

export interface Config {
  defaultProvider?: string;
  defaultTemplate?: string;
  defaultBaseBranch?: string;
  reviewConfig?: ReviewConfig;
}

export type ReviewType =
  | "comprehensive"
  | "security"
  | "performance"
  | "style"
  | "bugs";

export type SeverityType = "all" | "high" | "critical";

export interface ReviewConfig {
  defaultReviewType?: ReviewType;
  defaultSeverity?: SeverityType;
  maxFiles?: number;
  maxDiffLines?: number;
  enablePreAnalysis?: boolean;
  reviewProfiles?: ReviewProfile[];
  autoFix?: boolean;
  outputFormat?: "formatted" | "json" | "markdown";
  scoreThreshold?: {
    pass: number;
    warn: number;
    fail: number;
  };
}

export interface ReviewProfile {
  name: string;
  description: string;
  reviewType: ReviewType;
  severity: SeverityType;
  customRules?: CustomRule[];
  filePatterns?: string[];
}

export type CustomRuleType =
  | "security"
  | "performance"
  | "bug"
  | "style"
  | "maintainability";

export type CustomRuleSeverity = "low" | "medium" | "high" | "critical";

export interface CustomRule {
  name: string;
  pattern: string;
  type: CustomRuleType;
  severity: CustomRuleSeverity;
  message: string;
  suggestion: string;
}

export interface ReviewOptions {
  provider: string;
  model?: string;
  reviewType: "comprehensive" | "security" | "performance" | "style" | "bugs";
  severity: "all" | "high" | "critical";
  maxFiles?: number;
  maxDiffLines?: number;
}

export interface ReviewResult {
  summary: string;
  issues: ReviewIssue[];
  suggestions: string[];
  score: number; // 1-10 scale
  metrics?: ReviewMetrics;
}

export interface ReviewIssue {
  file: string;
  line?: number;
  type: "security" | "performance" | "bug" | "style" | "maintainability";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  suggestion?: string;
  codeSnippet?: string;
}

export interface ReviewMetrics {
  totalFiles: number;
  linesAnalyzed?: number;
  issuesFound: number;
  criticalIssues: number;
  securityIssues: number;
  performanceIssues: number;
}
