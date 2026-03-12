import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { title, description, imageUrl, resolvesAt, category, subCategory } = await req.json();

    // Find the market and verify ownership
    const market = await prisma.market.findUnique({
      where: { id },
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

    // Update the market
    const updatedMarket = await prisma.market.update({
      where: { id },
      data: {
        title: title || market.title,
        description: description || market.description,
        imageUrl: imageUrl !== undefined ? imageUrl : market.imageUrl,
        resolvesAt: resolvesAt ? new Date(resolvesAt) : market.resolvesAt,
        category: category || market.category,
        subCategory: subCategory !== undefined ? subCategory : market.subCategory,
      },
    });

    return NextResponse.json({ market: updatedMarket });
  } catch (err) {
    console.error("Market edit error:", err);
    const errorMessage = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
