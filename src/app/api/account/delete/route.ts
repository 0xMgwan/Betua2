import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// Delete (anonymize) the signed-in user's account: strips all personal data and
// disables login, while preserving financial records for legal/audit purposes.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uid = session.userId;
  const tag = uid.slice(-8);

  try {
    await prisma.user.update({
      where: { id: uid },
      data: {
        email: `deleted+${uid}@deleted.guap.gold`,
        username: `deleted_${tag}`,
        displayName: "Deleted user",
        phone: null,
        bio: null,
        avatarUrl: null,
        walletAddress: null,
        // Make login impossible (not a valid bcrypt hash).
        passwordHash: `deleted_${crypto.randomBytes(24).toString("hex")}`,
        passwordResetToken: null,
        passwordResetExpiry: null,
        referralCode: null,
        referredById: null,
      },
    });
  } catch (err) {
    console.error("Account deletion failed:", err);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("betua_token", "", { maxAge: 0, path: "/" });
  return res;
}
