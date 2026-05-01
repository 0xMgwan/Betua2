import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getPrice, getMultiOptionPrices } from "@/lib/amm";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const market = await (prisma.market as any).findUnique({
      where: { id },
      select: {
        title: true,
        description: true,
        category: true,
        yesPool: true,
        noPool: true,
        options: true,
        optionPools: true,
        totalVolume: true,
        imageUrl: true,
      },
    });

    if (!market) return { title: "Market Not Found — GUAP" };

    const opts = market.options as string[] | null;
    const pools = market.optionPools as number[] | null;
    const isMulti = Array.isArray(opts) && opts.length >= 2 && Array.isArray(pools);

    let desc: string;
    if (isMulti) {
      const prices = getMultiOptionPrices(pools!);
      const oddsStr = opts!
        .slice(0, 3)
        .map((o: string, i: number) => `${o}: ${Math.round(prices[i] * 100)}%`)
        .join(" · ");
      desc = `${oddsStr} — ${market.description?.slice(0, 80) || market.title}`;
    } else {
      const price = getPrice(market.yesPool, market.noPool);
      desc = `YES ${Math.round(price.yes * 100)}% · NO ${Math.round(price.no * 100)}% — ${market.description?.slice(0, 100) || market.title}`;
    }

    // Use the dedicated /api/og route — avoids redirect issues with WhatsApp
    const baseUrl = "https://guap.gold";
    const ogImageUrl = `${baseUrl}/api/og/markets/${id}`;

    return {
      title: `${market.title} — GUAP`,
      description: desc,
      openGraph: {
        title: market.title,
        description: desc,
        siteName: "GUAP",
        type: "article",
        images: [{ url: ogImageUrl, width: 1200, height: 630, alt: market.title }],
      },
      twitter: {
        card: "summary_large_image",
        title: market.title,
        description: desc,
        images: [ogImageUrl],
      },
    };
  } catch {
    return { title: "GUAP — Predict the Future" };
  }
}

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
