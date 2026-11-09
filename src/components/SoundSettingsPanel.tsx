"use client";

import { useEffect, useRef, useState } from "react";
import {
  Music,
  Pause,
  Play,
  Upload,
  Trash2,
  Volume2,
  VolumeX,
  RotateCcw,
  Sliders,
  Sparkles,
  Database,
  CheckCircle2,
  Square,
} from "lucide-react";
import {
  GAME_SOUND_LABELS,
  gameSoundUrl,
  type GameSoundKind,
} from "@/lib/soundAssets";
import {
  addCustomHomeTrack,
  clearCustomSfx,
  getSoundSettings,
  isBuiltinTrackEnabled,
  listCustomHomeTracks,
  listCustomSfxOverrides,
  patchSoundSettings,
  removeCustomHomeTrack,
  setCustomSfx,
  soundFileLabel,
  subscribeSoundSettings,
  toggleMuted,
  builtinHomeTracks,
  type CustomHomeTrack,
  type CustomSfxOverride,
  type SoundSettings,
} from "@/lib/soundSettings";
import {
  applySoundEngineFromSettings,
  playSoundKind,
  playTapSound,
} from "@/lib/gameSounds";
import WakeSlider from "@/components/ui/WakeSlider";

const SFX_CONFIG: { kind: GameSoundKind; label: string; desc: string }[] = [
  {
    kind: "tap",
    label: "Tap Sound",
    desc: "Plays when touching buttons, cards, and navigating tabs.",
  },
  {
    kind: "correct",
    label: "Correct Answer",
    desc: "Plays when picking the right answer in quizzes.",
  },
  {
    kind: "wrong",
    label: "Wrong Answer",
    desc: "Plays when an answer is incorrect.",
  },
  {
    kind: "startSession",
    label: "Quiz Start",
    desc: "Plays when launching a new quiz session.",
  },
  {
    kind: "sessionEnd",
    label: "Session Finished",
    desc: "Celebratory chime when completing a quiz.",
  },
  {
    kind: "levelUp",
    label: "Level Up Fanfare",
    desc: "Plays when you reach a new level.",
  },
  {
    kind: "confirm",
    label: "Confirm Action",
    desc: "Plays when saving changes or confirming choices.",
  },
  {
    kind: "coinSpend",
    label: "Coin Spend",
    desc: "Plays when spending coins in the reward store.",
  },
];

function pct(n: number) {
  return Math.round(n * 100);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SoundSettingsPanel() {
  const [settings, setSettings] = useState<SoundSettings>(getSoundSettings);
  const [customTracks, setCustomTracks] = useState<CustomHomeTrack[]>([]);
  const [sfxOverrides, setSfxOverrides] = useState<CustomSfxOverride[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewTrackKey, setPreviewTrackKey] = useState<string | null>(null);

  const musicInputRef = useRef<HTMLInputElement>(null);
  const sfxInputRef = useRef<HTMLInputElement>(null);
  const pendingSfxKind = useRef<GameSoundKind | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  async function refreshLibrary() {
    const [tracks, overrides] = await Promise.all([
      listCustomHomeTracks(),
      listCustomSfxOverrides(),
    ]);
    setCustomTracks(tracks);
    setSfxOverrides(overrides);
    await applySoundEngineFromSettings();
  }

  useEffect(() => {
    let active = true;
    Promise.all([listCustomHomeTracks(), listCustomSfxOverrides()]).then(([tracks, overrides]) => {
      if (active) {
        setCustomTracks(tracks);
        setSfxOverrides(overrides);
        void applySoundEngineFromSettings();
      }
    });

    const unsub = subscribeSoundSettings(() => {
      setSettings(getSoundSettings());
      void applySoundEngineFromSettings();
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  // Cleanup preview audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  function flashSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg((curr) => (curr === msg ? null : curr));
    }, 3000);
  }

  function update(partial: Partial<SoundSettings>) {
    setSettings(patchSoundSettings(partial));
  }

  function handleToggleMute() {
    const next = toggleMuted();
    setSettings(next);
    if (!next.muted) {
      playTapSound();
      flashSuccess("Sound unmuted (Saved to local database)");
    } else {
      stopPreview();
      flashSuccess("Sound muted (Saved to local database)");
    }
  }

  function stopPreview() {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setPreviewTrackKey(null);
  }

  function togglePreviewTrack(key: string, url: string) {
    if (previewTrackKey === key) {
      stopPreview();
      return;
    }
    stopPreview();

    const audio = new Audio(url);
    const volume = settings.muted ? 0 : settings.masterVolume * settings.musicVolume;
    audio.volume = Math.max(0.1, volume);
    audio.play().then(() => {
      previewAudioRef.current = audio;
      setPreviewTrackKey(key);
    }).catch(() => {
      stopPreview();
    });

    audio.onended = () => stopPreview();
    audio.onerror = () => stopPreview();
  }

  async function onAddMusic(fileList: FileList | null) {
    if (!fileList?.length) return;
    setBusy(true);
    setError(null);
    let count = 0;
    for (const file of Array.from(fileList)) {
      const result = await addCustomHomeTrack(file);
      if (result.error) {
        setError(result.error);
        break;
      }
      count++;
    }
    await refreshLibrary();
    setBusy(false);
    if (count > 0) {
      flashSuccess(`Added ${count} song${count > 1 ? "s" : ""} to your local database!`);
    }
  }

  async function onAddSfx(fileList: FileList | null) {
    const kind = pendingSfxKind.current;
    pendingSfxKind.current = null;
    if (!kind || !fileList?.[0]) return;
    setBusy(true);
    setError(null);
    const file = fileList[0];
    const result = await setCustomSfx(kind, file);
    if (result.error) {
      setError(result.error);
    } else {
      flashSuccess(`Custom ${GAME_SOUND_LABELS[kind]} saved to local database!`);
    }
    await refreshLibrary();
    playSoundKind(kind);
    setBusy(false);
  }

  const muted = settings.muted;
  const masterPct = pct(settings.masterVolume);

  return (
    <div className="rounded-3xl bg-card border-2 border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-muted/30 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Volume2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
              Sound & Music Settings
            </h2>
            <p className="text-[11px] font-medium text-muted-foreground">
              Mute, volume percentage sliders & custom audio
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-xl">
          <Database className="w-3.5 h-3.5 text-primary" />
          <span>Local DB</span>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Success / Error notification alerts */}
        {successMsg && (
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/30 text-primary flex items-center gap-2 text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {error && (
          <div className="p-3 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-xs font-bold">
            {error}
          </div>
        )}

        {/* Top Primary Actions: Mute All Sound & Pause Music */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Master Mute Button */}
            <button
              type="button"
              data-sfx="none"
              onClick={handleToggleMute}
              className={`flex-1 min-h-[4rem] px-4 py-3 rounded-2xl font-black text-sm flex items-center justify-between gap-3 border-2 transition-all active:scale-[0.98] ${
                muted
                  ? "bg-danger/15 border-danger/40 text-danger hover:bg-danger/20 shadow-md shadow-danger/10"
                  : "bg-primary/15 border-primary/40 text-primary hover:bg-primary/20 shadow-md shadow-primary/10"
              }`}
            >
              <div className="flex items-center gap-3 text-left">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    muted ? "bg-danger/20" : "bg-primary/20"
                  }`}
                >
                  {muted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                </div>
                <div>
                  <p className="font-black text-base leading-tight">
                    {muted ? "Unmute All Sound" : "Mute All Sound"}
                  </p>
                  <p className="text-[11px] font-semibold opacity-85">
                    {muted ? "All audio is currently silenced" : "Click to silence all sounds"}
                  </p>
                </div>
              </div>
              <span
                className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-lg ${
                  muted ? "bg-danger text-white" : "bg-primary text-primary-foreground"
                }`}
              >
                {muted ? "MUTED" : "ACTIVE"}
              </span>
            </button>

            {/* Pause / Play Background Music Button */}
            <button
              type="button"
              data-sfx="none"
              onClick={() => {
                const nextPaused = !settings.musicPaused;
                update({ musicPaused: nextPaused });
                flashSuccess(
                  nextPaused
                    ? "Background music paused"
                    : "Background music resumed"
                );
              }}
              className={`sm:w-56 min-h-[4rem] px-4 py-3 rounded-2xl font-black text-sm flex items-center justify-between gap-3 border-2 transition-all active:scale-[0.98] ${
                settings.musicPaused
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-500 hover:bg-amber-500/20"
                  : "bg-muted/40 border-border text-foreground hover:bg-muted/60"
              }`}
            >
              <div className="flex items-center gap-3 text-left">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    settings.musicPaused ? "bg-amber-500/20" : "bg-muted"
                  }`}
                >
                  {settings.musicPaused ? (
                    <Play className="w-5 h-5 fill-current" />
                  ) : (
                    <Pause className="w-5 h-5 fill-current" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-sm leading-tight">
                    {settings.musicPaused ? "Resume Music" : "Pause Music"}
                  </p>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Background track
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-background/80 text-muted-foreground">
                {settings.musicPaused ? "Paused" : "Playing"}
              </span>
            </button>
          </div>

          <p className="text-[11px] font-medium text-muted-foreground px-1">
            Mute state is saved permanently in your local database on this device.
          </p>
        </div>

        {/* Volume Sliders with Percentage Display & Quick Presets */}
        <div className="rounded-2xl border border-border/80 bg-muted/15 p-4 space-y-5">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
              Volume Sliders & Controls
            </h3>
          </div>

          {/* Master Volume */}
          <VolumeSliderWithPresets
            label="Master Volume"
            description="Controls overall volume for all music and tap sounds"
            value={settings.masterVolume}
            disabled={muted}
            onChange={(val) => update({ masterVolume: val })}
          />

          {/* Background Music Volume */}
          <VolumeSliderWithPresets
            label="Background Music"
            description="Loudness of menu and background ambient tracks"
            value={settings.musicVolume}
            disabled={muted || !settings.musicEnabled || settings.musicPaused}
            onChange={(val) => update({ musicVolume: val })}
          />

          {/* Tap & Sound Effects Volume */}
          <VolumeSliderWithPresets
            label="Tap & Sound Effects"
            description="Loudness of button taps, correct/wrong answers and chimes"
            value={settings.sfxVolume}
            disabled={muted || !settings.sfxEnabled}
            onChange={(val) => {
              update({ sfxVolume: val });
              playTapSound();
            }}
          />

          {/* Individual Sound Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-border/50">
            <ToggleRow
              label="Background Music"
              sub="Play music outside quiz sessions"
              on={settings.musicEnabled}
              disabled={muted}
              onToggle={() => update({ musicEnabled: !settings.musicEnabled })}
            />
            <ToggleRow
              label="Tap & Game Sounds"
              sub="Play sounds on tap & answers"
              on={settings.sfxEnabled}
              disabled={muted}
              onToggle={() => update({ sfxEnabled: !settings.sfxEnabled })}
            />
          </div>
        </div>

        {/* Background Music Library (Local Database & Uploads) */}
        <div className="rounded-2xl border border-border/80 bg-muted/15 p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-black text-foreground">
                  Background Music Tracks
                </h3>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                Add songs from your gallery, audio files, or music downloads. Saved in your local device database only.
              </p>
            </div>

            <button
              type="button"
              data-sfx="none"
              disabled={busy}
              onClick={() => musicInputRef.current?.click()}
              className="h-10 px-3.5 rounded-xl bg-primary text-primary-foreground text-xs font-black inline-flex items-center gap-1.5 active:scale-95 disabled:opacity-60 shadow-sm shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span>Add Music</span>
            </button>
            <input
              ref={musicInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm"
              multiple
              className="hidden"
              onChange={(e) => {
                void onAddMusic(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Built-in Music Tracks
            </p>
            <ul className="space-y-1.5">
              {builtinHomeTracks().map((file) => {
                const on = isBuiltinTrackEnabled(file, settings);
                const isPreviewing = previewTrackKey === file;
                return (
                  <li
                    key={file}
                    className="flex items-center justify-between gap-2 rounded-xl bg-background/80 border border-border/60 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        data-sfx="none"
                        title={isPreviewing ? "Stop Preview" : "Preview Track"}
                        onClick={() => togglePreviewTrack(file, gameSoundUrl(file))}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isPreviewing
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground hover:bg-muted/80"
                        }`}
                      >
                        {isPreviewing ? (
                          <Square className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        )}
                      </button>
                      <span className="text-sm font-bold truncate">
                        {soundFileLabel(file)}
                      </span>
                    </div>

                    <button
                      type="button"
                      data-sfx="none"
                      onClick={() => {
                        const disabled = new Set(settings.disabledHomeTracks);
                        if (on) disabled.add(file);
                        else disabled.delete(file);
                        update({ disabledHomeTracks: [...disabled] });
                      }}
                      className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-lg transition-colors ${
                        on
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {on ? "Enabled" : "Disabled"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Custom Uploaded Music Tracks */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Your Custom Music ({customTracks.length})
              </p>
              <span className="text-[10px] font-bold text-muted-foreground">
                IndexedDB Local Database
              </span>
            </div>

            {customTracks.length === 0 ? (
              <div className="p-4 rounded-xl bg-background/40 border border-dashed border-border text-center">
                <Music className="w-6 h-6 text-muted-foreground/50 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-muted-foreground">
                  No custom music added yet
                </p>
                <p className="text-[11px] text-muted-foreground/70">
                  Tap &quot;Add Music&quot; above to select MP3s or songs from your device!
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {customTracks.map((track) => {
                  const isPreviewing = previewTrackKey === track.id;
                  const trackUrl = URL.createObjectURL(track.blob);
                  return (
                    <li
                      key={track.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-background/80 border border-border/60 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          data-sfx="none"
                          title={isPreviewing ? "Stop Preview" : "Preview Custom Song"}
                          onClick={() => togglePreviewTrack(track.id, trackUrl)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isPreviewing
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground hover:bg-muted/80"
                          }`}
                        >
                          {isPreviewing ? (
                            <Square className="w-3.5 h-3.5 fill-current" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate text-foreground">
                            {track.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatBytes(track.blob.size)} · Local DB
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        data-sfx="none"
                        aria-label={`Delete ${track.name}`}
                        title="Remove from local database"
                        onClick={() => {
                          if (previewTrackKey === track.id) stopPreview();
                          void removeCustomHomeTrack(track.id).then(() => {
                            refreshLibrary();
                            flashSuccess(`Removed "${track.name}"`);
                          });
                        }}
                        className="w-8 h-8 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Tap & Game Sounds Customization (Local Database Overrides) */}
        <div className="rounded-2xl border border-border/80 bg-muted/15 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-black text-foreground">
              Tap & Game Sound Customization
            </h3>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium pb-1">
            Replace the tap sound or any game chime with audio from your gallery or music. All overrides are saved to your local database.
          </p>

          <div className="divide-y divide-border/50">
            {SFX_CONFIG.map(({ kind, label, desc }) => {
              const custom = sfxOverrides.find((row) => row.kind === kind);
              return (
                <div
                  key={kind}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-foreground">{label}</p>
                      {custom ? (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-primary/20 text-primary border border-primary/30">
                          Custom Local
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium truncate max-w-sm">
                      {custom ? `Using file: ${custom.name}` : desc}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Test sound button */}
                    <button
                      type="button"
                      data-sfx="none"
                      onClick={() => playSoundKind(kind)}
                      className="h-8 px-3 rounded-xl bg-background border border-border text-xs font-bold hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors active:scale-95"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Test</span>
                    </button>

                    {/* Reset button if custom */}
                    {custom && (
                      <button
                        type="button"
                        data-sfx="none"
                        aria-label={`Reset ${label} to default`}
                        title="Restore original sound"
                        onClick={() => {
                          void clearCustomSfx(kind).then(() => {
                            refreshLibrary();
                            flashSuccess(`Restored default ${label}`);
                          });
                        }}
                        className="w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Change sound button */}
                    <button
                      type="button"
                      data-sfx="none"
                      disabled={busy}
                      onClick={() => {
                        pendingSfxKind.current = kind;
                        sfxInputRef.current?.click();
                      }}
                      className="h-8 px-3 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary text-xs font-black transition-colors active:scale-95"
                    >
                      {custom ? "Change" : "Customize"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <input
            ref={sfxInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm"
            className="hidden"
            onChange={(e) => {
              void onAddSfx(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* Local database guarantee note */}
        <div className="p-3 rounded-2xl bg-muted/30 border border-border/60 flex items-center gap-2.5 text-[11px] text-muted-foreground font-medium">
          <Database className="w-4 h-4 text-primary shrink-0" />
          <span>
            Current master volume: <strong className="text-foreground">{masterPct}%</strong>.
            All sound choices and custom audio files are saved securely in your browser&apos;s local IndexedDB database and are never uploaded to any remote server.
          </span>
        </div>
      </div>
    </div>
  );
}

function VolumeSliderWithPresets({
  label,
  description,
  value,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const currentPct = pct(value);
  const presets = [0, 25, 50, 75, 100];

  return (
    <div className={`space-y-2 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-bold text-foreground">{label}</span>
          {description && (
            <p className="text-[11px] text-muted-foreground font-medium">{description}</p>
          )}
        </div>
        <span className="text-sm font-black tabular-nums bg-card border border-border px-2.5 py-1 rounded-xl text-primary">
          {currentPct}%
        </span>
      </div>

      <div className="py-1">
        <WakeSlider
          value={currentPct}
          min={0}
          max={100}
          step={1}
          bars={32}
          height={38}
          restHeight={10}
          gap={3}
          fillColor="#8b5cf6"
          trackColor="#27272a"
          disabled={disabled}
          onChange={(val) => onChange(val / 100)}
        />
      </div>

      {/* Quick percentage buttons */}
      <div className="flex items-center justify-between gap-1 pt-0.5">
        {presets.map((p) => {
          const isActive = currentPct === p;
          return (
            <button
              key={p}
              type="button"
              data-sfx="none"
              disabled={disabled}
              onClick={() => onChange(p / 100)}
              className={`flex-1 py-1 rounded-lg text-[10px] font-black transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-background/80 hover:bg-muted text-muted-foreground border border-border/50"
              }`}
            >
              {p === 0 ? "0% (Mute)" : `${p}%`}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  sub,
  on,
  disabled,
  onToggle,
}: {
  label: string;
  sub?: string;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-sfx="none"
      disabled={disabled}
      onClick={onToggle}
      className={`flex items-center justify-between gap-2 rounded-2xl border border-border bg-background/60 p-3 text-left transition-colors ${
        disabled ? "opacity-50" : "hover:bg-muted/40"
      }`}
    >
      <div className="min-w-0">
        <span className="text-xs font-bold text-foreground block">{label}</span>
        {sub && <span className="text-[10px] text-muted-foreground block truncate">{sub}</span>}
      </div>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          on && !disabled ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            on && !disabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}
