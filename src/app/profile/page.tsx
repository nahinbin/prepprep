import { getSession } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const user = await getSession();
  if (!user) redirect("/login");
  
  return <ProfileForm user={user} />;
}
