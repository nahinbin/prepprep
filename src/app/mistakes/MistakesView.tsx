"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { NavMenu, AppShell } from "@/components/NavMenu";
import { BackButton } from "@/components/BackButton";
import { BookOpen, CheckCircle, X, Play } from "lucide-react";

type TopicStat = {
  id: string;
  name: string;
  count: number;
};

type SubjectStat = {
  id: string;
  name: string;
  count: number;
  topics: TopicStat[];
};

export function MistakesView({ subjects }: { subjects: SubjectStat[] }) {
  const router = useRouter();
  const [selectedSubject, setSelectedSubject] = useState<SubjectStat | null>(null);
  const totalMistakes = subjects.reduce((acc, s) => acc + s.count, 0);

  const startRedo = (subjectId?: string, topicId?: string) => {
    const params = new URLSearchParams();
    if (topicId) params.set("topicId", topicId);
    else if (subjectId) params.set("subjectId", subjectId);
    router.push(`/session/redo?${params.toString()}`);
  };

  return (
    <AppShell>
    <div className="min-h-screen flex flex-col items-center py-8 px-4 md:px-8">
      <div className="w-full max-w-4xl flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <BackButton />
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Your Mistakes</h1>
        </div>
        <NavMenu />
      </div>

      <Card className="w-full max-w-4xl p-6 md:p-10">
        {totalMistakes === 0 ? (
          <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-4 opacity-50" />
            <p className="text-lg font-bold">All Caught Up!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {subjects.map((subject) => (
              <button
                key={subject.id}
                onClick={() => setSelectedSubject(subject)}
                className="border-2 border-border bg-background/50 p-8 rounded-2xl shadow-sm hover:border-danger/40 hover:bg-danger/5 transition-all text-left group active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold group-hover:text-danger transition-colors">
                    {subject.name}
                  </h3>
                  <div className="text-center px-5 py-3 bg-danger/10 border border-danger/20 rounded-2xl">
                    <span className="text-4xl font-black text-danger">{subject.count}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedSubject(null)}
          />
          <Card className="relative w-full max-w-lg p-8 rounded-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">{selectedSubject.name}</h2>
              <button
                onClick={() => setSelectedSubject(null)}
                className="inline-flex items-center justify-center w-11 h-11 rounded-2xl hover:bg-muted transition-colors active:scale-95"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <Button
              size="lg"
              className="w-full h-16 text-lg font-bold rounded-2xl mb-8"
              onClick={() => startRedo(selectedSubject.id)}
            >
              <Play className="w-5 h-5 mr-2" />
              Redo All ({selectedSubject.count})
            </Button>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              {selectedSubject.topics.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => startRedo(undefined, topic.id)}
                  className="w-full flex items-center justify-between p-5 border-2 border-border rounded-2xl hover:border-primary/40 hover:bg-primary/5 transition-all text-left active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-muted-foreground" />
                    <span className="text-lg font-bold">{topic.name}</span>
                  </div>
                  <span className="text-2xl font-black text-danger">{topic.count}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
    </AppShell>
  );
}
