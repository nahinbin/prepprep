"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  X,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle2,
  Flame,
  Coffee,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { playCorrectSound, playTapSound, playSessionEndSound } from "@/lib/gameSounds";

interface FocusTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTitle?: string;
  initialSubject?: string;
  initialTopic?: string;
  defaultDurationMinutes?: number;
  onCompleteSession?: (studiedMinutes: number) => void;
}

export function FocusTimerModal({
  isOpen,
  onClose,
  initialTitle = "Deep Study Focus",
  initialSubject,
  initialTopic,
  defaultDurationMinutes = 25,
  onCompleteSession,
}: FocusTimerModalProps) {
  // Preset durations (e.g. 15m, 25m Pomodoro, 45m, 60m)
  const [selectedMinutes, setSelectedMinutes] = useState(defaultDurationMinutes);
  const [timeLeft, setTimeLeft] = useState(defaultDurationMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [ambientSound, setAmbientSound] = useState<"none" | "rain" | "waves" | "fire">("none");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [sessionsCompleted, setSessionsCompleted] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync initial duration when opened or preset changes
  useEffect(() => {
    if (isOpen) {
      const mins = defaultDurationMinutes || 25;
      setSelectedMinutes(mins);
      setTimeLeft(mins * 60);
      setIsRunning(false);
    }
  }, [isOpen, defaultDurationMinutes]);

  // Handle countdown interval
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setIsRunning(false);
            try {
              playSessionEndSound();
            } catch {}

            if (mode === "focus") {
              setSessionsCompleted((s) => s + 1);
              if (onCompleteSession) {
                onCompleteSession(selectedMinutes);
              }
              // Switch to 5-min short break
              setMode("break");
              return 5 * 60;
            } else {
              // Break finished, reset to focus
              setMode("focus");
              return selectedMinutes * 60;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, mode, selectedMinutes, onCompleteSession]);

  // Ambient sound synthesizer / Web Audio noise generator for true zero-dependency offline audio
  const audioContextRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioNode | null>(null);

  const stopAmbient = useCallback(() => {
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setAmbientSound("none");
  }, []);

  const startAmbient = useCallback((type: "rain" | "waves" | "fire") => {
    stopAmbient();
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      // Pink noise / smooth brown noise buffer
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brown noise filter
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const gain = ctx.createGain();
      gain.gain.value = type === "rain" ? 0.08 : type === "waves" ? 0.05 : 0.04;

      const filter = ctx.createBiquadFilter();
      filter.type = type === "rain" ? "lowpass" : "bandpass";
      filter.frequency.value = type === "rain" ? 800 : type === "waves" ? 400 : 600;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(0);

      noiseNodeRef.current = noise;
      setAmbientSound(type);
    } catch {
      setAmbientSound("none");
    }
  }, [stopAmbient]);

  // Toggle ambient on/off
  const toggleAmbient = () => {
    if (ambientSound !== "none") {
      stopAmbient();
    } else {
      startAmbient("rain");
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const totalCurrentDuration = mode === "focus" ? selectedMinutes * 60 : 5 * 60;
  const progressPercent = Math.max(0, Math.min(100, ((totalCurrentDuration - timeLeft) / totalCurrentDuration) * 100));

  const handlePresetSelect = (mins: number) => {
    setSelectedMinutes(mins);
    setTimeLeft(mins * 60);
    setIsRunning(false);
    try {
      playTapSound();
    } catch {}
  };

  const handleTogglePlay = () => {
    try {
      playTapSound();
    } catch {}
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    try {
      playTapSound();
    } catch {}
    setIsRunning(false);
    setTimeLeft(selectedMinutes * 60);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl text-white select-none animate-in fade-in duration-200">
      {/* Top Floating Controls */}
      <div className="absolute top-4 sm:top-6 left-4 sm:left-6 right-4 sm:right-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          {/* Mode Pill */}
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
              mode === "focus"
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                : "bg-amber-500/15 border border-amber-500/30 text-amber-400"
            }`}
          >
            {mode === "focus" ? (
              <>
                <Flame className="w-3.5 h-3.5 fill-current" />
                <span>Deep Focus</span>
              </>
            ) : (
              <>
                <Coffee className="w-3.5 h-3.5" />
                <span>Rest Break</span>
              </>
            )}
          </div>

          {sessionsCompleted > 0 && (
            <div className="hidden sm:flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-neutral-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{sessionsCompleted} completed</span>
            </div>
          )}
        </div>

        {/* Ambient audio & Window controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleAmbient}
            className={`h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-medium transition-colors ${
              ambientSound !== "none"
                ? "bg-violet-600/20 border-violet-500/40 text-violet-300"
                : "bg-white/5 border-white/10 text-neutral-400 hover:text-white"
            }`}
            title="Toggle soothing rain background noise"
          >
            {ambientSound !== "none" ? (
              <Volume2 className="w-4 h-4 text-violet-400 animate-pulse" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Rain Sound</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
            title="Toggle fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              stopAmbient();
              onClose();
            }}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-300 text-neutral-400 flex items-center justify-center transition-colors"
            title="Exit focus timer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Focus Viewport */}
      <div className="flex flex-col items-center justify-center w-full max-w-2xl px-6 py-12 text-center space-y-8 sm:space-y-12">
        {/* Subject & Topic Banner */}
        <div className="space-y-2 max-w-lg">
          <span className="text-xs font-bold uppercase tracking-widest text-violet-400/90 inline-block px-3 py-0.5 rounded-full bg-violet-950/40 border border-violet-500/20">
            {initialSubject || "Focus Session"}
          </span>
          <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight">
            {initialTopic || initialTitle}
          </h2>
        </div>

        {/* Giant Thick Digital Timer Display */}
        <div className="relative flex flex-col items-center justify-center">
          {/* Subtle Ambient Radial Glow */}
          <div
            className={`absolute -inset-10 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-700 ${
              mode === "focus"
                ? isRunning
                  ? "bg-emerald-500"
                  : "bg-violet-600"
                : "bg-amber-500"
            }`}
          />

          {/* Time digits - Bold, Thick, Massive typography on Desktop */}
          <div className="relative font-mono font-black text-7xl sm:text-9xl md:text-[11rem] tracking-tighter tabular-nums text-white drop-shadow-2xl">
            {timeFormatted}
          </div>

          {/* Progress Bar Line */}
          <div className="w-64 sm:w-80 h-1.5 rounded-full bg-white/10 overflow-hidden mt-2">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                mode === "focus" ? "bg-emerald-400" : "bg-amber-400"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Controls: Big Play/Pause & Reset */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleTogglePlay}
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all shadow-2xl active:scale-95 ${
              isRunning
                ? "bg-neutral-800 border-2 border-white/20 text-white hover:bg-neutral-700 hover:scale-105"
                : "bg-white text-black hover:bg-neutral-200 hover:scale-105 shadow-emerald-500/20"
            }`}
            aria-label={isRunning ? "Pause timer" : "Start timer"}
          >
            {isRunning ? (
              <Pause className="w-8 h-8 sm:w-10 sm:h-10 fill-current" />
            ) : (
              <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-1" />
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/5 border border-white/10 hover:bg-white/15 text-neutral-300 hover:text-white flex items-center justify-center transition-all active:scale-90"
            title="Reset timer"
            aria-label="Reset timer"
          >
            <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Duration Presets (Only clickable when paused in focus mode) */}
        {mode === "focus" && (
          <div className="flex items-center gap-2 flex-wrap justify-center pt-2">
            {[15, 25, 45, 60].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => handlePresetSelect(mins)}
                disabled={isRunning}
                className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
                  selectedMinutes === mins
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                    : "bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 disabled:opacity-40"
                }`}
              >
                {mins} min
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Motivational Forest-Style Footer Quote */}
      <div className="absolute bottom-6 left-6 right-6 text-center pointer-events-none">
        <p className="text-xs text-neutral-400 font-medium tracking-wide">
          {isRunning
            ? "Stay present. Consistency turns small sprints into mastery."
            : "Press play to start your focus sprint. Turn off distractions."}
        </p>
      </div>
    </div>
  );
}
