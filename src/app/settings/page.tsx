import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) redirect("/login");

  let dbUser = null;
  try {
    dbUser = await prisma.user.findUnique({ where: { id: userId } });
  } catch {
    dbUser = null;
  }

  return <SettingsClient user={dbUser} />;
}
