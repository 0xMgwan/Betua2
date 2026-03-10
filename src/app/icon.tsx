import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000000",
          border: "2px solid #00e5a0",
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontFamily: "monospace",
            fontWeight: 900,
            color: "#00e5a0",
          }}
        >
          G
        </div>
      </div>
    ),
    { ...size }
  );
}
