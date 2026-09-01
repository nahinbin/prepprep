import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { getMistakeStatsBySubject } from "@/app/actions/subjects";
import { redirect } from "next/navigation";
import { MistakesView } from "./MistakesView";

export default async function MistakesPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { negativePoints: true }
  });

  const subjects = await getMistakeStatsBySubject();

  return <MistakesView subjects={subjects} xpLost={dbUser?.negativePoints || 0} />;
}
