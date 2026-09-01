"use client";

import { useEffect } from "react";

/**
 * Session SFX that must fire on every correct/wrong answer and at session end.
 *
 * A single HTMLAudioElement is not reliable: resetting currentTime and calling
 * play() while a previous play() is pending aborts the new sound (common when
 * questions advance quickly). Navigating away also stops element-owned audio.
 *
 * This module keeps one AudioContext (survives route changes) and starts a new
 * BufferSource for every play so overlapping answers never cancel each other.
 */

export const GAME_SOUND_URLS = {
  correct: "/game_sounds/correct_answer.mp3",
  wrong: "/game_sounds/wrong_answers.mp3",
  sessionEnd: "/game_sounds/sessionend.mp3",
} as const;

export type GameSoundKind = keyof typeof GAME_SOUND_URLS;

let audioCtx: AudioContext | null = null;
const buffers = new Map<GameSoundKind, AudioBuffer>();
let preloadPromise: Promise<void> | null = null;
const htmlKeepAlive: HTMLAudioElement[] = [];

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function keepHtmlAlive(el: HTMLAudioElement) {
  htmlKeepAlive.push(el);
  if (htmlKeepAlive.length > 8) htmlKeepAlive.shift();
}

function playHtmlFallback(kind: GameSoundKind) {
  const el = new Audio(GAME_SOUND_URLS[kind]);
  el.preload = "auto";
  el.setAttribute("playsinline", "true");
  keepHtmlAlive(el);
  void el.play().catch(() => {
    /* autoplay still blocked — unlockGameSounds() on a click will enable later plays */
  });
}

function playBuffer(kind: GameSoundKind): boolean {
  const ctx = getAudioContext();
  const buffer = buffers.get(kind);
  if (!ctx || !buffer) return false;
  try {
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    return true;
  } catch {
    return false;
  }
}

async function decodeAll(ctx: AudioContext) {
  await Promise.all(
    (Object.keys(GAME_SOUND_URLS) as GameSoundKind[]).map(async (kind) => {
      if (buffers.has(kind)) return;
      const res = await fetch(GAME_SOUND_URLS[kind], { cache: "force-cache" });
      const raw = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(raw.slice(0));
      buffers.set(kind, decoded);
    })
  );
}

/** Call from a user gesture (Start / answer click) so the context is allowed to play. */
export function unlockGameSounds() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
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

function play(kind: GameSoundKind, waitForBuffer = false) {
  if (typeof window === "undefined") return;

  const run = async () => {
    const ctx = getAudioContext();
    if (waitForBuffer) await preloadGameSounds();
    else void preloadGameSounds();

    if (ctx?.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* autoplay policy */
      }
    }

    if (playBuffer(kind)) return;
    playHtmlFallback(kind);
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

export function playAnswerSound(isCorrect: boolean) {
  if (isCorrect) playCorrectSound();
  else playWrongSound();
}

/** Preload buffers and unlock on any tap/key so later timer-timeout SFX can play. */
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
