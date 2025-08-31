export interface GitChanges {
  baseBranch: string;
  currentBranch: string;
  files: FileChange[];
  commits: CommitInfo[];
  stats: GitStats;
  mode?: "branch" | "staged"; // added this for commit
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
  refineFrom?: string;
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

export interface CommitMessageOptions {
  provider: string;
  model?: string;
  maxFiles?: number;
  maxDiffLines?: number;
  typeHint?: string;
  refineFrom?: string;
}

export interface CLIGenerateOptions {
  base?: string;
  provider?: string;
  model?: string;
  template?: string;
  templateFile?: string;
  maxFiles?: string; // will parse to number
  dryRun?: boolean;
  ghPr?: boolean;
}

export interface CLIModelsOptions {
  provider?: string;
}

export interface CLIConfigOptions {
  unmask?: boolean;
}

export interface CLICommitOptions {
  base?: string;
  provider?: string;
  model?: string;
  maxFiles?: string;
  typeHint?: string;
  stage?: boolean;
  commit?: boolean;
}

// Errors
export class GhError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GhError";
  }
}
export class GhNeedsPushError extends GhError {
  constructor() {
    super("You must push the current branch to a remote before creating a PR.");
    this.name = "GhNeedsPushError";
  }
}
