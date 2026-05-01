import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const W = 1200;
const H = 630;

function multiPrices(pools: number[]): number[] {
  const inv = pools.reduce((s, p) => s + 1 / Math.max(p, 1), 0);
  return pools.map(p => (1 / Math.max(p, 1)) / inv);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let title = "GUAP Prediction Market";
  let imageUrl: string | null = null;
  let category = "PREDICTION";
  let totalVolume = 0;
  let resolveDate = "";
  let yesProb = 50;
  let noProb = 50;
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
      },
    });

    if (market) {
      title = market.title;
      imageUrl = market.imageUrl ?? null;
      category = (market.category || "PREDICTION").toUpperCase();
      totalVolume = market.totalVolume || 0;
      resolveDate = market.resolvesAt
        ? new Date(market.resolvesAt).toLocaleDateString("en-GB", {
            day: "numeric", month: "short", year: "numeric",
          })
        : "";

      const opts = market.options as string[] | null;
      const pools = market.optionPools as number[] | null;
      if (Array.isArray(opts) && opts.length >= 2 && Array.isArray(pools)) {
        isMulti = true;
        options = opts.slice(0, 4);
        const prices = multiPrices(pools);
        optionProbs = options.map((_, i) => Math.round(prices[i] * 100));
      } else {
        const total = (market.yesPool || 0) + (market.noPool || 0);
        yesProb = total > 0 ? Math.round((market.noPool / total) * 100) : 50;
        noProb = 100 - yesProb;
      }
    }
  } catch (e) {
    console.error("[OG]", e);
  }

  const vol =
    totalVolume >= 1_000_000
      ? `${(totalVolume / 1_000_000).toFixed(1)}M TZS vol`
      : totalVolume >= 1000
      ? `${Math.round(totalVolume / 1000)}K TZS vol`
      : totalVolume > 0
      ? `${totalVolume} TZS vol`
      : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          backgroundColor: "#0a0a0a",
          position: "relative",
          overflow: "hidden",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Blurred bg image */}
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            width={W}
            height={H}
            style={{
              position: "absolute",
              inset: 0,
              objectFit: "cover",
              opacity: 0.15,
            }}
          />
        )}

        {/* Dark overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg,rgba(10,10,10,0.97) 0%,rgba(10,10,10,0.82) 100%)",
            display: "flex",
          }}
        />

        {/* Top accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background:
              "linear-gradient(90deg,transparent,#00e5a0 40%,#00e5a0 60%,transparent)",
            display: "flex",
          }}
        />

        {/* Main content */}
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
          {/* Header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 28,
            }}
          >
            {/* Logo box */}
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
            <div
              style={{
                fontSize: 20,
                color: "rgba(255,255,255,0.7)",
                letterSpacing: "0.3em",
                display: "flex",
                marginRight: 14,
              }}
            >
              GUAP
            </div>
            {/* Category pill */}
            <div
              style={{
                fontSize: 11,
                color: "#00e5a0",
                border: "1px solid rgba(0,229,160,0.4)",
                padding: "3px 10px",
                letterSpacing: "0.15em",
                display: "flex",
              }}
            >
              {category}
            </div>
            {/* Right metadata */}
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                gap: 20,
                fontSize: 15,
                color: "rgba(255,255,255,0.35)",
              }}
            >
              {vol ? <span>{vol}</span> : null}
              {resolveDate ? <span>Ends {resolveDate}</span> : null}
            </div>
          </div>

          {/* Market title */}
          <div
            style={{
              fontSize: title.length > 65 ? 34 : title.length > 45 ? 40 : 48,
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.25,
              maxWidth: imageUrl ? "66%" : "100%",
              display: "flex",
              marginBottom: "auto",
            }}
          >
            {title}
          </div>

          {/* Right thumbnail */}
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              width={340}
              height={230}
              style={{
                position: "absolute",
                right: 60,
                top: 100,
                objectFit: "cover",
                border: "2px solid rgba(0,229,160,0.2)",
                borderRadius: 10,
              }}
            />
          )}

          {/* Odds panels */}
          {isMulti ? (
            <div style={{ display: "flex", gap: 14, marginTop: 28 }}>
              {options.map((opt, i) => {
                const prob = optionProbs[i] ?? 0;
                const leading = prob === Math.max(...optionProbs);
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      backgroundColor: leading
                        ? "rgba(0,229,160,0.12)"
                        : "rgba(255,255,255,0.04)",
                      border: `2px solid ${
                        leading
                          ? "rgba(0,229,160,0.5)"
                          : "rgba(255,255,255,0.1)"
                      }`,
                      padding: "16px 18px",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.4)",
                        marginBottom: 8,
                        display: "flex",
                      }}
                    >
                      {String.fromCharCode(65 + i)}
                    </div>
                    <div
                      style={{
                        fontSize: 36,
                        fontWeight: 900,
                        color: leading ? "#00e5a0" : "#ffffff",
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
                        display: "flex",
                      }}
                    >
                      {opt.length > 13 ? opt.slice(0, 13) + "…" : opt}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 20, marginTop: 28 }}>
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
                <div
                  style={{
                    fontSize: 16,
                    color: "rgba(255,255,255,0.4)",
                    marginBottom: 6,
                    display: "flex",
                  }}
                >
                  YES
                </div>
                <div
                  style={{
                    fontSize: 60,
                    fontWeight: 900,
                    color: "#00e5a0",
                    display: "flex",
                  }}
                >
                  {yesProb}%
                </div>
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
                <div
                  style={{
                    fontSize: 16,
                    color: "rgba(255,255,255,0.4)",
                    marginBottom: 6,
                    display: "flex",
                  }}
                >
                  NO
                </div>
                <div
                  style={{
                    fontSize: 60,
                    fontWeight: 900,
                    color: "#ef4444",
                    display: "flex",
                  }}
                >
                  {noProb}%
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              marginTop: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.2)",
                display: "flex",
              }}
            >
              PREDICT · TRADE · WIN
            </div>
            <div
              style={{
                fontSize: 14,
                color: "rgba(0,229,160,0.5)",
                display: "flex",
              }}
            >
              www.guap.gold
            </div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}
