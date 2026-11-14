export interface BackupConfig {
  extraFolder: string | null;
  keep: number;
  lastAt: string | null;
  lastOk: string | null;
  lastError: string | null;
  lastFiles: string[];
}
export function backupFileName(date: Date): string;
export function configPath(dbPath: string): string;
export function dbPathFromEnv(env?: NodeJS.ProcessEnv): string;
export function defaultFolder(dbPath: string): string;
export function filesToPrune(names: string[], keep: number): string[];
export function folderProblem(folder: string): string | null;
export function isDue(lastOkIso: string | null, now?: Date): boolean;
export function readConfig(dbPath: string): BackupConfig;
export function runBackup(dbPath: string, now?: Date): BackupConfig;
export function startScheduler(dbPath?: string, log?: Pick<Console, 'log' | 'error'>): NodeJS.Timeout;
export function writeConfig(dbPath: string, cfg: Partial<BackupConfig>): void;
