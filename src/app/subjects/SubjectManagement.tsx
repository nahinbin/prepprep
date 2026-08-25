"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newTopicNames, setNewTopicNames] = useState<Record<string, string>>({});
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
    if (res.error) setError(res.error);
    else {
      setNewSubjectName("");
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
    if (res.error) setError(res.error);
    else {
      setNewTopicNames((prev) => ({ ...prev, [subjectId]: "" }));
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
      <div className="min-h-screen flex flex-col items-center py-6 px-4 md:px-8">
        <div className="w-full max-w-4xl flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <BackButton />
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
              <Layers className="w-7 h-7 text-primary" />
              Subjects & Topics
            </h1>
          </div>
          <div className="md:hidden">
            <NavMenu />
          </div>
        </div>

        <Card className="w-full max-w-4xl p-6 md:p-8 rounded-3xl border-2 shadow-xl backdrop-blur-md">
          {/* Create Subject Input */}
          <div className="flex gap-3 mb-8">
            <Input
              placeholder="Enter new subject name..."
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateSubject()}
              className="flex-1 h-14 text-base font-bold rounded-2xl border-2"
            />
            <Button
              onClick={handleCreateSubject}
              isLoading={loading === "new-subject"}
              disabled={!newSubjectName.trim()}
              size="lg"
              className="h-14 px-6 rounded-2xl text-base font-black shrink-0 shadow-md shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5 mr-1.5" />
              Add Subject
            </Button>
          </div>

          {error && (
            <p className="text-danger text-sm font-bold text-center bg-danger/10 p-4 rounded-2xl mb-6 border border-danger/20 animate-fade-in">
              {error}
            </p>
          )}

          {subjects.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-3xl">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-40 text-primary" />
              <p className="text-lg font-bold text-foreground">No subjects created yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first subject above to organize your questions.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {subjects.map((subject) => {
                const isExpanded = expanded.has(subject.id);
                return (
                  <div
                    key={subject.id}
                    className="border-2 border-border rounded-3xl bg-card/60 overflow-hidden shadow-sm transition-all hover:border-border/90"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 p-5 sm:p-6">
                      <button
                        onClick={() => toggleExpand(subject.id)}
                        className="flex items-center gap-3 sm:gap-4 flex-1 text-left min-w-0 group"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-6 h-6 text-primary shrink-0 transition-transform" />
                        ) : (
                          <ChevronRight className="w-6 h-6 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                        )}
                        {editingSubject === subject.id ? (
                          <Input
                            value={editValues[`subject-${subject.id}`] ?? subject.name}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                [`subject-${subject.id}`]: e.target.value,
                              }))
                            }
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter") handleUpdateSubject(subject.id);
                              if (e.key === "Escape") setEditingSubject(null);
                            }}
                            className="max-w-sm h-12 text-base font-bold rounded-2xl border-2"
                            autoFocus
                          />
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

                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <div className="px-4 py-1.5 bg-primary/10 border-2 border-primary/20 rounded-2xl">
                          <span className="text-lg sm:text-xl font-black text-primary">
                            {subject._count.questions} Qs
                          </span>
                        </div>

                        {editingSubject === subject.id ? (
                          <>
                            <Button
                              size="sm"
                              className="rounded-2xl font-bold"
                              onClick={() => handleUpdateSubject(subject.id)}
                              isLoading={loading === `subject-${subject.id}`}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-2xl font-bold"
                              onClick={() => setEditingSubject(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-2xl w-10 h-10 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
                              onClick={() => {
                                setEditingSubject(subject.id);
                                setEditValues((prev) => ({
                                  ...prev,
                                  [`subject-${subject.id}`]: subject.name,
                                }));
                              }}
                              title="Rename subject"
                            >
                              <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-2xl w-10 h-10 p-0 text-danger hover:text-danger hover:bg-danger/10 transition-colors"
                              onClick={() =>
                                setDeleteTarget({
                                  type: "subject",
                                  id: subject.id,
                                  name: subject.name,
                                  questionCount: subject._count.questions,
                                  topicCount: subject.topics.length,
                                })
                              }
                              title="Delete subject"
                            >
                              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t-2 border-border/60 px-5 sm:px-6 pb-6 pt-4 space-y-3 bg-muted/20">
                        {subject.topics.length === 0 ? (
                          <p className="text-xs font-semibold text-muted-foreground py-2 pl-4">
                            No topics added yet. Add a topic below.
                          </p>
                        ) : (
                          subject.topics.map((topic) => (
                            <div
                              key={topic.id}
                              className="flex items-center gap-3 py-2.5 px-4 rounded-2xl bg-card border-2 border-border/70 transition-all hover:border-primary/30"
                            >
                              {editingTopic === topic.id ? (
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
                                  className="flex-1 h-11 text-base font-bold rounded-xl border-2"
                                  autoFocus
                                />
                              ) : (
                                <span className="flex-1 text-base font-bold truncate text-foreground">
                                  {topic.name}
                                </span>
                              )}

                              <div className="px-3 py-1 bg-muted rounded-xl border border-border">
                                <span className="text-sm font-black text-muted-foreground">
                                  {topic._count.questions} Qs
                                </span>
                              </div>

                              {editingTopic === topic.id ? (
                                <>
                                  <Button
                                    size="sm"
                                    className="rounded-xl font-bold"
                                    onClick={() => handleUpdateTopic(topic.id)}
                                    isLoading={loading === `topic-edit-${topic.id}`}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="rounded-xl font-bold"
                                    onClick={() => setEditingTopic(null)}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="rounded-xl w-9 h-9 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
                                    onClick={() => {
                                      setEditingTopic(topic.id);
                                      setEditValues((prev) => ({
                                        ...prev,
                                        [`topic-${topic.id}`]: topic.name,
                                      }));
                                    }}
                                    title="Rename topic"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="rounded-xl w-9 h-9 p-0 text-danger hover:text-danger hover:bg-danger/10 transition-colors"
                                    onClick={() =>
                                      setDeleteTarget({
                                        type: "topic",
                                        id: topic.id,
                                        name: topic.name,
                                        questionCount: topic._count.questions,
                                      })
                                    }
                                    title="Delete topic"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          ))
                        )}

                        {/* Add Topic input */}
                        <div className="flex gap-2.5 pt-2">
                          <Input
                            placeholder="Add new topic name..."
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
                            className="flex-1 h-12 text-base font-bold rounded-2xl border-2"
                          />
                          <Button
                            onClick={() => handleCreateTopic(subject.id)}
                            isLoading={loading === `topic-${subject.id}`}
                            disabled={!newTopicNames[subject.id]?.trim()}
                            className="h-12 px-5 rounded-2xl font-black shrink-0 hover:scale-105 active:scale-95 transition-all shadow-sm"
                          >
                            <Plus className="w-4 h-4 mr-1.5" />
                            Add Topic
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

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
                  Deleting will permanently erase all questions, mistakes, and data associated with this {deleteTarget.type}. This action cannot be undone.
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
