/**
 * Partner User Management API
 * POST /api/v1/users - Create or get user by external ID
 * 
 * Partners use this to create/link users in their namespace
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ntzs } from "@/lib/ntzs";
import { validateApiKey, checkRateLimit, logApiRequest, apiError, apiSuccess } from "@/lib/api-auth";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  // Validate API key
  const partner = await validateApiKey(req);
  if (!partner) {
    return apiError("Invalid or missing API key", 401);
  }

  // Check rate limit
  const withinLimit = await checkRateLimit(partner.partnerId, partner.rateLimit);
  if (!withinLimit) {
    await logApiRequest(partner.partnerId, "/api/v1/users", "POST", 429, Date.now() - startTime, req);
    return apiError("Rate limit exceeded", 429);
  }

  try {
    const body = await req.json();
    const { externalId, email, username, displayName, phone, metadata } = body;

    if (!externalId) {
      await logApiRequest(partner.partnerId, "/api/v1/users", "POST", 400, Date.now() - startTime, req);
      return apiError("externalId is required");
    }

    // Check if user already exists for this partner
    const existingMapping = await prisma.partnerUser.findUnique({
      where: {
        partnerId_externalId: {
          partnerId: partner.partnerId,
          externalId,
        },
      },
      include: {
        partner: { select: { name: true } },
      },
    });

    if (existingMapping) {
      // Return existing user
      const user = await prisma.user.findUnique({
        where: { id: existingMapping.userId },
        select: {
          id: true,
          username: true,
          displayName: true,
          balanceTzs: true,
          ntzsUserId: true,
          createdAt: true,
        },
      });

      // Get nTZS balance if available
      let ntzsBalance = user?.balanceTzs || 0;
      if (user?.ntzsUserId) {
        try {
          const ntzsUser = await ntzs.users.get(user.ntzsUserId);
          ntzsBalance = ntzsUser.balanceTzs;
        } catch {
          // Fall back to local balance
        }
      }

      await logApiRequest(partner.partnerId, "/api/v1/users", "POST", 200, Date.now() - startTime, req);
      return apiSuccess({
        userId: user?.id,
        externalId,
        username: user?.username,
        displayName: user?.displayName,
        balanceTzs: ntzsBalance,
        isNew: false,
        createdAt: user?.createdAt,
      });
    }

    // Create new user
    // Generate unique username from partner name + external ID
    const baseUsername = `${partner.partnerName.toLowerCase().replace(/\s+/g, "")}_${externalId}`;
    const finalUsername = username || baseUsername;
    const finalEmail = email || `${externalId}@${partner.partnerName.toLowerCase().replace(/\s+/g, "")}.partner`;

    // Generate random password (user won't need it - they auth via partner)
    const randomPassword = crypto.randomBytes(32).toString("hex");
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    // Create user in our system
    const newUser = await prisma.user.create({
      data: {
        email: finalEmail,
        username: finalUsername,
        displayName: displayName || finalUsername,
        phone: phone || null,
        passwordHash,
      },
    });

    // Create nTZS wallet for user
    let ntzsUserId: string | null = null;
    try {
      const ntzsUser = await ntzs.users.create({
        externalId: newUser.id,
        email: finalEmail,
      });
      ntzsUserId = ntzsUser.id;

      // Update user with nTZS ID
      await prisma.user.update({
        where: { id: newUser.id },
        data: { ntzsUserId },
      });
    } catch (err) {
      console.error("Failed to create nTZS wallet:", err);
    }

    // Create partner-user mapping
    await prisma.partnerUser.create({
      data: {
        partnerId: partner.partnerId,
        externalId,
        userId: newUser.id,
        metadata: metadata || null,
      },
    });

    await logApiRequest(partner.partnerId, "/api/v1/users", "POST", 201, Date.now() - startTime, req);
    return apiSuccess({
      userId: newUser.id,
      externalId,
      username: newUser.username,
      displayName: newUser.displayName,
      balanceTzs: 0,
      isNew: true,
      createdAt: newUser.createdAt,
    }, 201);

  } catch (err: any) {
    console.error("User creation error:", err);
    await logApiRequest(partner.partnerId, "/api/v1/users", "POST", 500, Date.now() - startTime, req);
    
    // Handle unique constraint violations
    if (err.code === "P2002") {
      return apiError("Username or email already exists", 409);
    }
    
    return apiError("Failed to create user", 500);
  }
}
