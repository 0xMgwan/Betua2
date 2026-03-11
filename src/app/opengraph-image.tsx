import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "GUAP — Predict the Future. Earn GUAP.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
          border: "4px solid #00e5a0",
        }}
      >
        <div
          style={{
            fontSize: 140,
            fontFamily: "monospace",
            fontWeight: 900,
            color: "#00e5a0",
            letterSpacing: "-0.02em",
          }}
        >
          GUAP
        </div>
        <div
          style={{
            fontSize: 30,
            fontFamily: "monospace",
            color: "#ffffff",
            opacity: 0.85,
            marginTop: 8,
          }}
        >
          Predict the Future. Earn GUAP.
        </div>
        <div
          style={{
            fontSize: 20,
            fontFamily: "monospace",
            color: "#00e5a0",
            opacity: 0.6,
            marginTop: 16,
          }}
        >
          Trade YES or NO on African events. Powered by nTZS.
        </div>
      </div>
    ),
    { ...size }
  );
}
