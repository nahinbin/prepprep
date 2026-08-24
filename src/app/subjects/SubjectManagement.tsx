"use client";

import { useState } from "react";
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

  const handleDeleteSubject = async (id: string, name: string) => {
    if (!confirm(`Delete subject "${name}"?`)) return;
    setLoading(`del-subject-${id}`);
    setError("");
    const res = await deleteSubject(id);
    if (res.error) setError(res.error);
    else router.refresh();
    setLoading(null);
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

  const handleDeleteTopic = async (id: string, name: string) => {
    if (!confirm(`Delete topic "${name}"?`)) return;
    setLoading(`del-topic-${id}`);
    setError("");
    const res = await deleteTopic(id);
    if (res.error) setError(res.error);
    else router.refresh();
    setLoading(null);
  };

  return (
    <AppShell>
    <div className="min-h-screen flex flex-col items-center py-8 px-4 md:px-8">
      <div className="w-full max-w-4xl flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <BackButton />
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Subjects</h1>
        </div>
        <NavMenu />
      </div>

      <Card className="w-full max-w-4xl p-6 md:p-10">
        <div className="flex gap-4 mb-8">
          <Input
            placeholder="Subject name"
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateSubject()}
            className="flex-1 h-14 text-lg rounded-2xl"
          />
          <Button
            onClick={handleCreateSubject}
            isLoading={loading === "new-subject"}
            disabled={!newSubjectName.trim()}
            size="lg"
            className="h-14 px-6 rounded-2xl text-lg font-bold shrink-0"
          >
            <Plus className="w-5 h-5 mr-2" />
            Subject
          </Button>
        </div>

        {error && (
          <p className="text-danger text-sm font-medium text-center bg-danger/10 p-4 rounded-2xl mb-6">
            {error}
          </p>
        )}

        {subjects.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
            <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-bold">No subjects yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {subjects.map((subject) => {
              const isExpanded = expanded.has(subject.id);
              return (
                <div
                  key={subject.id}
                  className="border-2 border-border rounded-2xl bg-background/50 overflow-hidden"
                >
                  <div className="flex items-center gap-4 p-6">
                    <button
                      onClick={() => toggleExpand(subject.id)}
                      className="flex items-center gap-4 flex-1 text-left min-w-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-6 h-6 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="w-6 h-6 text-muted-foreground shrink-0" />
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
                          className="max-w-sm h-12 text-lg rounded-2xl"
                          autoFocus
                        />
                      ) : (
                        <span className="font-bold text-xl truncate">{subject.name}</span>
                      )}
                    </button>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="px-5 py-2 bg-primary/10 border border-primary/20 rounded-2xl">
                        <span className="text-2xl font-black text-primary">
                          {subject._count.questions}
                        </span>
                      </div>

                      {editingSubject === subject.id ? (
                        <>
                          <Button
                            size="sm"
                            className="rounded-2xl"
                            onClick={() => handleUpdateSubject(subject.id)}
                            isLoading={loading === `subject-${subject.id}`}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-2xl"
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
                            className="rounded-2xl w-10 h-10 p-0"
                            onClick={() => {
                              setEditingSubject(subject.id);
                              setEditValues((prev) => ({
                                ...prev,
                                [`subject-${subject.id}`]: subject.name,
                              }));
                            }}
                          >
                            <Pencil className="w-5 h-5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-2xl w-10 h-10 p-0 text-danger hover:text-danger hover:bg-danger/10"
                            onClick={() => handleDeleteSubject(subject.id, subject.name)}
                            isLoading={loading === `del-subject-${subject.id}`}
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t-2 border-border px-6 pb-6 pt-4 space-y-3">
                      {subject.topics.map((topic) => (
                        <div
                          key={topic.id}
                          className="flex items-center gap-4 py-3 pl-10"
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
                              className="flex-1 h-12 text-lg rounded-2xl"
                              autoFocus
                            />
                          ) : (
                            <span className="flex-1 text-lg font-bold">{topic.name}</span>
                          )}

                          <div className="px-4 py-1 bg-muted/50 border border-border rounded-2xl">
                            <span className="text-xl font-black">{topic._count.questions}</span>
                          </div>

                          {editingTopic === topic.id ? (
                            <>
                              <Button
                                size="sm"
                                className="rounded-2xl"
                                onClick={() => handleUpdateTopic(topic.id)}
                                isLoading={loading === `topic-edit-${topic.id}`}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-2xl"
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
                                className="rounded-2xl w-10 h-10 p-0"
                                onClick={() => {
                                  setEditingTopic(topic.id);
                                  setEditValues((prev) => ({
                                    ...prev,
                                    [`topic-${topic.id}`]: topic.name,
                                  }));
                                }}
                              >
                                <Pencil className="w-5 h-5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-2xl w-10 h-10 p-0 text-danger hover:text-danger hover:bg-danger/10"
                                onClick={() => handleDeleteTopic(topic.id, topic.name)}
                                isLoading={loading === `del-topic-${topic.id}`}
                              >
                                <Trash2 className="w-5 h-5" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}

                      <div className="flex gap-3 pl-10 pt-2">
                        <Input
                          placeholder="Topic name"
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
                          className="flex-1 h-12 text-lg rounded-2xl"
                        />
                        <Button
                          onClick={() => handleCreateTopic(subject.id)}
                          isLoading={loading === `topic-${subject.id}`}
                          disabled={!newTopicNames[subject.id]?.trim()}
                          className="h-12 px-5 rounded-2xl font-bold shrink-0"
                        >
                          <Plus className="w-5 h-5 mr-2" />
                          Topic
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
    </AppShell>
  );
}
