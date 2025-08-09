export interface GitChanges {
  baseBranch: string;
  currentBranch: string;
  files: FileChange[];
  commits: CommitInfo[];
  stats: {
    insertions: number;
    deletions: number;
    filesChanged: number;
  };
}

export interface FileChange {
  path: string;
  status: string;
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

export interface GenerateOptions {
  provider: string;
  model?: string;
  template: string;
}
