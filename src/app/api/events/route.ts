import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ntzs, NtzsApiError } from "@/lib/ntzs";
import { getSession } from "@/lib/auth";
import { broadcastNewEvent } from "@/lib/notify";

// Fee configuration (same as market creation)
const CREATION_FEE_NTZS_USER_ID = process.env.CREATION_FEE_NTZS_USER_ID || "";
const CREATION_FEE_TZS = parseInt(process.env.MARKET_CREATION_FEE_TZS || "2000", 10);

// Admin users exempt from creation fee
const ADMIN_NTZS_USER_IDS = [
  "3017ff5f-24f0-4063-bb35-4ddbc3cd1987",
  "994dcdcc-0bc4-4641-9e94-93e658ede56b",
  "2e7ea0a6-472c-44b9-8a61-b6e2865fe558",
  "c458cdc9-db89-408e-a077-dacb72af789d",
];

// GET /api/events - List all events with their markets
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = parseInt(searchParams.get("offset") || "0");

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (status) where.status = status;

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: {
        markets: {
          select: {
            id: true,
            title: true,
            status: true,
            totalVolume: true,
            yesPool: true,
            noPool: true,
            options: true,
            optionPools: true,
            optionImages: true,
            resolvesAt: true,
            outcome: true,
            outcomeLabel: true,
          },
          orderBy: { createdAt: "asc" },
        },
        creator: {
          select: { username: true, displayName: true, avatarUrl: true },
        },
        _count: {
          select: { markets: true },
        },
      },
      orderBy: { startsAt: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.event.count({ where }),
  ]);

  // Calculate aggregate stats for each event
  const eventsWithStats = events.map((event) => {
    const totalVolume = event.markets.reduce((sum, m) => sum + m.totalVolume, 0);
    const marketsCount = event.markets.length;
    const openMarkets = event.markets.filter((m) => m.status === "OPEN").length;

    return {
      ...event,
      totalVolume,
      marketsCount,
      openMarkets,
    };
  });

  return NextResponse.json({ events: eventsWithStats, total });
}

// POST /api/events - Create a new event
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;

  const body = await request.json();
  const { title, description, category, subCategory, imageUrl, startsAt, endsAt } = body;

  if (!title || !category || !startsAt) {
    return NextResponse.json(
      { error: "Title, category, and startsAt are required" },
      { status: 400 }
    );
  }

  // Load user to check balance and get nTZS user ID
  const user = await prisma.user.findUnique({ 
    where: { id: userId },
    select: { id: true, balanceTzs: true, ntzsUserId: true }
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if user is admin (exempt from fee)
  const isAdmin = user.ntzsUserId && ADMIN_NTZS_USER_IDS.includes(user.ntzsUserId);

  // Charge creation fee (unless admin)
  if (!isAdmin && CREATION_FEE_TZS > 0) {
    // Check balance
    if (user.balanceTzs < CREATION_FEE_TZS) {
      return NextResponse.json({ 
        error: `Insufficient balance. Event creation fee is ${CREATION_FEE_TZS.toLocaleString()} TZS` 
      }, { status: 400 });
    }

    // Transfer fee via nTZS API if user has nTZS account
    if (user.ntzsUserId && CREATION_FEE_NTZS_USER_ID) {
      try {
        await ntzs.transfers.create({
          fromUserId: user.ntzsUserId,
          toUserId: CREATION_FEE_NTZS_USER_ID,
          amountTzs: CREATION_FEE_TZS,
        });
      } catch (err) {
        if (err instanceof NtzsApiError && err.code === "insufficient_balance") {
          return NextResponse.json({ 
            error: `Insufficient balance. Event creation fee is ${CREATION_FEE_TZS.toLocaleString()} TZS` 
          }, { status: 400 });
        }
        console.error("nTZS fee transfer failed:", err);
      }
    }

    // Deduct from local balance
    await prisma.user.update({
      where: { id: userId },
      data: { balanceTzs: { decrement: CREATION_FEE_TZS } },
    });
  }

  const event = await prisma.event.create({
    data: {
      title,
      description: description || "",
      category,
      subCategory,
      imageUrl,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      creatorId: userId,
    },
    include: {
      creator: {
        select: { username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  // Announce the new event to everyone else (bell + push), like markets do.
  // Fire-and-forget so it never delays the create response. Fires once per
  // event — its sub-markets go through a separate route and don't re-broadcast.
  broadcastNewEvent({
    eventId: event.id,
    title: event.title,
    creatorId: userId,
    category: event.category,
  }).catch((e) => console.error("[events] broadcast failed:", e));

  return NextResponse.json({ event }, { status: 201 });
}
