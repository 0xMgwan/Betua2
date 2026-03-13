import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { getPrice } from "@/lib/amm";

export const alt = "GUAP Market";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    const market = await prisma.market.findUnique({
      where: { id },
      select: {
        title: true,
        category: true,
        yesPool: true,
        noPool: true,
        totalVolume: true,
        status: true,
      },
    });

    if (!market) {
      return new ImageResponse(
        (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#0a0a0a",
            }}
          >
            <div style={{ fontSize: 60, color: "#ffffff", fontFamily: "monospace" }}>
              Market Not Found
            </div>
          </div>
        ),
        { ...size }
      );
    }

    const price = getPrice(market.yesPool, market.noPool);
    const yesPrice = Math.round(price.yes * 100);
    const noPrice = Math.round(price.no * 100);

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#0a0a0a",
            padding: 60,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 40 }}>
            <div
              style={{
                width: 50,
                height: 50,
                border: "3px solid rgba(255,255,255,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontSize: 24,
                fontFamily: "monospace",
                fontWeight: 900,
                marginRight: 16,
              }}
            >
              G
            </div>
            <div
              style={{
                fontSize: 24,
                fontFamily: "monospace",
                color: "rgba(255,255,255,0.6)",
                letterSpacing: "0.3em",
              }}
            >
              GUAP
            </div>
            <div
              style={{
                marginLeft: "auto",
                fontSize: 18,
                fontFamily: "monospace",
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
              }}
            >
              {market.category}
            </div>
          </div>

          {/* Market Title */}
          <div
            style={{
              fontSize: 48,
              fontFamily: "monospace",
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.2,
              marginBottom: 40,
              display: "flex",
            }}
          >
            {market.title}
          </div>

          {/* Prices */}
          <div style={{ display: "flex", gap: 24, marginTop: "auto" }}>
            <div
              style={{
                flex: 1,
                backgroundColor: "rgba(0, 229, 160, 0.1)",
                border: "2px solid rgba(0, 229, 160, 0.3)",
                padding: 32,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  fontFamily: "monospace",
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 8,
                }}
              >
                YES
              </div>
              <div
                style={{
                  fontSize: 56,
                  fontFamily: "monospace",
                  fontWeight: 900,
                  color: "#00e5a0",
                }}
              >
                {yesPrice}%
              </div>
            </div>
            <div
              style={{
                flex: 1,
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "2px solid rgba(239, 68, 68, 0.3)",
                padding: 32,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  fontFamily: "monospace",
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 8,
                }}
              >
                NO
              </div>
              <div
                style={{
                  fontSize: 56,
                  fontFamily: "monospace",
                  fontWeight: 900,
                  color: "#ef4444",
                }}
              >
                {noPrice}%
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              marginTop: 32,
              fontSize: 16,
              fontFamily: "monospace",
              color: "rgba(255,255,255,0.3)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <div>PREDICT · TRADE · WIN</div>
            <div>guap.betua.app</div>
          </div>
        </div>
      ),
      { ...size }
    );
  } catch (error) {
    console.error("OG Image generation error:", error);
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0a0a0a",
          }}
        >
          <div style={{ fontSize: 60, color: "#ffffff", fontFamily: "monospace" }}>
            GUAP
          </div>
        </div>
      ),
      { ...size }
    );
  }
}
