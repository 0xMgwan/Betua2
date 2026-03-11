import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/notifications — list user's notifications
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const unreadOnly = searchParams.get("unread") === "true";

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.userId,
      ...(unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: session.userId, read: false },
  });

  return NextResponse.json({ notifications, unreadCount });
}

// PATCH /api/notifications — mark notifications as read
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids, all } = await req.json();

  if (all) {
    await prisma.notification.updateMany({
      where: { userId: session.userId, read: false },
      data: { read: true },
    });
  } else if (Array.isArray(ids) && ids.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: ids }, userId: session.userId },
      data: { read: true },
    });
  } else {
    return NextResponse.json({ error: "Provide 'ids' array or 'all: true'" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/notifications — clear all notifications
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.notification.deleteMany({
    where: { userId: session.userId },
  });

  return NextResponse.json({ ok: true });
}
