import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { ReviewView } from "./ReviewView";

export default async function SessionReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      attempts: {
        orderBy: { id: "asc" },
      },
    },
  });

  if (!session || session.userId !== user.id) {
    redirect("/");
  }

  const formattedAttempts = session.attempts.map((att) => {
    let options: Record<string, string> = {};
    try {
      options = JSON.parse(att.options);
    } catch {
      options = {};
    }

    return {
      id: att.id,
      question: att.question,
      options,
      rawOptions: att.options,
      correctAnswer: att.correctAnswer,
      selectedAnswer: att.selectedAnswer,
      isCorrect: att.isCorrect,
      pointsGained: att.pointsGained,
      pointsLost: att.pointsLost,
    };
  });

  return (
    <ReviewView
      session={{
        id: session.id,
        totalQuestions: session.totalQuestions,
        correctAnswers: session.correctAnswers,
        wrongAnswers: session.wrongAnswers,
        isPractice: session.isPractice,
        createdAt: session.createdAt.toISOString(),
      }}
      attempts={formattedAttempts}
    />
  );
}
