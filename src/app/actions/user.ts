"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const user = await getSession();
  if (!user) return { error: "Not authenticated" };

  const username = formData.get("username") as string;
  const profilePicture = formData.get("profilePicture") as string;
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const bio = formData.get("bio") as string;
  const isPublic = formData.get("isPublic") === "true";

  if (username && username !== user.username) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return { error: "Username already taken." };
  }

  if (email) {
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail && existingEmail.id !== user.id) return { error: "Email already taken." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      username: username || user.username,
      profilePicture: profilePicture || user.profilePicture,
      name: name !== null ? name : undefined,
      email: email !== null ? email : undefined,
      bio: bio !== null ? bio : undefined,
      isPublic: isPublic,
    },
  });

  revalidatePath("/profile");
  revalidatePath("/");
  return { success: true };
}
