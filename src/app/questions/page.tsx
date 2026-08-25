import { getSession } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { getQuestionBankData } from "@/app/actions/questions";
import { QuestionsClient } from "./QuestionsClient";

export default async function QuestionsPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const data = await getQuestionBankData();

  return (
    <QuestionsClient
      initialSubjects={data.subjects}
      initialQuestions={data.questions}
      totalCount={data.totalQuestionsCount}
    />
  );
}
