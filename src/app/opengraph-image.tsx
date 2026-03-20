import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "GUAP — Predict the Future. Earn GUAP.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logoUrl = "https://guap.gold/guap.svg";
  
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
        }}
      >
        {/* Actual GUAP Logo */}
        <img
          src={logoUrl}
          width={220}
          height={220}
          style={{ marginBottom: 24 }}
        />
        <div
          style={{
            fontSize: 64,
            fontFamily: "monospace",
            fontWeight: 900,
            color: "#D4AF37",
            letterSpacing: "0.1em",
          }}
        >
          GUAP
        </div>
        <div
          style={{
            fontSize: 26,
            fontFamily: "monospace",
            color: "#ffffff",
            opacity: 0.85,
            marginTop: 16,
          }}
        >
          Predict the Future. Earn GUAP.
        </div>
        <div
          style={{
            fontSize: 18,
            fontFamily: "monospace",
            color: "#D4AF37",
            opacity: 0.7,
            marginTop: 12,
          }}
        >
          Trade YES or NO on African events. Powered by nTZS.
        </div>
      </div>
    ),
    { ...size }
  );
}
