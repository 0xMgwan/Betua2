import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { displayName, bio, avatarUrl, phone } = await req.json();

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { displayName, bio, avatarUrl, phone },
    select: {
      id: true, email: true, username: true, displayName: true,
      phone: true, bio: true, avatarUrl: true,
    },
  });

  return NextResponse.json({ user });
}
