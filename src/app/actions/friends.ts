"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "./auth";
import { revalidatePath } from "next/cache";

export async function sendFriendRequest(targetUsername: string) {
  const user = await getSession();
  if (!user) return { error: "Not authenticated" };

  if (user.username === targetUsername) {
    return { error: "You cannot add yourself as a friend." };
  }

  const targetUser = await prisma.user.findUnique({
    where: { username: targetUsername },
  });

  if (!targetUser) {
    return { error: "User not found." };
  }

  // Check if a friendship already exists in either direction
  const existingFriendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: user.id, friendId: targetUser.id },
        { userId: targetUser.id, friendId: user.id },
      ],
    },
  });

  if (existingFriendship) {
    return { error: "Friendship or pending request already exists." };
  }

  // Create Friendship
  await prisma.friendship.create({
    data: {
      userId: user.id,
      friendId: targetUser.id,
      status: "pending",
    },
  });

  // Create Notification for the target user
  await prisma.notification.create({
    data: {
      userId: targetUser.id,
      type: "FRIEND_REQUEST",
      content: `${user.username} sent you a friend request.`,
      link: "/friends",
    },
  });

  revalidatePath("/friends");
  return { success: true };
}

export async function respondToFriendRequest(friendshipId: string, accept: boolean) {
  const user = await getSession();
  if (!user) return { error: "Not authenticated" };

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
    include: { user: true },
  });

  if (!friendship) return { error: "Friend request not found." };
  if (friendship.friendId !== user.id) return { error: "Unauthorized." };

  if (accept) {
    await prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: "accepted" },
    });

    // Notify the person who sent the request
    await prisma.notification.create({
      data: {
        userId: friendship.userId,
        type: "FRIEND_ACCEPT",
        content: `${user.username} accepted your friend request!`,
        link: "/friends",
      },
    });
  } else {
    await prisma.friendship.delete({
      where: { id: friendshipId },
    });
  }

  revalidatePath("/friends");
  return { success: true };
}

export async function removeFriend(friendshipId: string) {
  const user = await getSession();
  if (!user) return { error: "Not authenticated" };

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) return { error: "Friendship not found." };
  if (friendship.userId !== user.id && friendship.friendId !== user.id) {
    return { error: "Unauthorized." };
  }

  await prisma.friendship.delete({
    where: { id: friendshipId },
  });

  revalidatePath("/friends");
  return { success: true };
}
