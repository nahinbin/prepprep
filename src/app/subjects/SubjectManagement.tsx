"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { NavMenu, AppShell } from "@/components/NavMenu";
import { BackButton } from "@/components/BackButton";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  FolderOpen,
  Search,
  Check,
  X,
  AlertTriangle,
  Layers,
  HelpCircle,
  FileQuestion,
  Sparkles,
} from "lucide-react";
import {
  createSubject,
  updateSubject,
  deleteSubject,
  createTopic,
  updateTopic,
  deleteTopic,
} from "@/app/actions/subjects";
import { playConfirmSound } from "@/lib/gameSounds";

type Topic = {
  id: string;
  name: string;
  _count: { questions: number };
};

type Subject = {
  id: string;
  name: string;
  topics: Topic[];
  _count: { questions: number };
};

type DeleteTarget = {
  type: "subject" | "topic";
  id: string;
  name: string;
  questionCount: number;
  topicCount?: number;
};

function SlideToConfirm({
  onConfirm,
  disabled = false,
  label = "Slide to delete",
}: {
  onConfirm: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const [sliderPosition, setSliderPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [containerWidth, setContainerWidth] = useState(300);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.clientWidth);
    }
  }, []);

  const updatePosition = useCallback(
    (clientX: number) => {
      if (!containerRef.current || confirmed || disabled) return;
      const rect = containerRef.current.getBoundingClientRect();
      setContainerWidth(rect.width);
      const handleWidth = 44;
      const maxDrag = Math.max(0, rect.width - handleWidth - 8);
      if (maxDrag === 0) return;
      const currentX = clientX - rect.left - handleWidth / 2;
      const clamped = Math.max(0, Math.min(maxDrag, currentX));
      const ratio = clamped / maxDrag;
      setSliderPosition(ratio);

      if (ratio >= 0.88) {
        setSliderPosition(1);
        setConfirmed(true);
        setIsDragging(false);
        try {
          playConfirmSound();
        } catch {}
        onConfirm();
      }
    },
    [confirmed, disabled, onConfirm]
  );

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    updatePosition(e.touches[0].clientX);
  };

  useEffect(() => {
    if (isDragging) {
      const onMove = (e: MouseEvent) => updatePosition(e.clientX);
      const onUp = () => {
        if (confirmed) return;
        setIsDragging(false);
        setSliderPosition(0);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      return () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
    }
  }, [isDragging, confirmed, updatePosition]);

  const handleEnd = () => {
    if (confirmed) return;
    setIsDragging(false);
    if (sliderPosition < 0.88) {
      setSliderPosition(0);
    }
  };

  const maxOffset = Math.max(0, containerWidth - 52);

  return (
    <div
      ref={containerRef}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleEnd}
      className={`relative h-12 w-full rounded-xl overflow-hidden select-none border transition-all flex items-center ${
        confirmed
          ? "bg-rose-600 border-rose-600 text-white"
          : "bg-rose-500/10 border-rose-500/30 text-rose-300"
      }`}
    >
      <div
        className="absolute left-0 top-0 bottom-0 bg-rose-500/20 transition-all pointer-events-none"
        style={{ width: `${sliderPosition * 100}%` }}
      />
      <span className="w-full text-center text-xs font-semibold tracking-wide uppercase pointer-events-none z-10 pl-10 pr-4">
        {confirmed ? "Deleting..." : label}
      </span>
      <div
        onMouseDown={() => !disabled && !confirmed && setIsDragging(true)}
        onTouchStart={() => !disabled && !confirmed && setIsDragging(true)}
        className="absolute left-1 top-1 bottom-1 w-10 rounded-lg bg-rose-600 text-white flex items-center justify-center cursor-grab active:cursor-grabbing z-20 transition-transform shadow-sm"
        style={{
          transform: `translateX(${sliderPosition * maxOffset}px)`,
          transition: isDragging ? "none" : "transform 0.2s ease-out",
        }}
      >
        {confirmed ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <ChevronRight className="w-5 h-5 stroke-[2.5]" />
        )}
      </div>
    </div>
  );
}

export function SubjectManagement({ subjects }: { subjects: Subject[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(subjects.slice(0, 2).map((s) => s.id))
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newTopicNames, setNewTopicNames] = useState<Record<string, string>>({});
  const [activeAddTopicSubjectId, setActiveAddTopicSubjectId] = useState<string | null>(null);

  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [editingTopic, setEditingTopic] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // Compute total counts
  const totalStats = useMemo(() => {
    let topics = 0;
    let questions = 0;
    subjects.forEach((s) => {
      topics += s.topics.length;
      questions += s._count.questions;
    });
    return { subjects: subjects.length, topics, questions };
  }, [subjects]);

  // Filter subjects and topics based on search
  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjects;
    const q = searchQuery.toLowerCase().trim();
    return subjects.filter((s) => {
      const matchSubject = s.name.toLowerCase().includes(q);
      const matchTopic = s.topics.some((t) => t.name.toLowerCase().includes(q));
      return matchSubject || matchTopic;
    });
  }, [subjects, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateSubject = async () => {
    if (!newSubjectName.trim()) return;
    setLoading("new-subject");
    setError("");
    const res = await createSubject(newSubjectName);
    if (res.error) {
      setError(res.error);
    } else {
      setNewSubjectName("");
      setShowAddSubjectModal(false);
      router.refresh();
    }
    setLoading(null);
  };

  const handleUpdateSubject = async (id: string) => {
    const name = editValues[`subject-${id}`];
    if (!name?.trim()) return;
    setLoading(`subject-${id}`);
    setError("");
    const res = await updateSubject(id, name);
    if (res.error) {
      setError(res.error);
    } else {
      setEditingSubject(null);
      router.refresh();
    }
    setLoading(null);
  };

  const handleCreateTopic = async (subjectId: string) => {
    const name = newTopicNames[subjectId];
    if (!name?.trim()) return;
    setLoading(`topic-${subjectId}`);
    setError("");
    const res = await createTopic(subjectId, name);
    if (res.error) {
      setError(res.error);
    } else {
      setNewTopicNames((prev) => ({ ...prev, [subjectId]: "" }));
      setActiveAddTopicSubjectId(null);
      setExpanded((prev) => new Set(prev).add(subjectId));
      router.refresh();
    }
    setLoading(null);
  };

  const handleUpdateTopic = async (id: string) => {
    const name = editValues[`topic-${id}`];
    if (!name?.trim()) return;
    setLoading(`topic-edit-${id}`);
    setError("");
    const res = await updateTopic(id, name);
    if (res.error) {
      setError(res.error);
    } else {
      setEditingTopic(null);
      router.refresh();
    }
    setLoading(null);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setLoading(`del-${deleteTarget.type}-${deleteTarget.id}`);
    setError("");

    if (deleteTarget.type === "subject") {
      const res = await deleteSubject(deleteTarget.id);
      if (res.error) setError(res.error);
      else router.refresh();
    } else {
      const res = await deleteTopic(deleteTarget.id);
      if (res.error) setError(res.error);
      else router.refresh();
    }

    setLoading(null);
    setDeleteTarget(null);
  };

  return (
    <AppShell>
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Clean, Professional Top Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <BackButton />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-violet-400" />
                  Subjects & Topics
                </h1>
                <p className="text-xs text-neutral-400">
                  {totalStats.subjects} subjects · {totalStats.topics} topics · {totalStats.questions} questions
                </p>
              </div>
            </div>

            {/* Mobile NavMenu */}
            <div className="sm:hidden">
              <NavMenu />
            </div>
          </div>

          {/* Action Header Buttons */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <Link
              href="/subjects/progress"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mastery</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setShowAddSubjectModal(true);
                setError("");
              }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 px-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Subject</span>
            </button>
          </div>
        </header>

        {/* Search Bar */}
        {subjects.length > 2 && (
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subjects or topics..."
              className="w-full h-10 pl-9 pr-8 rounded-xl bg-neutral-900/90 border border-neutral-800 text-xs sm:text-sm text-white placeholder:text-neutral-400 focus:outline-none focus:border-violet-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-between gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="text-rose-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Empty State */}
        {subjects.length === 0 ? (
          <div className="p-8 sm:p-12 text-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/40 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-violet-950/40 border border-violet-500/20 text-violet-400 flex items-center justify-center mx-auto">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">No subjects created yet</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
                Add your curriculum subjects to organize topics, practice questions, and track study progress.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddSubjectModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors mt-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Subject</span>
            </button>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="p-6 text-center text-xs text-neutral-400 rounded-xl border border-neutral-800 bg-neutral-900/30">
            No subjects or topics match &ldquo;{searchQuery}&rdquo;.
          </div>
        ) : (
          /* Structured Subjects List */
          <div className="space-y-2.5">
            {filteredSubjects.map((subject) => {
              const isExpanded = expanded.has(subject.id);
              const isEditing = editingSubject === subject.id;

              return (
                <div
                  key={subject.id}
                  className="rounded-2xl border border-neutral-800 bg-neutral-900/70 overflow-hidden transition-all shadow-sm"
                >
                  {/* Subject Header Row */}
                  <div className="flex items-center justify-between gap-2 p-3 sm:p-4">
                    <button
                      type="button"
                      onClick={() => toggleExpand(subject.id)}
                      className="flex items-center gap-2.5 flex-1 min-w-0 text-left group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-neutral-800 text-neutral-400 group-hover:text-white group-hover:bg-neutral-700 flex items-center justify-center shrink-0 transition-colors">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-violet-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>

                      {isEditing ? (
                        <div
                          className="flex-1 max-w-md"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Input
                            value={editValues[`subject-${subject.id}`] ?? subject.name}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                [`subject-${subject.id}`]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdateSubject(subject.id);
                              if (e.key === "Escape") setEditingSubject(null);
                            }}
                            className="h-8 text-sm font-semibold rounded-lg bg-neutral-950 border-neutral-700"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm sm:text-base text-white truncate">
                              {subject.name}
                            </span>
                            <span className="text-[11px] font-medium text-neutral-400 shrink-0">
                              ({subject.topics.length})
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 truncate">
                            {subject._count.questions} question{subject._count.questions !== 1 ? "s" : ""}
                          </p>
                        </div>
                      )}
                    </button>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUpdateSubject(subject.id)}
                            disabled={loading === `subject-${subject.id}`}
                            className="h-7 px-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSubject(null)}
                            className="h-7 px-2 rounded-lg text-neutral-400 hover:text-white text-xs transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSubject(subject.id);
                              setEditValues((prev) => ({
                                ...prev,
                                [`subject-${subject.id}`]: subject.name,
                              }));
                            }}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                            title="Rename Subject"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                type: "subject",
                                id: subject.id,
                                name: subject.name,
                                questionCount: subject._count.questions,
                                topicCount: subject.topics.length,
                              })
                            }
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete Subject"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded Topics Section */}
                  {isExpanded && (
                    <div className="border-t border-neutral-800/80 bg-neutral-950/40 p-3 sm:p-4 space-y-2">
                      {subject.topics.length === 0 ? (
                        <p className="text-xs text-neutral-400 py-1 pl-1">
                          No topics added under {subject.name} yet.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {subject.topics.map((topic) => {
                            const isTopicEditing = editingTopic === topic.id;

                            return (
                              <div
                                key={topic.id}
                                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-neutral-900 border border-neutral-800/90 text-xs"
                              >
                                {isTopicEditing ? (
                                  <div className="flex-1">
                                    <Input
                                      value={editValues[`topic-${topic.id}`] ?? topic.name}
                                      onChange={(e) =>
                                        setEditValues((prev) => ({
                                          ...prev,
                                          [`topic-${topic.id}`]: e.target.value,
                                        }))
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") handleUpdateTopic(topic.id);
                                        if (e.key === "Escape") setEditingTopic(null);
                                      }}
                                      className="h-7 text-xs rounded-md bg-neutral-950 border-neutral-700"
                                      autoFocus
                                    />
                                  </div>
                                ) : (
                                  <div className="min-w-0 flex-1">
                                    <span className="font-medium text-neutral-200 truncate block">
                                      {topic.name}
                                    </span>
                                    {topic._count.questions > 0 && (
                                      <span className="text-[10px] text-neutral-400">
                                        {topic._count.questions} questions
                                      </span>
                                    )}
                                  </div>
                                )}

                                <div className="flex items-center gap-1 shrink-0">
                                  {isTopicEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateTopic(topic.id)}
                                        disabled={loading === `topic-edit-${topic.id}`}
                                        className="h-6 px-2 rounded bg-violet-600 hover:bg-violet-500 text-white font-medium text-[11px]"
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingTopic(null)}
                                        className="h-6 px-1.5 text-neutral-400 hover:text-white text-[11px]"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingTopic(topic.id);
                                          setEditValues((prev) => ({
                                            ...prev,
                                            [`topic-${topic.id}`]: topic.name,
                                          }));
                                        }}
                                        className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                                        title="Rename topic"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setDeleteTarget({
                                            type: "topic",
                                            id: topic.id,
                                            name: topic.name,
                                            questionCount: topic._count.questions,
                                          })
                                        }
                                        className="p-1 rounded text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                        title="Delete topic"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add Topic Input / Trigger */}
                      {activeAddTopicSubjectId === subject.id ? (
                        <div className="flex items-center gap-2 pt-1">
                          <Input
                            placeholder="Topic title..."
                            value={newTopicNames[subject.id] ?? ""}
                            onChange={(e) =>
                              setNewTopicNames((prev) => ({
                                ...prev,
                                [subject.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleCreateTopic(subject.id)
                            }
                            className="flex-1 h-9 text-xs rounded-xl bg-neutral-950 border-neutral-700"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleCreateTopic(subject.id)}
                            disabled={!newTopicNames[subject.id]?.trim() || loading === `topic-${subject.id}`}
                            className="h-9 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shrink-0 transition-colors disabled:opacity-50"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveAddTopicSubjectId(null)}
                            className="h-9 px-2.5 rounded-xl text-neutral-400 hover:text-white text-xs transition-colors shrink-0"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveAddTopicSubjectId(subject.id)}
                          className="w-full py-2 rounded-xl border border-dashed border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/60 text-xs text-neutral-400 hover:text-neutral-200 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Topic</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Subject Modal */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm p-5 rounded-2xl border border-neutral-800 bg-[#1a1a1a] shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">New Subject</h3>
              <button
                type="button"
                onClick={() => setShowAddSubjectModal(false)}
                className="w-7 h-7 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-neutral-400">Subject Name</label>
              <Input
                placeholder="e.g. Physics, Biochemistry, Law"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateSubject()}
                className="h-10 text-sm rounded-xl bg-neutral-900 border-neutral-800"
                autoFocus
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddSubjectModal(false)}
                className="flex-1 h-9 rounded-xl border border-neutral-800 text-neutral-300 hover:bg-neutral-800 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateSubject}
                disabled={!newSubjectName.trim() || loading === "new-subject"}
                className="flex-1 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {loading === "new-subject" ? "Creating..." : "Create Subject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm p-5 rounded-2xl border border-neutral-800 bg-[#1a1a1a] shadow-2xl space-y-4 text-white">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">
                    Delete {deleteTarget.type === "subject" ? "Subject" : "Topic"}
                  </h3>
                  <p className="text-xs text-neutral-400 truncate max-w-[200px]">
                    {deleteTarget.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="w-7 h-7 rounded-lg text-neutral-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {deleteTarget.questionCount > 0 ? (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/20 text-xs text-rose-300 space-y-1">
                <p className="font-semibold">
                  Contains {deleteTarget.questionCount} question{deleteTarget.questionCount !== 1 ? "s" : ""}
                  {deleteTarget.topicCount ? ` across ${deleteTarget.topicCount} topics` : ""}.
                </p>
                <p className="text-[11px] text-neutral-400">
                  Deleting will permanently remove all associated questions and student mistake logs.
                </p>
              </div>
            ) : (
              <p className="text-xs text-neutral-400">
                Are you sure you want to delete this {deleteTarget.type}? This action cannot be reversed.
              </p>
            )}

            {deleteTarget.questionCount > 0 ? (
              <div className="space-y-2 pt-1">
                <SlideToConfirm
                  onConfirm={executeDelete}
                  disabled={loading !== null}
                  label="Slide to confirm delete"
                />
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="w-full h-8 text-xs text-neutral-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 h-9 rounded-xl border border-neutral-800 text-neutral-300 hover:bg-neutral-800 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeDelete}
                  disabled={loading !== null}
                  className="flex-1 h-9 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
