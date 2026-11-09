"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Save,
  Check,
  CheckCheck,
  SlidersHorizontal,
  Bot,
  Plus,
  Trash2,
  Power,
  RotateCcw,
} from "lucide-react";
import { AppShell } from "@/components/NavMenu";
import {
  getAiPermanentNotes,
  setAiPermanentNotes,
  getAiAssistantName,
  setAiAssistantName,
  getRoutinePresets,
  togglePresetActive,
  saveCustomPreset,
  deleteCustomPreset,
} from "@/lib/routineStorage";
import { RoutinePreset, RoutinePresetBlock } from "@/lib/routineTypes";

export default function RoutineSettingsPage() {
  const router = useRouter();

  // 1. Notepad
  const [notepadText, setNotepadText] = useState(() => getAiPermanentNotes());
  const [notepadSaved, setNotepadSaved] = useState(false);

  // 2. AI Assistant Name
  const [aiName, setAiName] = useState(() => getAiAssistantName());
  const [aiNameSaved, setAiNameSaved] = useState(false);

  // 3. Presets
  const [presets, setPresets] = useState<RoutinePreset[]>(() => getRoutinePresets());
  const [showNewPresetModal, setShowNewPresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetDesc, setNewPresetDesc] = useState("");
  const [newPresetBlocks, setNewPresetBlocks] = useState<RoutinePresetBlock[]>([
    {
      type: "normal",
      title: "Wake up & Refresh",
      timeMode: "single",
      startTime: "07:00",
    },
    {
      type: "study",
      title: "Morning Study Sprint",
      subject: "Primary Subject",
      topic: "Core Concepts",
      timeMode: "range",
      startTime: "08:30",
      endTime: "11:00",
    },
    {
      type: "normal",
      title: "Lunch & Rest",
      timeMode: "range",
      startTime: "12:30",
      endTime: "13:30",
    },
    {
      type: "normal",
      title: "Sleep",
      timeMode: "single",
      startTime: "23:00",
    },
  ]);

  useEffect(() => {
    const onPresetsUpdated = () => setPresets(getRoutinePresets());
    window.addEventListener("routine-presets-updated", onPresetsUpdated);
    return () => window.removeEventListener("routine-presets-updated", onPresetsUpdated);
  }, []);

  const handleSaveNotepad = () => {
    setAiPermanentNotes(notepadText);
    setNotepadSaved(true);
    setTimeout(() => setNotepadSaved(false), 2000);
  };

  const handleSaveAiName = () => {
    setAiAssistantName(aiName);
    setAiNameSaved(true);
    setTimeout(() => setAiNameSaved(false), 2000);
  };

  const handleTogglePreset = (id: string) => {
    togglePresetActive(id);
    setPresets(getRoutinePresets());
  };

  const handleDeletePreset = (id: string) => {
    if (confirm("Delete this preset?")) {
      deleteCustomPreset(id);
      setPresets(getRoutinePresets());
    }
  };

  const handleCreatePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;

    const custom: RoutinePreset = {
      id: "preset_" + Date.now().toString(36),
      name: newPresetName.trim(),
      description: newPresetDesc.trim() || "Custom daily routine preset",
      isActive: true,
      isCustom: true,
      blocks: newPresetBlocks,
    };

    saveCustomPreset(custom);
    setPresets(getRoutinePresets());
    setShowNewPresetModal(false);
    setNewPresetName("");
    setNewPresetDesc("");
  };

  const handleAddBlockToNewPreset = (type: "normal" | "study") => {
    if (type === "study") {
      setNewPresetBlocks((prev) => [
        ...prev,
        {
          type: "study",
          title: "Study Block",
          subject: "Subject",
          topic: "Topic",
          timeMode: "range",
          startTime: "14:00",
          endTime: "16:00",
        },
      ]);
    } else {
      setNewPresetBlocks((prev) => [
        ...prev,
        {
          type: "normal",
          title: "Break / Activity",
          timeMode: "range",
          startTime: "16:00",
          endTime: "17:00",
        },
      ]);
    }
  };

  return (
    <AppShell showBottomBar={false}>
      <div className="w-full max-w-3xl mx-auto px-4 pt-4 pb-20 md:pt-8 md:pb-16 space-y-8 animate-in fade-in duration-150">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/routine")}
              className="w-10 h-10 rounded-2xl bg-card hover:bg-white/10 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all active:scale-95"
              aria-label="Back to Routine"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">
                Settings
              </h1>
              <p className="text-xs text-muted-foreground font-semibold">
                Manage your routine preferences, notepad, and presets
              </p>
            </div>
          </div>

          <Link
            href="/routine"
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-foreground transition-colors"
          >
            Done
          </Link>
        </div>

        {/* 1. Notepad (Requested by user: Just 'Notepad' with small text under) */}
        <section className="rounded-3xl bg-card border border-white/10 p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-lg font-black text-foreground">Notepad</h2>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Write everything here that AI might need to know about your timings, coaching days, or habits.
            </p>
          </div>

          <textarea
            rows={5}
            value={notepadText}
            onChange={(e) => setNotepadText(e.target.value)}
            placeholder="e.g. Coaching on Monday, Wednesday, and Friday from 2:30 PM to 5:00 PM. Target sleep by 11:00 PM..."
            className="w-full px-4 py-3 rounded-2xl bg-black/25 border border-white/10 text-foreground text-sm font-medium focus:outline-none focus:border-primary transition-all resize-none leading-relaxed"
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted-foreground">
              Automatically considered when generating daily schedules.
            </span>
            <button
              type="button"
              onClick={handleSaveNotepad}
              className="py-2.5 px-4 rounded-xl bg-primary hover:brightness-110 text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow-md shadow-primary/20 transition-all active:scale-95"
            >
              {notepadSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{notepadSaved ? "Saved!" : "Save Notepad"}</span>
            </button>
          </div>
        </section>

        {/* 2. Customizable AI Name */}
        <section className="rounded-3xl bg-card border border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                <h2 className="text-lg font-black text-foreground">AI Assistant Name</h2>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Give your study AI a nickname (e.g. Jarvis, Peggy, Friday). It will remember and introduce itself with this name.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={aiName}
              onChange={(e) => setAiName(e.target.value)}
              placeholder="e.g. Jarvis"
              maxLength={25}
              className="flex-1 px-4 py-2.5 rounded-xl bg-black/25 border border-white/10 text-foreground font-bold text-sm focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={handleSaveAiName}
              className="py-2.5 px-4 rounded-xl bg-primary hover:brightness-110 text-primary-foreground font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-primary/20"
            >
              {aiNameSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{aiNameSaved ? "Saved" : "Save"}</span>
            </button>
          </div>
        </section>

        {/* 3. Presets Manager (User request: activate/deactivate presets, create new ones) */}
        <section className="rounded-3xl bg-card border border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-violet-400" />
                <h2 className="text-lg font-black text-foreground">Presets</h2>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Activate or deactivate presets for different days (e.g. Exam sprint, Sick/Recovery day, No-coaching day).
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowNewPresetModal(true)}
              className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-foreground flex items-center gap-1.5 transition-all shrink-0 active:scale-95"
            >
              <Plus className="w-4 h-4 text-primary" />
              <span>New Preset</span>
            </button>
          </div>

          <div className="space-y-3 pt-1">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className={`p-4 rounded-2xl border transition-all ${
                  preset.isActive
                    ? "bg-violet-950/20 border-violet-500/30"
                    : "bg-white/5 border-white/5 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-foreground">
                        {preset.name}
                      </h4>
                      {preset.isActive ? (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {preset.description}
                    </p>
                    <span className="text-[11px] font-semibold text-muted-foreground/80 mt-1 block">
                      {preset.blocks.length} blocks ·{" "}
                      {preset.blocks.filter((b) => b.type === "study").length} study blocks
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTogglePreset(preset.id)}
                      className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all active:scale-90 ${
                        preset.isActive
                          ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                          : "bg-white/10 text-muted-foreground hover:text-foreground"
                      }`}
                      title={preset.isActive ? "Deactivate" : "Activate"}
                    >
                      <Power className="w-4 h-4" />
                    </button>

                    {preset.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeletePreset(preset.id)}
                        className="p-2 rounded-xl bg-danger/10 text-danger hover:bg-danger/20 transition-all active:scale-90"
                        title="Delete preset"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Topic Completion & Mastery Link */}
        <section className="rounded-3xl bg-card border border-white/10 p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                <h2 className="text-lg font-black text-foreground">Topic Progress & Mastery</h2>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Mark completed topics & percentages. AI never schedules topics marked 100%.
              </p>
            </div>

            <Link
              href="/subjects/progress"
              className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-foreground transition-all shrink-0 active:scale-95"
            >
              Open Mastery →
            </Link>
          </div>
        </section>

        {/* 5. Reset to defaults */}
        <section className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (confirm("Reset routine presets to factory defaults?")) {
                localStorage.removeItem("mcq_routine_presets_v1");
                setPresets(getRoutinePresets());
              }
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset presets to default</span>
          </button>
        </section>

        {/* Modal: Create Custom Preset */}
        {showNewPresetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
              onClick={() => setShowNewPresetModal(false)}
            />
            <div className="relative w-full max-w-md rounded-3xl bg-card border border-white/10 shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
              <h3 className="font-black text-lg text-foreground mb-1">
                Create Custom Preset
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Design a custom daily routine template you can activate anytime.
              </p>

              <form onSubmit={handleCreatePreset} className="space-y-4 overflow-y-auto flex-1 pr-1">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Preset Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Saturday Mega Sprint"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm font-bold focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 4 intense study blocks with afternoon workout"
                    value={newPresetDesc}
                    onChange={(e) => setNewPresetDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-foreground text-xs focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase">
                      Template Blocks ({newPresetBlocks.length})
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAddBlockToNewPreset("study")}
                        className="text-[11px] font-bold px-2 py-1 rounded-lg bg-violet-600/30 text-violet-300 hover:bg-violet-600/50"
                      >
                        + Study
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddBlockToNewPreset("normal")}
                        className="text-[11px] font-bold px-2 py-1 rounded-lg bg-white/10 text-foreground hover:bg-white/20"
                      >
                        + Normal
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {newPresetBlocks.map((b, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <span
                            className={`font-bold block truncate ${
                              b.type === "study" ? "text-violet-300" : "text-foreground"
                            }`}
                          >
                            {b.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {b.startTime || "Anytime"}{b.endTime ? ` – ${b.endTime}` : ""}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setNewPresetBlocks((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-muted-foreground hover:text-danger p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 rounded-xl bg-primary hover:brightness-110 text-primary-foreground font-black text-sm transition-all"
                  >
                    Save Preset
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewPresetModal(false)}
                    className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
