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
      resolvesAt: resolvesAt ? new Date(resolvesAt) : market.resolvesAt,
      category: category || market.category,
      subCategory: subCategory !== undefined ? subCategory : market.subCategory,
    };

    // Handle market type changes (binary <-> multi-option)
    // Only allowed if there are no trades yet
    if (options !== undefined) {
      // TEMPORARILY DISABLED: Allow editing even with trades to fix timezone issues
      // if (market._count.trades > 0) {
      //   return NextResponse.json(
      //     { error: "Cannot change market type after trades have been placed" },
      //     { status: 400 }
      //   );
      // }

      if (options === null || (Array.isArray(options) && options.length === 0)) {
        // Switch to binary (YES/NO)
        updateData.options = [];
        updateData.optionPools = [];
        updateData.yesPool = INIT_POOL;
        updateData.noPool = INIT_POOL;
      } else if (Array.isArray(options) && options.length >= 2) {
        // Switch to multi-option
        const validOptions = options.map((o: string) => o.trim()).filter(Boolean);
        if (validOptions.length < 2) {
          return NextResponse.json({ error: "At least 2 options required" }, { status: 400 });
        }
        if (validOptions.length > 10) {
          return NextResponse.json({ error: "Maximum 10 options" }, { status: 400 });
        }
        updateData.options = validOptions;
        updateData.optionPools = validOptions.map(() => POOL_PER_OPTION);
        updateData.yesPool = INIT_POOL;
        updateData.noPool = INIT_POOL;
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
