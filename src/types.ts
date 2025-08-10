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
}

export interface SimpleGitFile {
  file: string;
  changes: number;
  binary?: boolean;
}
