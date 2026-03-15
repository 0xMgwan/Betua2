import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { translateText } from "@/lib/translate";

export async function POST(req: Request) {
  try {
    const { marketId, language } = await req.json();

    if (!marketId || !language) {
      return NextResponse.json(
        { error: "Missing marketId or language" },
        { status: 400 }
      );
    }

    // Check if translation already exists in database
    const existingTranslation = await prisma.marketTranslation.findUnique({
      where: {
        marketId_language: {
          marketId,
          language,
        },
      },
    });

    if (existingTranslation) {
      return NextResponse.json({
        title: existingTranslation.translatedTitle,
        description: existingTranslation.translatedDesc,
        options: existingTranslation.translatedOptions,
      });
    }

    // Fetch the market
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: {
        id: true,
        title: true,
        description: true,
        options: true,
      },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    // Translate the content
    const translatedTitle = await translateText(market.title, "en", language);
    const translatedDesc = market.description
      ? await translateText(market.description, "en", language)
      : null;

    let translatedOptions = null;
    if (market.options && Array.isArray(market.options)) {
      const optionsArray = market.options as string[];
      const translated = await Promise.all(
        optionsArray.map((opt) => translateText(opt, "en", language))
      );
      translatedOptions = translated;
    }

    // Save translation to database
    await prisma.marketTranslation.create({
      data: {
        marketId,
        language,
        translatedTitle,
        translatedDesc,
        translatedOptions: translatedOptions as any,
      },
    });

    return NextResponse.json({
      title: translatedTitle,
      description: translatedDesc,
      options: translatedOptions,
    });
  } catch (error) {
    console.error("Translation API error:", error);
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    );
  }
}
