"use server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function getSession() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  return user;
}

export async function login(formData: FormData) {
  const username = (formData.get("username") as string)?.trim();
  const password = formData.get("password") as string;

  if (!username || !password) {
    return { error: "Username and password are required." };
  }

  // Admin credentials from .env — not a normal user account
  const adminUser = process.env.ADMIN_USERNAME || "admin";
  const adminPass = process.env.ADMIN_PASSWORD || "";
  if (adminPass && username === adminUser && password === adminPass) {
    const cookieStore = await cookies();
    cookieStore.set(
      "adminAuth",
      Buffer.from(`${adminUser}:${adminPass}`).toString("base64"),
      {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      }
    );
    cookieStore.delete("userId");
    redirect("/admin");
  }

  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user || user.password !== password) {
    return { error: "Invalid username or password." };
  }

  const cookieStore = await cookies();
  cookieStore.set("userId", user.id, {
    httpOnly: true,
    path: "/",
  });

  redirect("/");
}

export async function register(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const profilePicture = formData.get("profilePicture") as string; // Base64

  if (!username || !password) {
    return { error: "Username and password are required." };
  }

  if (username.toLowerCase() === "admin") {
    return { error: "This username is reserved." };
  }

  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUser) {
    return { error: "Username already taken." };
  }

  const { getEconomySettings } = await import("@/app/actions/settings");
  const settings = await getEconomySettings();

  const user = await prisma.user.create({
    data: {
      username,
      password, // Plain text for local version
      profilePicture: profilePicture || null,
      coins: settings.startingCoins,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set("userId", user.id, {
    httpOnly: true,
    path: "/",
  });

  redirect("/");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("userId");
  redirect("/login");
}
