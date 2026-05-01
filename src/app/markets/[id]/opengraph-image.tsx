import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const alt = "GUAP Prediction Market";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function getMultiOptionPrices(pools: number[]): number[] {
  const invSum = pools.reduce((s, p) => s + 1 / Math.max(p, 1), 0);
  return pools.map(p => (1 / Math.max(p, 1)) / invSum);
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let title = "GUAP Prediction Market";
  let imageUrl: string | null = null;
  let category = "PREDICTION";
  let totalVolume = 0;
  let resolveDate = "";

  // Binary probabilities
  let yesProb = 50;
  let noProb = 50;

  // Multi-option
  let options: string[] = [];
  let optionProbs: number[] = [];
  let isMulti = false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const market = await (prisma.market as any).findUnique({
      where: { id },
      select: {
        title: true,
        imageUrl: true,
        category: true,
        totalVolume: true,
        resolvesAt: true,
        yesPool: true,
        noPool: true,
        options: true,
        optionPools: true,
        status: true,
        outcome: true,
        outcomeLabel: true,
      },
    });

    if (market) {
      title = market.title;
      imageUrl = market.imageUrl;
      category = (market.category || "PREDICTION").toUpperCase();
      totalVolume = market.totalVolume || 0;
      resolveDate = market.resolvesAt
        ? new Date(market.resolvesAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "";

      const opts = market.options as string[] | null;
      const pools = market.optionPools as number[] | null;

      if (Array.isArray(opts) && opts.length >= 2 && Array.isArray(pools)) {
        isMulti = true;
        options = opts.slice(0, 4); // max 4 for display
        const prices = getMultiOptionPrices(pools);
        optionProbs = prices.map(p => Math.round(p * 100));
      } else {
        const total = (market.yesPool || 0) + (market.noPool || 0);
        yesProb = total > 0 ? Math.round((market.noPool / total) * 100) : 50;
        noProb = 100 - yesProb;
      }
    }
  } catch (e) {
    console.error("[OG] failed to load market:", e);
  }

  const volDisplay = totalVolume >= 1_000_000
    ? `${(totalVolume / 1_000_000).toFixed(1)}M TZS`
    : totalVolume >= 1000
    ? `${Math.round(totalVolume / 1000)}K TZS`
    : `${totalVolume} TZS`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#0a0a0a",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background market image (blurred, darkened) */}
        {imageUrl && (
          <img
            src={imageUrl}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.18,
              filter: "blur(4px)",
            }}
          />
        )}

        {/* Dark overlay gradient */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, rgba(10,10,10,0.97) 0%, rgba(10,10,10,0.80) 100%)",
            display: "flex",
          }}
        />

        {/* Green accent line top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, transparent, #00e5a0, transparent)",
            display: "flex",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            padding: "44px 60px",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
            <div
              style={{
                width: 44,
                height: 44,
                border: "2px solid rgba(0,229,160,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#00e5a0",
                fontSize: 22,
                fontWeight: 900,
                marginRight: 14,
              }}
            >
              G
            </div>
            <div style={{ fontSize: 20, color: "rgba(255,255,255,0.7)", letterSpacing: "0.3em", display: "flex" }}>
              GUAP
            </div>
            <div
              style={{
                marginLeft: 16,
                fontSize: 12,
                color: "#00e5a0",
                border: "1px solid rgba(0,229,160,0.4)",
                padding: "3px 10px",
                letterSpacing: "0.15em",
                display: "flex",
              }}
            >
              {category}
            </div>
            <div style={{ marginLeft: "auto", fontSize: 16, color: "rgba(255,255,255,0.35)", display: "flex", gap: 24 }}>
              {totalVolume > 0 && <span>Vol: {volDisplay}</span>}
              {resolveDate && <span>Ends {resolveDate}</span>}
            </div>
          </div>

          {/* Market title */}
          <div
            style={{
              fontSize: title.length > 60 ? 36 : title.length > 40 ? 42 : 50,
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.25,
              marginBottom: "auto",
              maxWidth: imageUrl ? "68%" : "100%",
              display: "flex",
            }}
          >
            {title}
          </div>

          {/* Right-side image thumbnail */}
          {imageUrl && (
            <img
              src={imageUrl}
              style={{
                position: "absolute",
                right: 60,
                top: 110,
                width: 320,
                height: 220,
                objectFit: "cover",
                border: "2px solid rgba(0,229,160,0.2)",
                borderRadius: 8,
              }}
            />
          )}

          {/* Odds bar */}
          {isMulti ? (
            <div style={{ display: "flex", gap: 16, marginTop: 32 }}>
              {options.slice(0, 4).map((opt, i) => {
                const prob = optionProbs[i] ?? 0;
                const isLeading = prob === Math.max(...optionProbs.slice(0, 4));
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      backgroundColor: isLeading ? "rgba(0,229,160,0.12)" : "rgba(255,255,255,0.04)",
                      border: `2px solid ${isLeading ? "rgba(0,229,160,0.5)" : "rgba(255,255,255,0.1)"}`,
                      padding: "16px 20px",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 8, display: "flex" }}>
                      {String.fromCharCode(65 + i)}
                    </div>
                    <div
                      style={{
                        fontSize: 34,
                        fontWeight: 900,
                        color: isLeading ? "#00e5a0" : "#ffffff",
                        display: "flex",
                      }}
                    >
                      {prob}%
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "rgba(255,255,255,0.5)",
                        marginTop: 6,
                        overflow: "hidden",
                        display: "flex",
                        maxWidth: "100%",
                      }}
                    >
                      {opt.length > 14 ? opt.slice(0, 14) + "…" : opt}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 20, marginTop: 32 }}>
              <div
                style={{
                  flex: yesProb,
                  backgroundColor: "rgba(0,229,160,0.1)",
                  border: "2px solid rgba(0,229,160,0.4)",
                  padding: "20px 28px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", marginBottom: 6, display: "flex" }}>YES</div>
                <div style={{ fontSize: 60, fontWeight: 900, color: "#00e5a0", display: "flex" }}>{yesProb}%</div>
              </div>
              <div
                style={{
                  flex: noProb,
                  backgroundColor: "rgba(239,68,68,0.08)",
                  border: "2px solid rgba(239,68,68,0.3)",
                  padding: "20px 28px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", marginBottom: 6, display: "flex" }}>NO</div>
                <div style={{ fontSize: 60, fontWeight: 900, color: "#ef4444", display: "flex" }}>{noProb}%</div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              marginTop: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", display: "flex" }}>
              PREDICT · TRADE · WIN
            </div>
            <div style={{ fontSize: 14, color: "rgba(0,229,160,0.5)", display: "flex" }}>
              www.guap.gold
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
