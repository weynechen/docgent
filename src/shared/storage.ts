import type { VersionSnapshot } from "./types";

const VERSION_STORAGE_KEY = "writing-ide-version-history";

export function loadSnapshots(): VersionSnapshot[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(VERSION_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as VersionSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSnapshots(snapshots: VersionSnapshot[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(snapshots));
}
