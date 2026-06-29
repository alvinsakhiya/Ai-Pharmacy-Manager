import { requestJson } from "../../lib/apiClient";

export interface BackupSchedule {
  id: number;
  group: number;
  group_name: string;
  enabled: boolean;
  daily_time: string;
  retention_count: number;
  scheduler_note: string;
  created_at: string;
  updated_at: string;
}

export interface BackupRun {
  id: number;
  group: number;
  group_name: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "RESTORED";
  trigger: "MANUAL" | "SCHEDULED" | "PRE_RESTORE";
  file: string;
  file_size: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string;
  checksum: string;
  created_at: string;
  updated_at: string;
}

export interface BackupScheduleUpdate {
  enabled?: boolean;
  daily_time?: string;
}

export function getBackupSchedule(): Promise<BackupSchedule> {
  return requestJson<BackupSchedule>("/api/backups/schedule/");
}

export function updateBackupSchedule(
  body: BackupScheduleUpdate,
): Promise<BackupSchedule> {
  return requestJson<BackupSchedule>("/api/backups/schedule/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function listBackupRuns(): Promise<BackupRun[]> {
  return requestJson<BackupRun[]>("/api/backups/runs/");
}

export function runBackupNow(): Promise<BackupRun> {
  return requestJson<BackupRun>("/api/backups/runs/now/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export function restoreBackup(runId: number): Promise<BackupRun> {
  return requestJson<BackupRun>(`/api/backups/runs/${runId}/restore/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: "RESTORE" }),
  });
}
