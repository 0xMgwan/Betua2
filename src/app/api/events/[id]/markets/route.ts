import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
const INITIAL_POOL = 100000; // 100,000 TZS per side

// POST /api/events/[id]/markets - Add a market to an event
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;

  // Verify event exists
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = await request.json();
  const { title, description, resolvesAt, options } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Use event's startsAt as default resolvesAt if not provided
  const resolveDate = resolvesAt ? new Date(resolvesAt) : event.startsAt;

  // Determine if this is a multi-option market
  const isMultiOption = options && Array.isArray(options) && options.length >= 2;

  let marketData: Record<string, unknown> = {
    title,
    description: description || `Market for ${event.title}`,
    category: event.category,
    subCategory: event.subCategory,
    imageUrl: event.imageUrl,
    resolvesAt: resolveDate,
    creatorId: userId,
    eventId,
  };

  if (isMultiOption) {
    // Multi-option market: each option gets equal initial pool
    const optionPools = options.map(() => INITIAL_POOL);
    marketData = {
      ...marketData,
      options,
      optionPools,
      yesPool: 0,
      noPool: 0,
      liquidity: INITIAL_POOL * options.length,
    };
  } else {
    // Binary YES/NO market
    marketData = {
      ...marketData,
      yesPool: INITIAL_POOL,
      noPool: INITIAL_POOL,
      liquidity: INITIAL_POOL * 2,
    };
  }

  const market = await prisma.market.create({
    data: marketData as Parameters<typeof prisma.market.create>[0]["data"],
    include: {
      creator: {
        select: { username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  return NextResponse.json({ market }, { status: 201 });
}
