import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notifyMentions } from "@/lib/mentions";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { body } = await req.json();

  if (!body?.trim()) return NextResponse.json({ error: "Empty comment" }, { status: 400 });

  const comment = await prisma.comment.create({
    data: { userId: session.userId, marketId: id, body: body.trim() },
    include: {
      user: { select: { username: true, avatarUrl: true } },
      market: { select: { title: true } },
    },
  });

  // Notify any @mentioned users (in-app + push). Non-blocking.
  await notifyMentions({
    body: comment.body,
    authorId: session.userId,
    authorUsername: comment.user.username,
    contextTitle: comment.market?.title || "a market",
    link: `/markets/${id}`,
  });

  return NextResponse.json({ comment });
}
