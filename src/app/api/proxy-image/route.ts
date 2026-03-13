import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Support both ?url=<encoded> and html2canvas proxy format ?url=<raw>
  let url = req.nextUrl.searchParams.get("url");
  if (!url) {
    // html2canvas appends the URL after the proxy path
    const full = req.nextUrl.search;
    const match = full.match(/url=(.+)/);
    if (match) url = decodeURIComponent(match[1]);
  }
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  // Resolve relative URLs against request origin
  if (url.startsWith("/")) {
    url = `${req.nextUrl.origin}${url}`;
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "GUAP-ImageProxy/1.0" },
    });
    if (!res.ok) return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: 502 });

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/png";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Proxy image error:", err);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}
