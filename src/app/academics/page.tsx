"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Filter,
  Bell,
  BellOff,
  BarChart3,
} from "lucide-react";
import { AppShell, NavMenu } from "@/components/NavMenu";
import { BackButton } from "@/components/BackButton";
import {
  getAssessments,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  setAssessmentStatus,
  checkDeadlineReminders,
  toggleAssessmentReminders,
  type AssessmentRecord,
  type CreateAssessmentInput,
} from "@/app/actions/assessments";
import { getUserSubjectsAndTopics } from "@/app/actions/subjects";

// ─── Types ───────────────────────────────────────────────────────────────────

type TabId = "overview" | "deadlines" | "grades";

const STATUS_DISPLAY: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  submitted: "Submitted",
  marks_received: "Marks Received",
};

const STATUS_CLASS: Record<string, string> = {
  not_started: "text-muted-foreground bg-white/5",
  in_progress: "text-blue-400 bg-blue-500/10",
  completed: "text-emerald-400 bg-emerald-500/10",
  submitted: "text-violet-400 bg-violet-500/10",
  marks_received: "text-amber-400 bg-amber-500/10",
};

const TERMINAL_STATUSES = ["submitted", "marks_received"];

function isOverdue(a: AssessmentRecord): boolean {
  return (
    new Date(a.dueDate) < new Date() && !TERMINAL_STATUSES.includes(a.status)
  );
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysUntil(d: Date | string): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function isToday(d: Date | string): boolean {
  const nd = new Date(d);
  const today = new Date();
  return (
    nd.getDate() === today.getDate() &&
    nd.getMonth() === today.getMonth() &&
    nd.getFullYear() === today.getFullYear()
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-lg tracking-wide ${
        STATUS_CLASS[status] ?? "text-muted-foreground bg-white/5"
      }`}
    >
      {STATUS_DISPLAY[status] ?? status}
    </span>
  );
}

// ─── Assessment Card (used in overview) ───────────────────────────────────────

function AssessmentCard({
  assessment,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  assessment: AssessmentRecord;
  onEdit: (a: AssessmentRecord) => void;
  onDelete: (a: AssessmentRecord) => void;
  onStatusChange: (a: AssessmentRecord) => void;
}) {
  const days = daysUntil(assessment.dueDate);
  const overdue = isOverdue(assessment);

  return (
    <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-card border border-white/10 hover:border-white/20 transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            overdue
              ? "bg-red-500/15 text-red-400"
              : isToday(assessment.dueDate)
              ? "bg-amber-500/15 text-amber-400"
              : "bg-primary/10 text-primary"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-foreground text-sm truncate">
              {assessment.name}
            </p>
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md shrink-0">
              {assessment.subjectName}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <StatusBadge status={assessment.status} />
            <span className="text-[11px] text-muted-foreground">
              {formatDate(assessment.dueDate)}
            </span>
            {assessment.totalMarks > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {assessment.obtainedMarks != null
                  ? `${assessment.obtainedMarks}/${assessment.totalMarks}`
                  : assessment.estimatedMarks != null
                  ? `~${assessment.estimatedMarks}/${assessment.totalMarks}`
                  : `/${assessment.totalMarks}`}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {overdue ? (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-red-500/15 text-red-400 uppercase">
            Overdue
          </span>
        ) : !TERMINAL_STATUSES.includes(assessment.status) ? (
          <span
            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${
              isToday(assessment.dueDate)
                ? "bg-amber-500/15 text-amber-400"
                : days <= 3
                ? "bg-orange-500/15 text-orange-400"
                : "bg-white/5 text-muted-foreground"
            }`}
          >
            {isToday(assessment.dueDate)
              ? "Today"
              : days === 1
              ? "Tomorrow"
              : `${days}d`}
          </span>
        ) : null}
        <button
          onClick={() => onStatusChange(assessment)}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors"
          title="Change status"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onEdit(assessment)}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-muted-foreground hover:text-blue-400 transition-colors"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(assessment)}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-muted-foreground hover:text-red-400 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Create / Edit Modal ───────────────────────────────────────────────────────

function AssessmentModal({
  initial,
  subjectNames,
  onClose,
  onSaved,
}: {
  initial: AssessmentRecord | null;
  subjectNames: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<{
    name: string;
    topic: string;
    subjectName: string;
    dueDate: string;
    totalMarks: string;
    weight: string;
    description: string;
    remindersEnabled: boolean;
  }>({
    name: initial?.name ?? "",
    topic: initial?.topic ?? "",
    subjectName: initial?.subjectName ?? "",
    dueDate: initial
      ? new Date(initial.dueDate).toISOString().slice(0, 16)
      : "",
    totalMarks: initial ? String(initial.totalMarks) : "",
    weight: initial?.weight != null ? String(initial.weight) : "",
    description: initial?.description ?? "",
    remindersEnabled: initial?.remindersEnabled ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Assessment name is required.");
      return;
    }
    if (!form.subjectName.trim()) {
      setError("Please select a subject.");
      return;
    }
    if (subjectNames.length === 0) {
      setError("Add at least one subject before creating an assessment.");
      return;
    }
    if (!form.dueDate) {
      setError("Due date is required.");
      return;
    }
    const totalMarks = parseInt(form.totalMarks);
    if (isNaN(totalMarks) || totalMarks < 0) {
      setError("Total marks must be a valid non-negative number.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload: CreateAssessmentInput = {
        name: form.name.trim(),
        topic: form.topic.trim() || undefined,
        subjectName: form.subjectName.trim(),
        dueDate: new Date(form.dueDate).toISOString(),
        totalMarks,
        weight: form.weight ? parseFloat(form.weight) : undefined,
        description: form.description.trim() || undefined,
        remindersEnabled: form.remindersEnabled,
      };

      if (initial) {
        await updateAssessment(initial.id, payload);
      } else {
        await createAssessment(payload);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-card border border-white/10 rounded-3xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-white/5 shrink-0">
          <h2 className="text-lg font-black">
            {initial ? "Edit Assessment" : "New Assessment"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {initial ? "Update assessment details" : "Track a new deadline or exam"}
          </p>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3.5">
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-xl">
              {error}
            </p>
          )}

          {/* Name */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1 block">
              Assessment Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Mid-term Exam, Assignment 1"
              className="w-full bg-background border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-primary/60 transition-colors"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1 block">
              Subject *
            </label>
            {subjectNames.length === 0 ? (
              <div className="w-full bg-background border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground">
                No subjects found —{" "}
                <a href="/subjects" className="text-primary underline underline-offset-2">
                  add a subject first
                </a>
              </div>
            ) : (
              <select
                value={form.subjectName}
                onChange={(e) => set("subjectName", e.target.value)}
                className="w-full bg-background border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-primary/60 transition-colors appearance-none"
              >
                <option value="" disabled>Select a subject…</option>
                {subjectNames.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
          </div>

          {/* Topic */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1 block">
              Topic / Chapter
            </label>
            <input
              type="text"
              value={form.topic}
              onChange={(e) => set("topic", e.target.value)}
              placeholder="Optional topic or chapter"
              className="w-full bg-background border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-primary/60 transition-colors"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1 block">
              Due Date &amp; Time *
            </label>
            <input
              type="datetime-local"
              value={form.dueDate}
              onChange={(e) => set("dueDate", e.target.value)}
              className="w-full bg-background border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-primary/60 transition-colors"
            />
          </div>

          {/* Marks + Weight */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1 block">
                Total Marks *
              </label>
              <input
                type="number"
                min="0"
                value={form.totalMarks}
                onChange={(e) => set("totalMarks", e.target.value)}
                placeholder="e.g. 100"
                className="w-full bg-background border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-primary/60 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1 block">
                Weight %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.weight}
                onChange={(e) => set("weight", e.target.value)}
                placeholder="e.g. 30"
                className="w-full bg-background border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-primary/60 transition-colors"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1 block">
              Description / Notes
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Any extra notes..."
              className="w-full bg-background border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-primary/60 transition-colors resize-none"
            />
          </div>

          {/* Reminders toggle */}
          <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-background border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
            <div className="flex items-center gap-2.5">
              {form.remindersEnabled ? (
                <Bell className="w-4 h-4 text-primary" />
              ) : (
                <BellOff className="w-4 h-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-bold">
                  {form.remindersEnabled ? "Reminders on" : "Reminders off"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Get notified 1 week, 3 days, 1 day, 1 hour before
                </p>
              </div>
            </div>
            <div
              className={`w-10 h-5 rounded-full transition-colors relative ${
                form.remindersEnabled ? "bg-primary" : "bg-white/15"
              }`}
              onClick={() => set("remindersEnabled", !form.remindersEnabled)}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                  form.remindersEnabled ? "left-5" : "left-0.5"
                }`}
              />
            </div>
          </label>
        </div>

        <div className="px-5 py-4 border-t border-white/5 flex gap-2.5 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-bold hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : initial ? "Save Changes" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Status Update Modal ───────────────────────────────────────────────────────

function StatusModal({
  assessment,
  onClose,
  onSaved,
}: {
  assessment: AssessmentRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(assessment.status);
  const [estimatedMarks, setEstimatedMarks] = useState(
    assessment.estimatedMarks != null ? String(assessment.estimatedMarks) : ""
  );
  const [obtainedMarks, setObtainedMarks] = useState(
    assessment.obtainedMarks != null ? String(assessment.obtainedMarks) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (
      status === "marks_received" &&
      (obtainedMarks === "" || isNaN(parseFloat(obtainedMarks)))
    ) {
      setError("Obtained marks is required when setting Marks Received.");
      return;
    }
    if (
      status === "marks_received" &&
      parseFloat(obtainedMarks) > assessment.totalMarks
    ) {
      setError(`Obtained marks cannot exceed total marks (${assessment.totalMarks}).`);
      return;
    }
    if (
      status === "submitted" &&
      estimatedMarks !== "" &&
      parseFloat(estimatedMarks) > assessment.totalMarks
    ) {
      setError(`Estimated marks cannot exceed total marks (${assessment.totalMarks}).`);
      return;
    }

    setSaving(true);
    setError("");
    try {
      await setAssessmentStatus(assessment.id, status, {
        estimated:
          status === "submitted" && estimatedMarks !== ""
            ? parseFloat(estimatedMarks)
            : undefined,
        obtained:
          status === "marks_received" && obtainedMarks !== ""
            ? parseFloat(obtainedMarks)
            : undefined,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-card border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-white/5">
          <h2 className="text-lg font-black">Update Status</h2>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {assessment.name}
          </p>
        </div>
        <div className="px-5 py-4 space-y-3.5">
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-xl">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            {Object.entries(STATUS_DISPLAY).map(([key, label]) => (
              <label
                key={key}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer border transition-all ${
                  status === key
                    ? "border-primary/50 bg-primary/10"
                    : "border-white/8 hover:border-white/15 bg-background"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                    status === key ? "border-primary" : "border-white/30"
                  }`}
                >
                  {status === key && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <span
                  className={`text-sm font-bold ${
                    STATUS_CLASS[key]?.split(" ")[0] ?? "text-foreground"
                  }`}
                >
                  {label}
                </span>
                <input
                  type="radio"
                  name="status"
                  value={key}
                  checked={status === key}
                  onChange={() => setStatus(key)}
                  className="sr-only"
                />
              </label>
            ))}
          </div>

          {status === "submitted" && (
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1 block">
                Estimated Marks (optional)
              </label>
              <input
                type="number"
                min="0"
                max={assessment.totalMarks}
                step="0.5"
                value={estimatedMarks}
                onChange={(e) => setEstimatedMarks(e.target.value)}
                placeholder={`0 – ${assessment.totalMarks}`}
                className="w-full bg-background border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-primary/60 transition-colors"
              />
            </div>
          )}

          {status === "marks_received" && (
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1 block">
                Obtained Marks *
              </label>
              <input
                type="number"
                min="0"
                max={assessment.totalMarks}
                step="0.5"
                value={obtainedMarks}
                onChange={(e) => setObtainedMarks(e.target.value)}
                placeholder={`0 – ${assessment.totalMarks}`}
                className="w-full bg-background border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-primary/60 transition-colors"
              />
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-white/5 flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-bold hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  assessment,
  onClose,
  onDeleted,
}: {
  assessment: AssessmentRecord;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAssessment(assessment.id);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-card border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-black">Delete Assessment?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-bold text-foreground">{assessment.name}</span>{" "}
              will be permanently deleted. This cannot be undone.
            </p>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-bold hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  assessments,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  assessments: AssessmentRecord[];
  onEdit: (a: AssessmentRecord) => void;
  onDelete: (a: AssessmentRecord) => void;
  onStatusChange: (a: AssessmentRecord) => void;
}) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);
  const weekEnd = new Date(now.getTime() + 7 * 86400000);

  const overdue = assessments.filter((a) => isOverdue(a));
  const todayItems = assessments.filter(
    (a) =>
      !TERMINAL_STATUSES.includes(a.status) &&
      new Date(a.dueDate) >= todayStart &&
      new Date(a.dueDate) < todayEnd
  );
  const thisWeek = assessments.filter(
    (a) =>
      !TERMINAL_STATUSES.includes(a.status) &&
      new Date(a.dueDate) >= todayEnd &&
      new Date(a.dueDate) < weekEnd
  );
  const recentActivity = assessments
    .filter((a) => TERMINAL_STATUSES.includes(a.status))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const Section = ({
    title,
    icon,
    items,
    iconClass,
    empty,
  }: {
    title: string;
    icon: React.ReactNode;
    items: AssessmentRecord[];
    iconClass: string;
    empty: string;
  }) => (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${iconClass}`}>
          {icon}
        </div>
        <h3 className="text-sm font-black uppercase tracking-wide">
          {title}
        </h3>
        <span className="text-xs font-bold text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded-md">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground pl-8">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <AssessmentCard
              key={a.id}
              assessment={a}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Section
        title="Overdue"
        icon={<AlertTriangle className="w-3.5 h-3.5" />}
        iconClass="bg-red-500/15 text-red-400"
        items={overdue}
        empty="No overdue assessments"
      />
      <Section
        title="Today"
        icon={<Clock className="w-3.5 h-3.5" />}
        iconClass="bg-amber-500/15 text-amber-400"
        items={todayItems}
        empty="Nothing due today"
      />
      <Section
        title="This Week"
        icon={<BookOpen className="w-3.5 h-3.5" />}
        iconClass="bg-blue-500/15 text-blue-400"
        items={thisWeek}
        empty="Nothing due this week"
      />
      <Section
        title="Recent Activity"
        icon={<TrendingUp className="w-3.5 h-3.5" />}
        iconClass="bg-emerald-500/15 text-emerald-400"
        items={recentActivity}
        empty="No submitted or graded assessments yet"
      />
    </div>
  );
}

// ─── Deadlines Tab ────────────────────────────────────────────────────────────

function DeadlinesTab({
  assessments,
  hiddenSubjects,
  onToggleHide,
  subjectFilter,
  onFilterChange,
  onEdit,
  onDelete,
  onStatusChange,
  onToggleReminders,
}: {
  assessments: AssessmentRecord[];
  hiddenSubjects: Set<string>;
  onToggleHide: (subject: string) => void;
  subjectFilter: string | null;
  onFilterChange: (s: string | null) => void;
  onEdit: (a: AssessmentRecord) => void;
  onDelete: (a: AssessmentRecord) => void;
  onStatusChange: (a: AssessmentRecord) => void;
  onToggleReminders: (a: AssessmentRecord) => void;
}) {
  const subjects = Array.from(new Set(assessments.map((a) => a.subjectName))).sort();

  const filtered = subjectFilter
    ? assessments.filter((a) => a.subjectName === subjectFilter)
    : assessments;

  const grouped = subjects
    .filter((s) => !subjectFilter || s === subjectFilter)
    .map((subject) => {
      const items = filtered
        .filter((a) => a.subjectName === subject)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      const confirmed = items.reduce(
        (sum, a) => sum + (a.status === "marks_received" ? (a.obtainedMarks ?? 0) : 0),
        0
      );
      const totalPossible = items.reduce((sum, a) => sum + a.totalMarks, 0);

      return { subject, items, confirmed, totalPossible };
    });

  return (
    <div className="space-y-5">
      {/* Subject filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Filter className="w-3.5 h-3.5" />
          <span className="text-xs font-bold uppercase tracking-wide">Filter:</span>
        </div>
        <button
          onClick={() => onFilterChange(null)}
          className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${
            !subjectFilter
              ? "bg-primary text-white"
              : "bg-white/5 text-muted-foreground hover:bg-white/10"
          }`}
        >
          All
        </button>
        {subjects.map((s) => (
          <button
            key={s}
            onClick={() => onFilterChange(s === subjectFilter ? null : s)}
            className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${
              subjectFilter === s
                ? "bg-primary text-white"
                : "bg-white/5 text-muted-foreground hover:bg-white/10"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {grouped.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-bold">No assessments yet</p>
          <p className="text-sm mt-1">Add one with the + button above</p>
        </div>
      )}

      {grouped.map(({ subject, items, confirmed, totalPossible }) => {
        const isHidden = hiddenSubjects.has(subject);
        return (
          <div
            key={subject}
            className="rounded-2xl bg-card border border-white/10 overflow-hidden"
          >
            {/* Group header */}
            <button
              onClick={() => onToggleHide(subject)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-black text-sm">{subject}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {items.length} assessment{items.length !== 1 ? "s" : ""}
                    {totalPossible > 0 && (
                      <> · confirmed: {confirmed}/{totalPossible}</>
                    )}
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${
                  isHidden ? "-rotate-90" : ""
                }`}
              />
            </button>

            {!isHidden && (
              <div className="border-t border-white/5 divide-y divide-white/5">
                {items.map((a) => {
                  const overdue = isOverdue(a);
                  const days = daysUntil(a.dueDate);
                  return (
                    <div
                      key={a.id}
                      className="flex items-start sm:items-center justify-between gap-3 px-4 py-3 hover:bg-white/3 transition-colors"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <StatusBadge status={a.status} />
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-foreground truncate">
                            {a.name}
                          </p>
                          {a.topic && (
                            <p className="text-xs text-muted-foreground truncate">
                              {a.topic}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        <span className="text-[11px] text-muted-foreground hidden sm:block">
                          {formatDateTime(a.dueDate)}
                        </span>
                        <span className="text-[11px] text-muted-foreground sm:hidden">
                          {formatDate(a.dueDate)}
                        </span>
                        {a.totalMarks > 0 && (
                          <span className="text-[11px] font-bold text-muted-foreground">
                            {a.obtainedMarks != null
                              ? `${a.obtainedMarks}/${a.totalMarks}`
                              : a.estimatedMarks != null
                              ? `~${a.estimatedMarks}/${a.totalMarks}`
                              : `/${a.totalMarks}`}
                          </span>
                        )}
                        {!TERMINAL_STATUSES.includes(a.status) && (
                          <span
                            className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded-lg ${
                              overdue
                                ? "bg-red-500/15 text-red-400"
                                : isToday(a.dueDate)
                                ? "bg-amber-500/15 text-amber-400"
                                : days <= 3
                                ? "bg-orange-500/15 text-orange-400"
                                : "bg-white/5 text-muted-foreground"
                            }`}
                          >
                            {overdue
                              ? "Overdue"
                              : isToday(a.dueDate)
                              ? "Today"
                              : days === 1
                              ? "1d"
                              : `${days}d`}
                          </span>
                        )}
                        <button
                          onClick={() => onToggleReminders(a)}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                            a.remindersEnabled
                              ? "hover:bg-white/10 text-primary"
                              : "hover:bg-white/10 text-muted-foreground"
                          }`}
                          title={
                            a.remindersEnabled
                              ? "Reminders on — click to disable"
                              : "Reminders off — click to enable"
                          }
                        >
                          {a.remindersEnabled ? (
                            <Bell className="w-3 h-3" />
                          ) : (
                            <BellOff className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          onClick={() => onStatusChange(a)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors"
                          title="Change status"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onEdit(a)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/10 text-muted-foreground hover:text-blue-400 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onDelete(a)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/10 text-muted-foreground hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Grades Tab ───────────────────────────────────────────────────────────────

function GradesTab({ assessments }: { assessments: AssessmentRecord[] }) {
  const subjects = Array.from(new Set(assessments.map((a) => a.subjectName))).sort();

  if (assessments.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-bold">No grade data yet</p>
        <p className="text-sm mt-1">Add assessments and update their status to track grades</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {subjects.map((subject) => {
        const items = assessments.filter((a) => a.subjectName === subject);
        const confirmedMarks = items.reduce(
          (sum, a) =>
            sum + (a.status === "marks_received" ? (a.obtainedMarks ?? 0) : 0),
          0
        );
        const estimatedTotal = items.reduce(
          (sum, a) =>
            sum + (a.status === "submitted" ? (a.estimatedMarks ?? 0) : 0),
          0
        );
        const totalPossible = items.reduce((sum, a) => sum + a.totalMarks, 0);
        const remaining = items.filter(
          (a) => !TERMINAL_STATUSES.includes(a.status)
        ).length;

        const confirmedPct =
          totalPossible > 0
            ? Math.round((confirmedMarks / totalPossible) * 100)
            : 0;

        return (
          <div
            key={subject}
            className="rounded-2xl bg-card border border-white/10 overflow-hidden"
          >
            {/* Subject header */}
            <div className="px-4 pt-4 pb-3 border-b border-white/5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-black">{subject}</h3>
                </div>
                <span className="text-sm font-black text-primary">
                  {confirmedPct}%
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${confirmedPct}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Confirmed: {confirmedMarks} / {totalPossible} pts
                {estimatedTotal > 0 && ` · Estimated: +${estimatedTotal}`}
              </p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-wide text-muted-foreground border-b border-white/5">
                    <th className="text-left px-4 py-2">Assessment</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">Total</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">Obtained/Est.</th>
                    <th className="text-right px-4 py-2 whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((a) => (
                    <tr key={a.id} className="hover:bg-white/3 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-bold truncate max-w-[180px]">{a.name}</p>
                        {a.topic && (
                          <p className="text-[11px] text-muted-foreground">
                            {a.topic}
                          </p>
                        )}
                      </td>
                      <td className="text-right px-3 py-2.5 font-bold tabular-nums">
                        {a.totalMarks}
                      </td>
                      <td className="text-right px-3 py-2.5 tabular-nums">
                        {a.status === "marks_received" && a.obtainedMarks != null ? (
                          <span className="text-amber-400 font-black">
                            {a.obtainedMarks}
                          </span>
                        ) : a.status === "submitted" && a.estimatedMarks != null ? (
                          <span className="text-violet-400 font-bold">
                            ~{a.estimatedMarks}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-right px-4 py-2.5">
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10 font-black text-xs bg-white/3">
                    <td className="px-4 py-2.5 text-muted-foreground">
                      Summary · {remaining} remaining
                    </td>
                    <td className="text-right px-3 py-2.5 text-foreground">
                      {totalPossible}
                    </td>
                    <td className="text-right px-3 py-2.5">
                      <span className="text-amber-400">{confirmedMarks}</span>
                      {estimatedTotal > 0 && (
                        <span className="text-muted-foreground">
                          {" "}+<span className="text-violet-400">~{estimatedTotal}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AcademicsPage() {
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAssessment, setEditingAssessment] =
    useState<AssessmentRecord | null>(null);
  const [statusUpdateTarget, setStatusUpdateTarget] =
    useState<AssessmentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssessmentRecord | null>(
    null
  );
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [hiddenSubjects, setHiddenSubjects] = useState<Set<string>>(new Set());
  const [subjectNames, setSubjectNames] = useState<string[]>([]);

  const loadAssessments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAssessments();
      setAssessments(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssessments();
    checkDeadlineReminders().catch(() => {});

    // Load hidden subjects from localStorage
    try {
      const stored = localStorage.getItem("academics_hidden_subjects");
      if (stored) {
        setHiddenSubjects(new Set(JSON.parse(stored)));
      }
    } catch {}

    // Load subject names for autocomplete
    getUserSubjectsAndTopics()
      .then((subs) => setSubjectNames(subs.map((s) => s.name)))
      .catch(() => {});
  }, [loadAssessments]);

  function toggleHiddenSubject(subject: string) {
    setHiddenSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subject)) {
        next.delete(subject);
      } else {
        next.add(subject);
      }
      try {
        localStorage.setItem(
          "academics_hidden_subjects",
          JSON.stringify(Array.from(next))
        );
      } catch {}
      return next;
    });
  }

  async function handleToggleReminders(a: AssessmentRecord) {
    try {
      await toggleAssessmentReminders(a.id);
      await loadAssessments();
    } catch {}
  }

  const TABS: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "deadlines", label: "Deadlines" },
    { id: "grades", label: "Grades" },
  ];

  const overdueCount = assessments.filter((a) => isOverdue(a)).length;
  const totalCount = assessments.filter(
    (a) => !TERMINAL_STATUSES.includes(a.status)
  ).length;

  return (
    <AppShell showBottomBar={false}>
      <div className="w-full flex flex-col px-4 pt-4 pb-10 md:px-8 md:pt-6 max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BackButton href="/" />
            <div>
              <h1 className="text-2xl font-black tracking-tight">Academics</h1>
              {!loading && (
                <p className="text-xs text-muted-foreground">
                  {totalCount} active · {overdueCount > 0 && (
                    <span className="text-red-400 font-bold">
                      {overdueCount} overdue
                    </span>
                  )}
                  {overdueCount === 0 && "all on track"}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span>
            </button>
            <NavMenu />
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-1.5 p-1 rounded-2xl bg-card border border-white/10">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-white shadow-md shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm font-bold">Loading assessments…</p>
          </div>
        ) : (
          <>
            {activeTab === "overview" && (
              <OverviewTab
                assessments={assessments}
                onEdit={setEditingAssessment}
                onDelete={setDeleteTarget}
                onStatusChange={setStatusUpdateTarget}
              />
            )}
            {activeTab === "deadlines" && (
              <DeadlinesTab
                assessments={assessments}
                hiddenSubjects={hiddenSubjects}
                onToggleHide={toggleHiddenSubject}
                subjectFilter={subjectFilter}
                onFilterChange={setSubjectFilter}
                onEdit={setEditingAssessment}
                onDelete={setDeleteTarget}
                onStatusChange={setStatusUpdateTarget}
                onToggleReminders={handleToggleReminders}
              />
            )}
            {activeTab === "grades" && (
              <GradesTab assessments={assessments} />
            )}
          </>
        )}

        {/* Empty state for first time */}
        {!loading && assessments.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-black text-lg mb-2">Track Your Academics</h3>
            <p className="text-sm max-w-xs mx-auto">
              Add assessments, exams, and assignments to track deadlines and
              grades.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add First Assessment
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {(showCreateModal || editingAssessment) && (
        <AssessmentModal
          initial={editingAssessment}
          subjectNames={subjectNames}
          onClose={() => {
            setShowCreateModal(false);
            setEditingAssessment(null);
          }}
          onSaved={() => {
            setShowCreateModal(false);
            setEditingAssessment(null);
            loadAssessments();
          }}
        />
      )}

      {statusUpdateTarget && (
        <StatusModal
          assessment={statusUpdateTarget}
          onClose={() => setStatusUpdateTarget(null)}
          onSaved={() => {
            setStatusUpdateTarget(null);
            loadAssessments();
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          assessment={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            loadAssessments();
          }}
        />
      )}
    </AppShell>
  );
}
