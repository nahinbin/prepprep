"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_COOKIE = "adminAuth";

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token) return false;

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "";
  if (!password) return false;

  return token === Buffer.from(`${username}:${password}`).toString("base64");
}

export async function requireAdmin() {
  const ok = await isAdminAuthenticated();
  if (!ok) redirect("/admin/login");
}

export async function adminLogin(formData: FormData) {
  const username = (formData.get("username") as string)?.trim();
  const password = formData.get("password") as string;

  const expectedUser = process.env.ADMIN_USERNAME || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD || "";

  if (!username || !password) {
    return { error: "Username and password are required." };
  }

  if (username !== expectedUser || password !== expectedPass) {
    return { error: "Invalid admin credentials." };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    ADMIN_COOKIE,
    Buffer.from(`${expectedUser}:${expectedPass}`).toString("base64"),
    {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    }
  );

  redirect("/admin");
}

export async function adminLogout() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
