import { getSession } from "@/app/actions/auth";
import { getUserHistory } from "@/app/actions/admin-users";
import { redirect } from "next/navigation";
import { HistoryView } from "./HistoryView";

export default async function HistoryPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const data = await getUserHistory();
  if ("error" in data) redirect("/login");

  return (
    <HistoryView
      transactions={data.transactions}
      orders={data.orders}
      sessions={data.sessions}
    />
  );
}
