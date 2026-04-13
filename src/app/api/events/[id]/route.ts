import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrice, getMultiOptionPrices } from "@/lib/amm";
import { getSession } from "@/lib/auth";

// GET /api/events/[id] - Get single event with all markets
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      markets: {
        include: {
          _count: { select: { trades: true, comments: true } },
          creator: {
            select: { username: true, displayName: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      comments: {
        include: {
          user: { select: { username: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      creator: {
        select: { username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Add price calculations to each market
  const marketsWithPrices = event.markets.map((market) => {
    const isMultiOption = market.options && (market.options as string[]).length >= 2;
    
    if (isMultiOption) {
      const optionPools = (market.optionPools as number[]) || [];
      const optionPrices = getMultiOptionPrices(optionPools);
      return {
        ...market,
        price: { yes: 0.5, no: 0.5 }, // placeholder for multi-option
        optionPrices,
      };
    } else {
      const price = getPrice(market.yesPool, market.noPool);
      return {
        ...market,
        price,
        optionPrices: null,
      };
    }
  });

  // Calculate aggregate stats
  const totalVolume = event.markets.reduce((sum, m) => sum + m.totalVolume, 0);
  const totalTrades = event.markets.reduce((sum, m) => sum + m._count.trades, 0);

  return NextResponse.json({
    event: {
      ...event,
      markets: marketsWithPrices,
      totalVolume,
      totalTrades,
    },
  });
}

// PATCH /api/events/[id] - Update event
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.creatorId !== userId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, imageUrl, startsAt, endsAt, status, category, subCategory } = body;

  const updatedEvent = await prisma.event.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(startsAt && { startsAt: new Date(startsAt) }),
      ...(endsAt !== undefined && { endsAt: endsAt ? new Date(endsAt) : null }),
      ...(status && { status }),
      ...(category && { category }),
      ...(subCategory !== undefined && { subCategory }),
    },
    include: {
      markets: true,
      creator: {
        select: { username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  return NextResponse.json({ event: updatedEvent });
}

// DELETE /api/events/[id] - Delete event (only if no markets)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;

  const event = await prisma.event.findUnique({
    where: { id },
    include: { _count: { select: { markets: true } } },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.creatorId !== userId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (event._count.markets > 0) {
    return NextResponse.json(
      { error: "Cannot delete event with existing markets" },
      { status: 400 }
    );
  }

  await prisma.event.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
