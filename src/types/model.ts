export type RunnerType = 'jest' | 'karma' | 'unknown';

export type ChangeStatus = 'U' | 'S' | 'C';
export type SpecStatus = ChangeStatus | 'R';

export interface ProjectInfo {
  name: string;
  projectJsonPath: string;
  rootAbs: string;
  sourceRootAbs?: string;
  runner: RunnerType;
}

export interface ChangedFile {
  relPathFromGitRoot: string;
  absPath: string;
  status: ChangeStatus;
}

export interface SpecEntry {
  absPath: string;
  status: SpecStatus;
}

export interface MissingSpecEntry {
  sourceAbsPath: string;
  expectedSpecAbsPath: string;
  sourceStatus: ChangeStatus;
}

export interface ProjectWithSpecs {
  name: string;
  runner: RunnerType;
  rootAbs: string;
  specs: SpecEntry[];
  missingSpecs: MissingSpecEntry[];
}

export interface ResolveChangedSpecsResult {
  projects: ProjectWithSpecs[];
  missingSpecs: MissingSpecEntry[];
}
