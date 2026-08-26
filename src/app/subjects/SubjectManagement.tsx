"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Layers,
  AlertTriangle,
  X,
  Sparkles,
  Check,
} from "lucide-react";
import {
  createSubject,
  updateSubject,
  deleteSubject,
  createTopic,
  updateTopic,
  deleteTopic,
} from "@/app/actions/subjects";

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
  label = "Swipe to Confirm Delete",
}: {
  onConfirm: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const [sliderPosition, setSliderPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = (clientX: number) => {
    if (!containerRef.current || confirmed || disabled) return;
    const rect = containerRef.current.getBoundingClientRect();
    const handleWidth = 52;
    const maxDrag = rect.width - handleWidth - 8;
    const currentX = clientX - rect.left - handleWidth / 2;
    const clamped = Math.max(0, Math.min(maxDrag, currentX));
    const ratio = clamped / maxDrag;
    setSliderPosition(ratio);

    if (ratio >= 0.88) {
      setSliderPosition(1);
      setConfirmed(true);
      setIsDragging(false);
      onConfirm();
    }
  };

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
  }, [isDragging, confirmed, disabled]);

  const handleEnd = () => {
    if (confirmed) return;
    setIsDragging(false);
    if (sliderPosition < 0.88) {
      setSliderPosition(0);
    }
  };

  const containerWidth = containerRef.current ? containerRef.current.clientWidth : 300;
  const maxOffset = Math.max(0, containerWidth - 60);

  return (
    <div
      ref={containerRef}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleEnd}
      className={`relative h-15 w-full rounded-2xl overflow-hidden select-none border-2 transition-all flex items-center ${
        confirmed
          ? "bg-danger border-danger text-white shadow-lg shadow-danger/25"
          : "bg-danger/10 border-danger/30 text-danger"
      }`}
    >
      {/* Progress fill track */}
      <div
        className="absolute left-0 top-0 bottom-0 bg-danger/20 transition-all pointer-events-none"
        style={{ width: `${sliderPosition * 100}%` }}
      />

      {/* Center Label */}
      <span className="w-full text-center text-xs sm:text-sm font-black tracking-wider uppercase pointer-events-none z-10 pl-12 pr-4">
        {confirmed ? "Deleting..." : label}
      </span>

      {/* Draggable Button Handle */}
      <div
        onMouseDown={() => !disabled && !confirmed && setIsDragging(true)}
        onTouchStart={() => !disabled && !confirmed && setIsDragging(true)}
        className="absolute left-1.5 top-1.5 bottom-1.5 w-12 rounded-xl bg-danger text-white flex items-center justify-center cursor-grab active:cursor-grabbing shadow-md z-20 active:scale-95 transition-transform"
        style={{
          transform: `translateX(${sliderPosition * maxOffset}px)`,
          transition: isDragging ? "none" : "transform 0.25s ease-out",
        }}
      >
        {confirmed ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <ChevronRight className="w-6 h-6 stroke-[3]" />
        )}
      </div>
    </div>
  );
}

export function SubjectManagement({ subjects }: { subjects: Subject[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
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
    if (res.error) setError(res.error);
    else {
      setEditingSubject(null);
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
    if (res.error) setError(res.error);
    else {
      setEditingTopic(null);
      router.refresh();
    }
    setLoading(null);
  };

  return (
    <AppShell>
      <div className="min-h-screen py-6 px-4 md:px-8 max-w-4xl mx-auto space-y-6">
        {/* Header with New Subject trigger button */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                <Layers className="w-7 h-7 text-primary" />
                Subjects
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => {
                setShowAddSubjectModal(true);
                setError("");
              }}
              size="sm"
              className="rounded-2xl h-11 px-4 text-xs sm:text-sm font-black shadow-md shadow-primary/20 hover:scale-105 active:scale-95 transition-all gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Subject</span>
            </Button>
            <div className="md:hidden">
              <NavMenu />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-danger text-sm font-bold text-center bg-danger/10 p-4 rounded-2xl border border-danger/20 animate-fade-in">
            {error}
          </p>
        )}

        {/* List of Individual Subject Cards (NO big giant form wrapper!) */}
        {subjects.length === 0 ? (
          <div className="text-center py-20 px-4 text-muted-foreground border-2 border-dashed border-border rounded-3xl space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
              <Layers className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-foreground">No subjects yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Click "Add Subject" above to create your first subject!</p>
            </div>
            <Button
              onClick={() => setShowAddSubjectModal(true)}
              className="rounded-2xl font-black px-6 h-12 shadow-md shadow-primary/20"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create Subject
            </Button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {subjects.map((subject) => {
              const isExpanded = expanded.has(subject.id);
              return (
                <div
                  key={subject.id}
                  className="border-2 border-border/90 rounded-3xl bg-card overflow-hidden shadow-sm transition-all hover:border-border"
                >
                  {/* Subject Card Header */}
                  <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
                    <button
                      onClick={() => toggleExpand(subject.id)}
                      className="flex items-center gap-3 sm:gap-3.5 flex-1 text-left min-w-0 group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-primary" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                        )}
                      </div>

                      {editingSubject === subject.id ? (
                        <div className="flex-1 max-w-sm" onClick={(e) => e.stopPropagation()}>
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
                            className="h-11 text-base font-bold rounded-xl border-2"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <span className="font-black text-lg sm:text-xl truncate block text-foreground">
                            {subject.name}
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {subject.topics.length} topic{subject.topics.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </button>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {editingSubject === subject.id ? (
                        <>
                          <Button
                            size="sm"
                            className="rounded-xl font-bold h-9 px-3 text-xs"
                            onClick={() => handleUpdateSubject(subject.id)}
                            isLoading={loading === `subject-${subject.id}`}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-xl font-bold h-9 px-3 text-xs"
                            onClick={() => setEditingSubject(null)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingSubject(subject.id);
                              setEditValues((prev) => ({
                                ...prev,
                                [`subject-${subject.id}`]: subject.name,
                              }));
                            }}
                            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Rename Subject"
                            aria-label="Rename Subject"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              setDeleteTarget({
                                type: "subject",
                                id: subject.id,
                                name: subject.name,
                                questionCount: subject._count.questions,
                                topicCount: subject.topics.length,
                              })
                            }
                            className="p-2 rounded-xl text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                            title="Delete Subject"
                            aria-label="Delete Subject"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded Topics Area */}
                  {isExpanded && (
                    <div className="border-t border-border/80 p-4 sm:p-5 space-y-2.5 bg-muted/15">
                      {subject.topics.length === 0 ? (
                        <p className="text-xs font-semibold text-muted-foreground py-2 pl-1">
                          No topics yet under this subject.
                        </p>
                      ) : (
                        subject.topics.map((topic) => (
                          <div
                            key={topic.id}
                            className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border/80 shadow-xs"
                          >
                            {editingTopic === topic.id ? (
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
                                  className="h-10 text-sm font-bold rounded-xl border-2"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <span className="text-sm sm:text-base font-bold truncate text-foreground pl-1">
                                {topic.name}
                              </span>
                            )}

                            <div className="flex items-center gap-1 shrink-0">
                              {editingTopic === topic.id ? (
                                <>
                                  <Button
                                    size="sm"
                                    className="rounded-xl font-bold h-8 px-2.5 text-xs"
                                    onClick={() => handleUpdateTopic(topic.id)}
                                    isLoading={loading === `topic-edit-${topic.id}`}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="rounded-xl font-bold h-8 px-2.5 text-xs"
                                    onClick={() => setEditingTopic(null)}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingTopic(topic.id);
                                      setEditValues((prev) => ({
                                        ...prev,
                                        [`topic-${topic.id}`]: topic.name,
                                      }));
                                    }}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                    title="Rename Topic"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setDeleteTarget({
                                        type: "topic",
                                        id: topic.id,
                                        name: topic.name,
                                        questionCount: topic._count.questions,
                                      })
                                    }
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                                    title="Delete Topic"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))
                      )}

                      {/* Add Topic Control inside Subject */}
                      {activeAddTopicSubjectId === subject.id ? (
                        <div className="flex gap-2 pt-2">
                          <Input
                            placeholder="New topic name..."
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
                            className="flex-1 h-11 text-sm font-bold rounded-2xl border-2"
                            autoFocus
                          />
                          <Button
                            onClick={() => handleCreateTopic(subject.id)}
                            isLoading={loading === `topic-${subject.id}`}
                            disabled={!newTopicNames[subject.id]?.trim()}
                            className="h-11 px-4 rounded-2xl font-black shrink-0 text-xs shadow-sm"
                          >
                            <Check className="w-4 h-4 mr-1" /> Add
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setActiveAddTopicSubjectId(null)}
                            className="h-11 px-3 rounded-2xl font-bold text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setActiveAddTopicSubjectId(subject.id)}
                          className="w-full py-2.5 rounded-2xl border-2 border-dashed border-border/80 hover:border-primary/50 text-xs font-black text-muted-foreground hover:text-primary transition-all flex items-center justify-center gap-1.5 hover:bg-primary/5 mt-2"
                        >
                          <Plus className="w-4 h-4" /> Add Topic
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

      {/* Modal: Create New Subject Popup */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <Card className="w-full max-w-md p-6 sm:p-7 rounded-3xl border-2 shadow-2xl space-y-4 bg-card">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Add New Subject
              </h3>
              <button
                onClick={() => setShowAddSubjectModal(false)}
                className="w-8 h-8 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase tracking-wider block">
                Subject Name
              </label>
              <Input
                placeholder="e.g. History, Mathematics, Physics..."
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateSubject()}
                className="h-13 text-base font-bold rounded-2xl border-2"
                autoFocus
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowAddSubjectModal(false)}
                className="flex-1 h-12 rounded-2xl font-bold text-sm border-2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateSubject}
                isLoading={loading === "new-subject"}
                disabled={!newSubjectName.trim()}
                className="flex-1 h-12 rounded-2xl font-black text-sm shadow-md shadow-primary/20"
              >
                Create Subject
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Interactive Delete Confirmation Modal with Slide to Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <Card className="w-full max-w-md p-6 sm:p-8 rounded-3xl border-2 border-danger/30 shadow-2xl space-y-5 bg-card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-danger/15 border-2 border-danger/30 text-danger flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-foreground">
                    Delete {deleteTarget.type === "subject" ? "Subject" : "Topic"}?
                  </h3>
                  <span className="inline-block mt-1 px-3 py-0.5 rounded-lg text-xs font-black bg-danger/10 text-danger border border-danger/20">
                    {deleteTarget.name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="w-8 h-8 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning Details */}
            {deleteTarget.questionCount > 0 ? (
              <div className="p-4 rounded-2xl bg-danger/10 border-2 border-danger/20 space-y-2">
                <p className="text-sm font-black text-danger">
                  ⚠️ This {deleteTarget.type} has {deleteTarget.questionCount} question{deleteTarget.questionCount !== 1 ? "s" : ""}
                  {deleteTarget.topicCount ? ` across ${deleteTarget.topicCount} topic(s)` : ""}!
                </p>
                <p className="text-xs font-semibold text-muted-foreground leading-relaxed">
                  Deleting will permanently erase all questions, mistakes, and data associated with this {deleteTarget.type}.
                </p>
              </div>
            ) : (
              <p className="text-sm font-semibold text-muted-foreground">
                Are you sure you want to delete <strong className="text-foreground">"{deleteTarget.name}"</strong>? This action cannot be undone.
              </p>
            )}

            {/* Slide to confirm if questions > 0 or standard confirm */}
            {deleteTarget.questionCount > 0 ? (
              <div className="space-y-3 pt-1">
                <SlideToConfirm
                  onConfirm={executeDelete}
                  disabled={loading !== null}
                  label="Swipe to Delete Everything"
                />
                <Button
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  className="w-full h-12 rounded-2xl font-bold text-sm border-2 hover:bg-muted"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 h-13 rounded-2xl font-bold text-sm border-2 hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  onClick={executeDelete}
                  isLoading={loading !== null}
                  className="flex-1 h-13 rounded-2xl font-black text-sm bg-danger hover:bg-danger/90 text-white shadow-lg shadow-danger/25"
                >
                  Delete
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
