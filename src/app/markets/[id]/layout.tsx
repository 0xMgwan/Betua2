import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getPrice } from "@/lib/amm";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;

  try {
    const market = await prisma.market.findUnique({
      where: { id },
      select: {
        title: true,
        description: true,
        category: true,
        yesPool: true,
        noPool: true,
        totalVolume: true,
        imageUrl: true,
      },
    });

    if (!market) {
      return {
        title: "Market Not Found — GUAP",
      };
    }

    const price = getPrice(market.yesPool, market.noPool);
    const yesPrice = Math.round(price.yes * 100);
    const noPrice = Math.round(price.no * 100);

    const desc = `YES ${yesPrice}% · NO ${noPrice}% — ${market.description?.slice(0, 120) || market.title}`;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://guap.gold";
    const ogImageUrl = `${baseUrl}/markets/${id}/opengraph-image`;

    return {
      title: `${market.title} — GUAP`,
      description: desc,
      openGraph: {
        title: market.title,
        description: desc,
        siteName: "GUAP",
        type: "article",
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: market.title,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: market.title,
        description: desc,
        images: [ogImageUrl],
      },
    };
  } catch {
    return {
      title: "GUAP — Predict the Future",
    };
  }
}

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
