"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const user = await getSession();
  if (!user) return { error: "Not authenticated" };

  const username = formData.get("username") as string;
  const profilePicture = formData.get("profilePicture") as string;

  if (username && username !== user.username) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return { error: "Username already taken." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      username: username || user.username,
      profilePicture: profilePicture || user.profilePicture,
    },
  });

  revalidatePath("/profile");
  revalidatePath("/");
  return { success: true };
}
