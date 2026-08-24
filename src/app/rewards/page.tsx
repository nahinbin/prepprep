import { getSession } from "@/app/actions/auth";
import { getActiveRewardsForUser } from "@/app/actions/rewards";
import { redirect } from "next/navigation";
import { RewardsStore } from "./RewardsStore";

export default async function RewardsPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const data = await getActiveRewardsForUser();
  if ("error" in data || !data.rewards || !data.user) redirect("/login");

  return <RewardsStore rewards={data.rewards} user={data.user} />;
}
