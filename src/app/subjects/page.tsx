import { getSession } from "@/app/actions/auth";
import { getSubjectsWithStats } from "@/app/actions/subjects";
import { redirect } from "next/navigation";
import { SubjectManagement } from "./SubjectManagement";

export default async function SubjectsPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const subjects = await getSubjectsWithStats();

  return <SubjectManagement subjects={subjects} />;
}
