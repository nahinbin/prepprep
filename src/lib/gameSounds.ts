"use client";

import { useEffect } from "react";
import {
  GAME_SOUND_FILES,
  GAME_SOUND_URLS,
  HOME_MUSIC_FILES,
  HOME_MUSIC_VOLUME,
  gameSoundUrl,
  type GameSoundKind,
} from "./soundAssets";
import {
  isBuiltinTrackEnabled,
  listCustomHomeTracks,
  listCustomSfxOverrides,
  musicOutputLevel,
  sfxOutputLevel,
  subscribeSoundSettings,
  type CustomHomeTrack,
} from "./soundSettings";

export {
  GAME_SOUNDS_DIR,
  GAME_SOUND_FILES,
  GAME_SOUND_LABELS,
  GAME_SOUND_URLS,
  HOME_MUSIC_FILES,
  HOME_MUSIC_VOLUME,
  gameSoundUrl,
  type GameSoundKind,
} from "./soundAssets";

const LEVEL_UP_KEY = "mcq_pending_level_up";

export type PendingLevelUp = {
  fromLevel: number;
  toLevel: number;
  title: string;
};

export function stashPendingLevelUp(data: PendingLevelUp | null | undefined) {
  if (typeof window === "undefined" || !data) return;
  if (data.toLevel <= data.fromLevel) return;
  sessionStorage.setItem(LEVEL_UP_KEY, JSON.stringify(data));
}

export function peekPendingLevelUp(): PendingLevelUp | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LEVEL_UP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingLevelUp;
  } catch {
    return null;
  }
}

export function consumePendingLevelUp(): PendingLevelUp | null {
  const data = peekPendingLevelUp();
  if (data) sessionStorage.removeItem(LEVEL_UP_KEY);
  return data;
}

type AudioSessionLike = {
  type: string;
};

/**
 * Configure audio session on iOS/Android WebKit.
 * Setting `type = "playback"` prevents the OS from muting web audio
 * during phone/VoIP calls and bypasses the physical hardware silent switch!
 */
function configureAudioSession() {
  if (typeof navigator === "undefined") return;
  try {
    const nav = navigator as Navigator & { audioSession?: AudioSessionLike };
    if (nav.audioSession) {
      nav.audioSession.type = "playback";
    }
  } catch {
    /* not supported */
  }
}

let audioCtx: AudioContext | null = null;
const buffers = new Map<GameSoundKind, AudioBuffer>();
const customSfxBuffers = new Map<GameSoundKind, AudioBuffer>();
const customSfxUrls = new Map<GameSoundKind, string>();
const missingSfx = new Set<GameSoundKind>();
const missingMusic = new Set<string>();
let preloadPromise: Promise<void> | null = null;
const htmlKeepAlive: HTMLAudioElement[] = [];

type MusicClip = { key: string; src: string };
let customMusicClips: MusicClip[] = [];
const customMusicUrls = new Map<string, string>();
let customSfxKey = "";
let customMusicKey = "";
let customLoadPromise: Promise<void> | null = null;

let musicEl: HTMLAudioElement | null = null;
let musicQueue: string[] = [];
let lastMusicFile: string | null = null;
let musicWanted = false;
let musicListenersBound = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  configureAudioSession();
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    try {
      audioCtx = new Ctx({ latencyHint: "interactive" });
    } catch {
      audioCtx = new Ctx();
    }

    // Attach state listener to resume audio if interrupted by incoming/outgoing phone calls
    try {
      audioCtx.onstatechange = () => {
        if (audioCtx && (audioCtx.state === "suspended" || (audioCtx.state as string) === "interrupted")) {
          // Attempt auto-resume
          void audioCtx.resume().catch(() => {});
        }
      };
    } catch {
      /* ignore */
    }
  }
  return audioCtx;
}

/**
 * Synthetic Web Audio Fallback:
 * If an audio file is missing (404), fails to decode, or is still downloading,
 * this generates an instant, pleasing chime tone so that sound triggers NEVER fail silently.
 */
function playSyntheticFallback(kind: GameSoundKind) {
  const ctx = getAudioContext();
  const level = sfxOutputLevel();
  if (!ctx || level <= 0) return;
  try {
    if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
      void ctx.resume();
    }
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.25) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + start);
      g.gain.setValueAtTime(gain * level, now + start);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur);
    };

    switch (kind) {
      case "correct":
        // Two-tone pleasant major third
        playTone(523.25, 0.0, 0.12, "sine", 0.3);
        playTone(659.25, 0.1, 0.25, "sine", 0.3);
        break;
      case "wrong":
        // Low buzzy chime
        playTone(220, 0.0, 0.15, "triangle", 0.35);
        playTone(174.61, 0.12, 0.25, "sawtooth", 0.2);
        break;
      case "sessionEnd":
        // Celebratory harmonic chord
        playTone(523.25, 0.0, 0.4, "sine", 0.25);
        playTone(659.25, 0.08, 0.45, "sine", 0.25);
        playTone(783.99, 0.16, 0.5, "sine", 0.25);
        playTone(1046.5, 0.24, 0.6, "sine", 0.25);
        break;
      case "startSession":
        // Upbeat ascending chime
        playTone(440, 0.0, 0.1, "sine", 0.25);
        playTone(554.37, 0.08, 0.12, "sine", 0.25);
        playTone(659.25, 0.16, 0.25, "sine", 0.3);
        break;
      case "tap":
        // Subtle clean 25ms pop
        playTone(800, 0.0, 0.025, "sine", 0.15);
        break;
      case "levelUp":
        // Triumphant fanfare
        playTone(523.25, 0.0, 0.18, "sine", 0.3);
        playTone(659.25, 0.14, 0.22, "sine", 0.3);
        playTone(783.99, 0.28, 0.25, "sine", 0.3);
        playTone(1046.5, 0.42, 0.6, "triangle", 0.35);
        break;
      case "coinSpend":
        // Crisp metallic double chime
        playTone(1174.66, 0.0, 0.12, "sine", 0.3);
        playTone(1760.0, 0.08, 0.25, "sine", 0.25);
        break;
      case "confirm":
        // Smooth affirmative swipe pulse
        playTone(587.33, 0.0, 0.12, "sine", 0.25);
        playTone(880.0, 0.08, 0.22, "sine", 0.3);
        break;
    }
  } catch {
    /* ignore fallback errors */
  }
}

function keepHtmlAlive(el: HTMLAudioElement) {
  htmlKeepAlive.push(el);
  if (htmlKeepAlive.length > 10) htmlKeepAlive.shift();
}

function playHtmlFallback(kind: GameSoundKind) {
  const level = sfxOutputLevel();
  if (level <= 0) return;
  const customSrc = customSfxUrls.get(kind);
  if (!customSrc && missingSfx.has(kind)) {
    playSyntheticFallback(kind);
    return;
  }
  const el = new Audio(customSrc ?? GAME_SOUND_URLS[kind]);
  el.preload = "auto";
  el.volume = level;
  el.setAttribute("playsinline", "true");
  el.setAttribute("webkit-playsinline", "true");
  configureAudioSession();
  keepHtmlAlive(el);
  el.play().catch(() => {
    if (!customSrc) playSyntheticFallback(kind);
  });
}

function playBuffer(kind: GameSoundKind): boolean {
  const ctx = getAudioContext();
  const level = sfxOutputLevel();
  const buffer = customSfxBuffers.get(kind) ?? buffers.get(kind);
  if (!ctx || !buffer || level <= 0) return false;
  try {
    if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
      void ctx.resume();
    }
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = level;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
    return true;
  } catch {
    return false;
  }
}

async function decodeKind(ctx: AudioContext, kind: GameSoundKind) {
  if (buffers.has(kind) || missingSfx.has(kind)) return;
  try {
    const res = await fetch(GAME_SOUND_URLS[kind], { cache: "force-cache" });
    if (!res.ok) {
      missingSfx.add(kind);
      return;
    }
    const raw = await res.arrayBuffer();
    const decoded = await ctx.decodeAudioData(raw.slice(0));
    buffers.set(kind, decoded);
  } catch {
    missingSfx.add(kind);
  }
}

async function decodeAll(ctx: AudioContext) {
  await Promise.all((Object.keys(GAME_SOUND_FILES) as GameSoundKind[]).map((kind) => decodeKind(ctx, kind)));
}

export function unlockGameSounds() {
  configureAudioSession();
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
    void ctx.resume();
  }
  try {
    const silent = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = silent;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    /* ignore */
  }
  void preloadGameSounds();
  applySoundEngineFromSettings();
}

export function preloadGameSounds(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (preloadPromise) return preloadPromise;
  const ctx = getAudioContext();
  if (!ctx) return Promise.resolve();
  preloadPromise = decodeAll(ctx).catch(() => {
    preloadPromise = null;
  });
  return preloadPromise ?? Promise.resolve();
}

async function decodeBlob(ctx: AudioContext, blob: Blob) {
  const raw = await blob.arrayBuffer();
  return ctx.decodeAudioData(raw.slice(0));
}

async function loadCustomAudioAssets() {
  if (typeof window === "undefined") return;
  if (customLoadPromise) await customLoadPromise.catch(() => {});
  customLoadPromise = (async () => {
    const [overrides, tracks] = await Promise.all([
      listCustomSfxOverrides(),
      listCustomHomeTracks(),
    ]);
    const sfxKey = overrides.map((o) => `${o.kind}:${o.name}:${o.blob.size}`).join("|");
    const musicKey = tracks.map((t) => `${t.id}:${t.blob.size}`).join("|");
    const ctx = getAudioContext();

    if (sfxKey !== customSfxKey) {
      customSfxKey = sfxKey;
      customSfxBuffers.clear();
      for (const url of customSfxUrls.values()) URL.revokeObjectURL(url);
      customSfxUrls.clear();
      for (const row of overrides) {
        const kind = row.kind as GameSoundKind;
        if (!(kind in GAME_SOUND_FILES)) continue;
        customSfxUrls.set(kind, URL.createObjectURL(row.blob));
        if (!ctx) continue;
        try {
          customSfxBuffers.set(kind, await decodeBlob(ctx, row.blob));
        } catch {
          /* HTML fallback uses the object URL */
        }
      }
    }

    if (musicKey !== customMusicKey) {
      customMusicKey = musicKey;
      for (const url of customMusicUrls.values()) URL.revokeObjectURL(url);
      customMusicUrls.clear();
      customMusicClips = tracks.map((t: CustomHomeTrack) => {
        const src = URL.createObjectURL(t.blob);
        customMusicUrls.set(t.id, src);
        return { key: t.id, src };
      });
      musicQueue = [];
    }
  })().finally(() => {
    customLoadPromise = null;
  });
  return customLoadPromise;
}

function play(kind: GameSoundKind, waitForBuffer = false) {
  if (typeof window === "undefined") return;
  if (sfxOutputLevel() <= 0) return;

  const run = async () => {
    configureAudioSession();
    const ctx = getAudioContext();
    await loadCustomAudioAssets();
    if (waitForBuffer) await preloadGameSounds();
    else void preloadGameSounds();

    if (ctx && (ctx.state === "suspended" || (ctx.state as string) === "interrupted")) {
      try {
        await ctx.resume();
      } catch {
        /* autoplay / call interruption */
      }
    }

    if (playBuffer(kind)) return;
    if (!missingSfx.has(kind)) {
      playHtmlFallback(kind);
      return;
    }
    playSyntheticFallback(kind);
  };

  void run();
}

export function playCorrectSound() {
  play("correct");
}

export function playWrongSound() {
  play("wrong");
}

export function playSessionEndSound() {
  play("sessionEnd", true);
}

export function playStartSessionSound() {
  play("startSession");
}

export function playTapSound() {
  play("tap");
}

export function playLevelUpSound() {
  play("levelUp", true);
}

export function playCoinSpendSound() {
  play("coinSpend");
}

export function playConfirmSound() {
  play("confirm");
}

export function playAnswerSound(isCorrect: boolean) {
  if (isCorrect) playCorrectSound();
  else playWrongSound();
}

export function playSoundKind(kind: GameSoundKind) {
  play(kind);
}

function availableMusicClips(): MusicClip[] {
  const builtin = HOME_MUSIC_FILES.map((f) => f.trim())
    .filter((f) => f.length > 0 && !missingMusic.has(f) && isBuiltinTrackEnabled(f))
    .map((f) => ({ key: f, src: gameSoundUrl(f) }));
  return [...builtin, ...customMusicClips];
}

function clipSrc(key: string) {
  return availableMusicClips().find((c) => c.key === key)?.src ?? gameSoundUrl(key);
}

function liveMusicVolume() {
  return musicOutputLevel() * HOME_MUSIC_VOLUME;
}

function shouldMusicPlayNow() {
  return musicWanted && liveMusicVolume() > 0;
}

/**
 * Fisher-Yates shuffle with cross-boundary repeat prevention:
 * Ensures all songs play through in a random cycle before repeating,
 * and the first track of a new cycle is not identical to the last track played!
 */
function shuffleBag(items: string[], avoidFirst: string | null) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  if (avoidFirst && arr.length > 1 && arr[0] === avoidFirst) {
    const swapWith = 1 + Math.floor(Math.random() * (arr.length - 1));
    [arr[0], arr[swapWith]] = [arr[swapWith], arr[0]];
  }
  return arr;
}

function takeNextMusicFile(): string | null {
  const available = availableMusicClips().map((c) => c.key);
  if (available.length === 0) return null;
  musicQueue = musicQueue.filter((key) => available.includes(key));
  if (musicQueue.length === 0) {
    musicQueue = shuffleBag(available, lastMusicFile);
  }
  const next = musicQueue.shift() ?? null;
  if (next) lastMusicFile = next;
  return next;
}

function getMusicElement() {
  if (typeof window === "undefined") return null;
  if (!musicEl) {
    musicEl = new Audio();
    musicEl.preload = "auto";
    musicEl.loop = false;
    musicEl.volume = liveMusicVolume();
    musicEl.setAttribute("playsinline", "true");
    musicEl.setAttribute("webkit-playsinline", "true");
  }
  if (!musicListenersBound && musicEl) {
    musicListenersBound = true;
    musicEl.addEventListener("ended", () => {
      if (shouldMusicPlayNow()) playNextHomeTrack();
    });
    musicEl.addEventListener("error", () => {
      const current = musicEl?.getAttribute("data-file");
      if (current && !current.startsWith("custom_")) missingMusic.add(current);
      if (shouldMusicPlayNow()) playNextHomeTrack();
    });
  }
  return musicEl;
}

function playNextHomeTrack() {
  const el = getMusicElement();
  if (!el || !shouldMusicPlayNow()) return;
  const file = takeNextMusicFile();
  if (!file) return;
  el.setAttribute("data-file", file);
  el.src = clipSrc(file);
  el.volume = liveMusicVolume();
  configureAudioSession();
  void el.play().catch(() => {
    /* Autoplay unlocked on first gesture via unlockGameSounds() */
  });
}

async function ensureHomeMusicPlaying() {
  if (!shouldMusicPlayNow()) {
    musicEl?.pause();
    return;
  }
  await loadCustomAudioAssets();
  const el = getMusicElement();
  if (!el) return;
  configureAudioSession();
  el.volume = liveMusicVolume();
  if (el.src && !el.paused) return;
  if (el.src && el.paused && el.currentTime > 0) {
    try {
      await el.play();
      return;
    } catch {
      /* start a fresh track */
    }
  }
  playNextHomeTrack();
}

export function applySoundEngineFromSettings() {
  return loadCustomAudioAssets().then(() => {
    if (musicEl) musicEl.volume = liveMusicVolume();
    if (!shouldMusicPlayNow()) {
      musicEl?.pause();
      return;
    }
    void ensureHomeMusicPlaying();
  });
}

if (typeof window !== "undefined") {
  subscribeSoundSettings(() => {
    void applySoundEngineFromSettings();
  });
}

export function setHomeMusicEnabled(enabled: boolean) {
  musicWanted = enabled;
  applySoundEngineFromSettings();
}

export function isActiveQuizPath(pathname: string) {
  return pathname.startsWith("/session/play") || pathname.startsWith("/session/redo");
}

/**
 * Background home music rules:
 * - Plays when on Home or other non-session pages
 * - Strictly PAUSES whenever inside any session path (/session/*)
 * - Also paused on admin or login/register pages
 */
export function shouldPlayHomeMusic(pathname: string) {
  if (pathname.startsWith("/session")) return false;
  if (pathname.startsWith("/admin")) return false;
  if (pathname === "/login" || pathname === "/register") return false;
  return true;
}

const TAP_SELECTOR = "button, a[href], [role='button'], summary, input[type='button'], input[type='submit'], [data-clickable='true']";
let lastTapAt = 0;

export function handleGlobalTap(event: MouseEvent) {
  if (typeof window === "undefined") return;
  if (event.button != null && event.button !== 0) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const el = target.closest(TAP_SELECTOR);
  if (!(el instanceof HTMLElement)) return;
  if (el.closest("[disabled], [aria-disabled='true']")) return;
  const sfx = el.getAttribute("data-sfx");
  if (sfx === "none" || sfx === "start" || sfx === "confirm") return;
  const now = Date.now();
  if (now - lastTapAt < 65) return;
  lastTapAt = now;
  playTapSound();
}

export function useGameSounds() {
  useEffect(() => {
    preloadGameSounds();
    const onGesture = () => unlockGameSounds();
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, []);
}
