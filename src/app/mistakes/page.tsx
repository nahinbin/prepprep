import { getSession } from "@/app/actions/auth";
import { getMistakeStatsBySubject } from "@/app/actions/subjects";
import { redirect } from "next/navigation";
import { MistakesView } from "./MistakesView";

export default async function MistakesPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const subjects = await getMistakeStatsBySubject();

  return <MistakesView subjects={subjects} />;
}
