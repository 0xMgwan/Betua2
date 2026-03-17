import { NextRequest, NextResponse } from "next/server";
import { parseWebhookMessage } from "@/lib/whatsapp";
import { handleCommand } from "@/lib/whatsapp-commands";

// Webhook verification (GET request from Meta)
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[WhatsApp] Webhook verified");
    return new NextResponse(challenge, { status: 200 });
  }

  console.error("[WhatsApp] Webhook verification failed");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// Handle incoming messages (POST request from Meta)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Log incoming webhook for debugging
    console.log("[WhatsApp] Incoming webhook:", JSON.stringify(body, null, 2));

    // Parse the message
    const message = parseWebhookMessage(body);
    
    if (!message) {
      // Not a text message or couldn't parse - acknowledge anyway
      return NextResponse.json({ status: "ok" });
    }

    console.log(`[WhatsApp] Message from ${message.from}: ${message.text}`);

    // Handle the command asynchronously (don't block the response)
    handleCommand(message.from, message.text).catch((error) => {
      console.error("[WhatsApp] Command handler error:", error);
    });

    // Always return 200 quickly to acknowledge receipt
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[WhatsApp] Webhook error:", error);
    // Still return 200 to prevent Meta from retrying
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}
