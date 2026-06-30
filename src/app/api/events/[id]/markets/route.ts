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
  const { title, description, resolvesAt, options, optionProbs, initialProb } = body;

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
    // Multi-option market: weight initial pools by probability when provided.
    // pool_i = INITIAL_POOL / (n * p_i)  →  P(i) = (1/pool_i) / Σ(1/pool_j) = p_i
    const n = options.length;
    const hasValidProbs =
      Array.isArray(optionProbs) &&
      optionProbs.length === n &&
      optionProbs.every((p: number) => p > 0) &&
      Math.abs(optionProbs.reduce((s: number, p: number) => s + p, 0) - 100) <= 1;

    const optionPools = hasValidProbs
      ? options.map((_: unknown, i: number) => Math.round(INITIAL_POOL / (n * (optionProbs[i] / 100))))
      : options.map(() => INITIAL_POOL);

    marketData = {
      ...marketData,
      options,
      optionPools,
      yesPool: 0,
      noPool: 0,
      liquidity: optionPools.reduce((s: number, v: number) => s + v, 0),
    };
  } else {
    // Binary YES/NO market — seed pools from initial probability when provided.
    // P(YES) = noPool / (yesPool + noPool) = p  →  noPool = p·L, yesPool = (1−p)·L
    const TOTAL_LIQUIDITY = INITIAL_POOL * 2;
    const p =
      initialProb != null ? Math.max(1, Math.min(99, Number(initialProb))) / 100 : 0.5;
    marketData = {
      ...marketData,
      yesPool: Math.round((1 - p) * TOTAL_LIQUIDITY),
      noPool: Math.round(p * TOTAL_LIQUIDITY),
      liquidity: TOTAL_LIQUIDITY,
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
