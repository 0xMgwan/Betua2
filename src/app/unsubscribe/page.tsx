"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function Content() {
  const params = useSearchParams();
  const [status, setStatus] = useState<"loading"|"success"|"error">("loading");

  useEffect(() => {
    const token = params.get("token");
    if (!token) { setStatus("error"); return; }
    fetch("/api/email/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(r => setStatus(r.ok ? "success" : "error")).catch(() => setStatus("error"));
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white font-mono">
      {status === "loading" && <p>Processing...</p>}
      {status === "success" && <p className="text-[#00e5a0]">✓ Unsubscribed successfully</p>}
      {status === "error" && <p className="text-red-500">Failed to unsubscribe</p>}
    </div>
  );
}

export default function Page() {
  return <Suspense><Content /></Suspense>;
}
