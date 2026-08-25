import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { NewSessionForm } from "./NewSessionForm";
import { getEconomySettings } from "@/app/actions/settings";

export default async function NewSessionPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const [subjects, settings] = await Promise.all([
    prisma.subject.findMany({
      where: { userId: user.id },
      include: {
        topics: {
          include: {
            _count: { select: { questions: true } },
          },
          orderBy: { name: "asc" },
        },
        _count: { select: { questions: true } },
      },
      orderBy: { name: "asc" },
    }),
    getEconomySettings(),
  ]);

  return (
    <NewSessionForm
      user={{
        coins: user.coins,
        positivePoints: user.positivePoints,
        negativePoints: user.negativePoints,
      }}
      subjects={subjects}
      settings={settings}
    />
  );
}
