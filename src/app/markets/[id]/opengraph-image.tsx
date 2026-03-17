import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "GUAP Market";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Fetch market data from API instead of using Prisma directly
  let market: { title: string; category: string; yesPrice: number; noPrice: number } | null = null;
  
  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : "https://www.guap.gold";
    const res = await fetch(`${baseUrl}/api/markets/${id}`, { 
      cache: "no-store",
      headers: { "Content-Type": "application/json" }
    });
    if (res.ok) {
      const data = await res.json();
      market = {
        title: data.title || "GUAP Market",
        category: data.category || "PREDICTION",
        yesPrice: Math.round((data.yesPrice || 0.5) * 100),
        noPrice: Math.round((data.noPrice || 0.5) * 100),
      };
    }
  } catch {
    // Fallback to default values
  }

  if (!market) {
    market = {
      title: "GUAP Prediction Market",
      category: "PREDICTION",
      yesPrice: 50,
      noPrice: 50,
    };
  }

  const { title, category, yesPrice, noPrice } = market;

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
              fontWeight: 900,
              marginRight: 16,
            }}
          >
            G
          </div>
          <div
            style={{
              fontSize: 24,
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
              color: "rgba(255,255,255,0.4)",
              textTransform: "uppercase",
            }}
          >
            {category}
          </div>
        </div>

        {/* Market Title */}
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.2,
            marginBottom: 40,
            display: "flex",
          }}
        >
          {title}
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
                color: "rgba(255,255,255,0.4)",
                marginBottom: 8,
              }}
            >
              YES
            </div>
            <div
              style={{
                fontSize: 56,
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
                color: "rgba(255,255,255,0.4)",
                marginBottom: 8,
              }}
            >
              NO
            </div>
            <div
              style={{
                fontSize: 56,
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
            color: "rgba(255,255,255,0.3)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div>PREDICT · TRADE · WIN</div>
          <div>www.guap.gold</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
