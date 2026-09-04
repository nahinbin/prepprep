import { GAME_SOUND_FILES, HOME_MUSIC_FILES, type GameSoundKind } from "./gameSounds";

const listeners = new Set<() => void>();

const SETTINGS_KEY = "mcq_sound_settings_v1";
const DB_NAME = "mcq_sound_local";
const DB_VERSION = 1;
const MUSIC_STORE = "home_music";
const SFX_STORE = "sfx_overrides";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export type SoundSettings = {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  disabledHomeTracks: string[];
};

export type CustomHomeTrack = {
  id: string;
  name: string;
  type: string;
  blob: Blob;
};

export type CustomSfxOverride = {
  kind: string;
  name: string;
  type: string;
  blob: Blob;
};

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  masterVolume: 1,
  sfxVolume: 1,
  musicVolume: 1,
  sfxEnabled: true,
  musicEnabled: true,
  disabledHomeTracks: [],
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

function normalizeSettings(raw: Partial<SoundSettings> | null | undefined): SoundSettings {
  return {
    masterVolume: clamp01(raw?.masterVolume ?? 1),
    sfxVolume: clamp01(raw?.sfxVolume ?? 1),
    musicVolume: clamp01(raw?.musicVolume ?? 1),
    sfxEnabled: raw?.sfxEnabled !== false,
    musicEnabled: raw?.musicEnabled !== false,
    disabledHomeTracks: Array.isArray(raw?.disabledHomeTracks)
      ? raw.disabledHomeTracks.filter((f) => typeof f === "string")
      : [],
  };
}

export function getSoundSettings(): SoundSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SOUND_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SOUND_SETTINGS };
    return normalizeSettings(JSON.parse(raw) as Partial<SoundSettings>);
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
}

function persistSettings(next: SoundSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  listeners.forEach((fn) => fn());
}

export function patchSoundSettings(partial: Partial<SoundSettings>): SoundSettings {
  const next = normalizeSettings({ ...getSoundSettings(), ...partial });
  persistSettings(next);
  return next;
}

export function subscribeSoundSettings(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function sfxOutputLevel(settings = getSoundSettings()) {
  if (!settings.sfxEnabled) return 0;
  return clamp01(settings.masterVolume * settings.sfxVolume);
}

export function musicOutputLevel(settings = getSoundSettings()) {
  if (!settings.musicEnabled) return 0;
  return clamp01(settings.masterVolume * settings.musicVolume);
}

export function soundFileLabel(filename: string) {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base.replace(/\b\w/g, (c) => c.toUpperCase()) || filename;
}

export function builtinHomeTracks() {
  return HOME_MUSIC_FILES.map((file) => file.trim()).filter(Boolean);
}

export function isBuiltinTrackEnabled(file: string, settings = getSoundSettings()) {
  return !settings.disabledHomeTracks.includes(file);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MUSIC_STORE)) {
        db.createObjectStore(MUSIC_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(SFX_STORE)) {
        db.createObjectStore(SFX_STORE, { keyPath: "kind" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listCustomHomeTracks(): Promise<CustomHomeTrack[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openDb();
    const tx = db.transaction(MUSIC_STORE, "readonly");
    const rows = await idbReq(tx.objectStore(MUSIC_STORE).getAll());
    return (rows as CustomHomeTrack[]).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function addCustomHomeTrack(file: File): Promise<{ error?: string }> {
  if (file.size > MAX_UPLOAD_BYTES) return { error: "File is too large (max 8 MB)." };
  if (!file.type.startsWith("audio/") && !/\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(file.name)) {
    return { error: "Please pick an audio file." };
  }
  try {
    const db = await openDb();
    const track: CustomHomeTrack = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      type: file.type || "audio/mpeg",
      blob: file,
    };
    const tx = db.transaction(MUSIC_STORE, "readwrite");
    await idbReq(tx.objectStore(MUSIC_STORE).put(track));
    listeners.forEach((fn) => fn());
    return {};
  } catch {
    return { error: "Could not save that file on this device." };
  }
}

export async function removeCustomHomeTrack(id: string) {
  try {
    const db = await openDb();
    const tx = db.transaction(MUSIC_STORE, "readwrite");
    await idbReq(tx.objectStore(MUSIC_STORE).delete(id));
    listeners.forEach((fn) => fn());
  } catch {
    /* ignore */
  }
}

export async function listCustomSfxOverrides(): Promise<CustomSfxOverride[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openDb();
    const tx = db.transaction(SFX_STORE, "readonly");
    const rows = await idbReq(tx.objectStore(SFX_STORE).getAll());
    return rows as CustomSfxOverride[];
  } catch {
    return [];
  }
}

export async function setCustomSfx(kind: GameSoundKind, file: File): Promise<{ error?: string }> {
  if (file.size > MAX_UPLOAD_BYTES) return { error: "File is too large (max 8 MB)." };
  if (!file.type.startsWith("audio/") && !/\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(file.name)) {
    return { error: "Please pick an audio file." };
  }
  if (!(kind in GAME_SOUND_FILES)) return { error: "Unknown sound." };
  try {
    const db = await openDb();
    const row: CustomSfxOverride = {
      kind,
      name: file.name,
      type: file.type || "audio/mpeg",
      blob: file,
    };
    const tx = db.transaction(SFX_STORE, "readwrite");
    await idbReq(tx.objectStore(SFX_STORE).put(row));
    listeners.forEach((fn) => fn());
    return {};
  } catch {
    return { error: "Could not save that file on this device." };
  }
}

export async function clearCustomSfx(kind: GameSoundKind) {
  try {
    const db = await openDb();
    const tx = db.transaction(SFX_STORE, "readwrite");
    await idbReq(tx.objectStore(SFX_STORE).delete(kind));
    listeners.forEach((fn) => fn());
  } catch {
    /* ignore */
  }
}
