"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Save,
  Check,
  SlidersHorizontal,
  Bot,
  Plus,
  Trash2,
  Pencil,
  Power,
  X,
} from "lucide-react";
import { AppShell } from "@/components/NavMenu";
import {
  getAiProfile,
  updateAiProfile,
  getDbRoutinePresets,
  saveDbRoutinePreset,
  deleteDbRoutinePreset,
  toggleDbRoutinePreset,
} from "@/app/actions/ai-profile";
import {
  getAiPermanentNotes,
  setAiPermanentNotes,
  getAiAssistantName,
  setAiAssistantName,
} from "@/lib/routineStorage";
import { RoutinePreset, RoutinePresetBlock } from "@/lib/routineTypes";

export default function RoutineSettingsPage() {
  const router = useRouter();

  // 1. Notepad
  const [notepadText, setNotepadText] = useState("");
  const [notepadSaved, setNotepadSaved] = useState(false);

  // 2. AI Assistant Nickname
  const [aiName, setAiName] = useState("AI Assistant");
  const [aiNameSaved, setAiNameSaved] = useState(false);

  // 3. Presets
  const [presets, setPresets] = useState<RoutinePreset[]>([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetModalName, setPresetModalName] = useState("");
  const [presetModalDesc, setPresetModalDesc] = useState("");
  const [presetModalBlocks, setPresetModalBlocks] = useState<RoutinePresetBlock[]>([]);

  // Load from DB on mount
  useEffect(() => {
    getAiProfile().then((profile) => {
      if (profile) {
        setAiName(profile.aiName || getAiAssistantName() || "AI Assistant");
        setNotepadText(profile.notepad || getAiPermanentNotes() || "");
        setAiAssistantName(profile.aiName || "AI Assistant");
        setAiPermanentNotes(profile.notepad || "");
      }
    }).catch(console.warn);

    getDbRoutinePresets().then((dbPresets) => {
      if (dbPresets && dbPresets.length > 0) {
        setPresets(dbPresets);
      }
    }).catch(console.warn);
  }, []);

  const handleSaveNotepad = async () => {
    setAiPermanentNotes(notepadText);
    await updateAiProfile({ notepad: notepadText }).catch(console.warn);
    setNotepadSaved(true);
    setTimeout(() => setNotepadSaved(false), 2000);
  };

  const handleSaveAiName = async () => {
    const clean = aiName.trim() || "AI Assistant";
    setAiName(clean);
    setAiAssistantName(clean);
    await updateAiProfile({ aiName: clean }).catch(console.warn);
    setAiNameSaved(true);
    setTimeout(() => setAiNameSaved(false), 2000);
  };

  const handleTogglePreset = async (id: string) => {
    setPresets((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p))
    );
    await toggleDbRoutinePreset(id).catch(console.warn);
  };

  const handleDeletePreset = async (id: string) => {
    if (confirm("Delete this preset?")) {
      setPresets((prev) => prev.filter((p) => p.id !== id));
      await deleteDbRoutinePreset(id).catch(console.warn);
    }
  };

  const handleOpenNewPreset = () => {
    setEditingPresetId(null);
    setPresetModalName("");
    setPresetModalDesc("");
    setPresetModalBlocks([
      {
        type: "normal",
        title: "Wake up & Refresh",
        timeMode: "single",
        startTime: "07:00",
      },
      {
        type: "study",
        title: "Morning Study Sprint",
        subject: "Physics",
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
        type: "study",
        title: "Afternoon Practice Session",
        subject: "Mathematics",
        topic: "MCQ Problem Solving",
        timeMode: "range",
        startTime: "15:00",
        endTime: "18:00",
      },
      {
        type: "normal",
        title: "Sleep",
        timeMode: "single",
        startTime: "23:00",
      },
    ]);
    setShowPresetModal(true);
  };

  const handleOpenEditPreset = (preset: RoutinePreset) => {
    setEditingPresetId(preset.id);
    setPresetModalName(preset.name);
    setPresetModalDesc(preset.description || "");
    setPresetModalBlocks([...preset.blocks]);
    setShowPresetModal(true);
  };

  const handleSavePresetModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetModalName.trim()) return;

    const res = await saveDbRoutinePreset({
      id: editingPresetId || undefined,
      name: presetModalName.trim(),
      description: presetModalDesc.trim(),
      blocks: presetModalBlocks,
    });

    if (res && "success" in res && res.success) {
      const refreshed = await getDbRoutinePresets();
      setPresets(refreshed);
      setShowPresetModal(false);
    }
  };

  const handleAddBlockToPreset = (type: "normal" | "study") => {
    if (type === "study") {
      setPresetModalBlocks((prev) => [
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
      setPresetModalBlocks((prev) => [
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

  const handleRemoveBlockFromPreset = (index: number) => {
    setPresetModalBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <AppShell showBottomBar={false}>
      <div className="w-full max-w-3xl mx-auto px-4 pt-4 pb-20 md:pt-8 md:pb-16 space-y-8 animate-in fade-in duration-150">
        {/* Top Header: Only 'Settings' text, Done is a clean checkmark icon button */}
        <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/routine")}
              className="w-10 h-10 rounded-2xl bg-card hover:bg-white/10 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all active:scale-95"
              aria-label="Back to Routine"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-black text-foreground tracking-tight">
              Settings
            </h1>
          </div>

          <Link
            href="/routine"
            className="w-10 h-10 rounded-2xl bg-card hover:bg-white/10 border border-white/10 flex items-center justify-center text-foreground hover:text-primary transition-all active:scale-95"
            aria-label="Done"
            title="Done"
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
          </Link>
        </div>

        {/* 1. Notepad (Requested by user: Just 'Notepad' with small text under, Save button is icon only) */}
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
              className="w-10 h-10 rounded-xl bg-primary hover:brightness-110 text-primary-foreground font-bold flex items-center justify-center shadow-md shadow-primary/20 transition-all active:scale-95 shrink-0"
              aria-label="Save Notepad"
              title="Save Notepad"
            >
              {notepadSaved ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            </button>
          </div>
        </section>

        {/* 2. AI Assistant Nickname (No long description underneath, default AI Assistant) */}
        <section className="rounded-3xl bg-card border border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-black text-foreground">AI Assistant Nickname</h2>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={aiName}
              onChange={(e) => setAiName(e.target.value)}
              placeholder="e.g. AI Assistant"
              maxLength={25}
              className="flex-1 px-4 py-2.5 rounded-xl bg-black/25 border border-white/10 text-foreground font-bold text-sm focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={handleSaveAiName}
              className="w-10 h-10 rounded-xl bg-primary hover:brightness-110 text-primary-foreground font-bold flex items-center justify-center transition-all active:scale-95 shadow-md shadow-primary/20 shrink-0"
              aria-label="Save Nickname"
              title="Save Nickname"
            >
              {aiNameSaved ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            </button>
          </div>
        </section>

        {/* 3. Presets Manager (Editable, customizable, can add and delete presets) */}
        <section className="rounded-3xl bg-card border border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-violet-400" />
              <h2 className="text-lg font-black text-foreground">Presets</h2>
            </div>

            <button
              type="button"
              onClick={handleOpenNewPreset}
              className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-foreground flex items-center gap-1.5 transition-all shrink-0 active:scale-95"
            >
              <Plus className="w-4 h-4 text-primary" />
              <span>Add Preset</span>
            </button>
          </div>

          <div className="space-y-3 pt-1">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className={`p-4 rounded-2xl border transition-all ${
                  preset.isActive
                    ? "bg-violet-950/20 border-violet-500/30"
                    : "bg-white/5 border-white/5 opacity-70"
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
                    {preset.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {preset.description}
                      </p>
                    )}
                    <span className="text-[11px] font-semibold text-muted-foreground/80 mt-1 block">
                      {preset.blocks.length} blocks ·{" "}
                      {preset.blocks.filter((b) => b.type === "study").length} study blocks
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Toggle Active */}
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

                    {/* Edit Preset */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditPreset(preset)}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-muted-foreground hover:text-foreground transition-all active:scale-90"
                      title="Edit preset"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {/* Delete Preset */}
                    <button
                      type="button"
                      onClick={() => handleDeletePreset(preset.id)}
                      className="p-2 rounded-xl hover:bg-danger/20 text-muted-foreground hover:text-danger transition-all active:scale-90"
                      title="Delete preset"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Preset Editor Modal (Add & Edit) */}
      {showPresetModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-card border border-white/10 p-6 space-y-5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-lg font-black text-foreground">
                {editingPresetId ? "Edit Preset" : "New Preset"}
              </h3>
              <button
                onClick={() => setShowPresetModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePresetModal} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Preset Name
                </label>
                <input
                  type="text"
                  required
                  value={presetModalName}
                  onChange={(e) => setPresetModalName(e.target.value)}
                  placeholder="e.g. Exam Sprint, Weekend Rest, No-Coaching Day"
                  className="w-full px-4 py-2.5 rounded-xl bg-black/30 border border-white/10 text-foreground text-sm font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={presetModalDesc}
                  onChange={(e) => setPresetModalDesc(e.target.value)}
                  placeholder="e.g. Focus exclusively on revision and mock exams"
                  className="w-full px-4 py-2.5 rounded-xl bg-black/30 border border-white/10 text-foreground text-sm font-medium focus:outline-none focus:border-primary"
                />
              </div>

              {/* Template Blocks */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">
                    Template Blocks ({presetModalBlocks.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddBlockToPreset("normal")}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-foreground border border-white/10"
                    >
                      + Normal Block
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlockToPreset("study")}
                      className="px-2.5 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-[11px] font-bold text-violet-300 border border-violet-500/30"
                    >
                      + Study Block
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {presetModalBlocks.map((blk, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                        blk.type === "study"
                          ? "bg-violet-950/20 border-violet-500/30"
                          : "bg-white/5 border-white/10"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <input
                          type="text"
                          value={blk.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPresetModalBlocks((prev) =>
                              prev.map((b, i) => (i === idx ? { ...b, title: val } : b))
                            );
                          }}
                          className="font-bold text-foreground bg-transparent w-full focus:outline-none focus:underline"
                        />
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="time"
                            value={blk.startTime || "09:00"}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPresetModalBlocks((prev) =>
                                prev.map((b, i) => (i === idx ? { ...b, startTime: val } : b))
                              );
                            }}
                            className="bg-black/30 px-1.5 py-0.5 rounded text-[11px] font-mono text-muted-foreground border border-white/10"
                          />
                          {blk.timeMode === "range" && (
                            <>
                              <span className="text-muted-foreground">–</span>
                              <input
                                type="time"
                                value={blk.endTime || "10:30"}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPresetModalBlocks((prev) =>
                                    prev.map((b, i) => (i === idx ? { ...b, endTime: val } : b))
                                  );
                                }}
                                className="bg-black/30 px-1.5 py-0.5 rounded text-[11px] font-mono text-muted-foreground border border-white/10"
                              />
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveBlockFromPreset(idx)}
                        className="p-1.5 rounded-lg hover:bg-danger/20 text-muted-foreground hover:text-danger transition-colors shrink-0"
                        title="Remove block"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowPresetModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-primary hover:brightness-110 text-primary-foreground text-xs font-black shadow-md shadow-primary/20"
                >
                  Save Preset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
