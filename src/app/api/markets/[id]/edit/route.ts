import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const INIT_POOL = 100_000;
const POOL_PER_OPTION = 5_000;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { title, description, imageUrl, resolvesAt, category, subCategory, options } = await req.json();

    // Find the market and verify ownership
    const market = await prisma.market.findUnique({
      where: { id },
      include: { _count: { select: { trades: true } } },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    if (market.creatorId !== session.userId) {
      return NextResponse.json({ error: "Only the creator can edit this market" }, { status: 403 });
    }

    // Don't allow editing resolved markets
    if (market.status === "RESOLVED") {
      return NextResponse.json({ error: "Cannot edit resolved markets" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      title: title || market.title,
      description: description || market.description,
      imageUrl: imageUrl !== undefined ? imageUrl : market.imageUrl,
      resolvesAt: resolvesAt ? (() => {
        // Parse as EAT (GMT+3) - subtract 3 hours to get UTC
        const [datePart, timePart] = resolvesAt.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        return new Date(Date.UTC(year, month - 1, day, hour - 3, minute));
      })() : market.resolvesAt,
      category: category || market.category,
      subCategory: subCategory !== undefined ? subCategory : market.subCategory,
    };

    // Handle option edits. Renaming labels is always safe (positions/pools are
    // keyed by option index), so it's allowed even after trades. Structural
    // changes (binary<->multi, adding/removing options) reset the pools and are
    // therefore blocked once trades exist.
    if (options !== undefined) {
      const currentOptions = (market.options as string[] | null) || [];
      const isCurrentlyMulti = currentOptions.length >= 2;
      const hasTrades = market._count.trades > 0;

      if (options === null || (Array.isArray(options) && options.length === 0)) {
        // Switch to binary (YES/NO) — structural change.
        if (hasTrades && isCurrentlyMulti) {
          return NextResponse.json({ error: "Cannot change market type after trades have been placed" }, { status: 400 });
        }
        updateData.options = [];
        updateData.optionPools = [];
        updateData.yesPool = INIT_POOL;
        updateData.noPool = INIT_POOL;
      } else if (Array.isArray(options) && options.length >= 2) {
        const validOptions = options.map((o: string) => o.trim()).filter(Boolean);
        if (validOptions.length < 2) {
          return NextResponse.json({ error: "At least 2 options required" }, { status: 400 });
        }
        if (validOptions.length > 10) {
          return NextResponse.json({ error: "Maximum 10 options" }, { status: 400 });
        }

        // Pure rename: same number of options on an already-multi market — keep
        // the existing pools/odds and just update the labels.
        const isRename = isCurrentlyMulti && validOptions.length === currentOptions.length;
        if (hasTrades && !isRename) {
          return NextResponse.json(
            { error: "After trades you can only rename existing options, not add, remove, or change the market type." },
            { status: 400 }
          );
        }

        updateData.options = validOptions;
        if (!isRename) {
          // Structural change (no trades) — (re)seed equal pools.
          updateData.optionPools = validOptions.map(() => POOL_PER_OPTION);
          updateData.yesPool = INIT_POOL;
          updateData.noPool = INIT_POOL;
        }
      }
    }

    // Update the market
    const updatedMarket = await prisma.market.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ market: updatedMarket });
  } catch (err) {
    console.error("Market edit error:", err);
    const errorMessage = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
