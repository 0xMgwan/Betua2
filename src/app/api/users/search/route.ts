import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// Lightweight username autocomplete for @mentions in comments.
// Returns up to 6 usernames (+ avatar) matching the prefix, real users only.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ users: [] });

  const q = (new URL(req.url).searchParams.get("q") || "").trim().replace(/^@/, "");
  if (q.length < 1) return NextResponse.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      username: { startsWith: q, mode: "insensitive" },
      NOT: { username: { startsWith: "deleted_" } },
    },
    select: { username: true, avatarUrl: true },
    orderBy: { username: "asc" },
    take: 6,
  });

  return NextResponse.json({ users });
}
