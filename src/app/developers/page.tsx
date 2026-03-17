"use client";

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import {
  Code,
  Key,
  Users,
  Wallet,
  ChartLine,
  ArrowsLeftRight,
  CheckCircle,
  Copy,
  CaretDown,
  CaretRight,
  Lightning,
  ShieldCheck,
  Gauge,
  Globe,
  Terminal,
} from "@phosphor-icons/react";

interface EndpointProps {
  method: "GET" | "POST";
  path: string;
  description: string;
  auth?: boolean;
  body?: Record<string, string>;
  query?: Record<string, string>;
  response?: Record<string, string>;
  example?: { request: string; response: string };
}

function Endpoint({ method, path, description, auth = true, body, query, response, example }: EndpointProps) {
  const [expanded, setExpanded] = useState(false);
  const methodColors = {
    GET: "bg-green-500/20 text-green-400 border-green-500/30",
    POST: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };

  return (
    <div className="border border-[var(--card-border)] bg-[var(--card)]/50 mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--card-border)]/20 transition-colors"
      >
        <span className={`px-2 py-0.5 text-[10px] font-mono font-bold border ${methodColors[method]}`}>
          {method}
        </span>
        <code className="text-sm font-mono text-[var(--accent)]">{path}</code>
        <span className="text-xs text-[var(--muted)] flex-1 text-left ml-2">{description}</span>
        {auth && <ShieldCheck size={14} className="text-yellow-500" />}
        {expanded ? <CaretDown size={14} /> : <CaretRight size={14} />}
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="px-4 pb-4 border-t border-[var(--card-border)]"
        >
          {query && Object.keys(query).length > 0 && (
            <div className="mt-3">
              <h4 className="text-[10px] font-mono text-[var(--muted)] uppercase mb-2">Query Parameters</h4>
              <div className="bg-[var(--background)] p-3 font-mono text-xs space-y-1">
                {Object.entries(query).map(([key, desc]) => (
                  <div key={key}>
                    <span className="text-purple-400">{key}</span>
                    <span className="text-[var(--muted)]"> — {desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {body && Object.keys(body).length > 0 && (
            <div className="mt-3">
              <h4 className="text-[10px] font-mono text-[var(--muted)] uppercase mb-2">Request Body</h4>
              <div className="bg-[var(--background)] p-3 font-mono text-xs space-y-1">
                {Object.entries(body).map(([key, desc]) => (
                  <div key={key}>
                    <span className="text-orange-400">{key}</span>
                    <span className="text-[var(--muted)]"> — {desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {response && Object.keys(response).length > 0 && (
            <div className="mt-3">
              <h4 className="text-[10px] font-mono text-[var(--muted)] uppercase mb-2">Response</h4>
              <div className="bg-[var(--background)] p-3 font-mono text-xs space-y-1">
                {Object.entries(response).map(([key, desc]) => (
                  <div key={key}>
                    <span className="text-[var(--accent)]">{key}</span>
                    <span className="text-[var(--muted)]"> — {desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {example && (
            <div className="mt-3">
              <h4 className="text-[10px] font-mono text-[var(--muted)] uppercase mb-2">Example</h4>
              <pre className="bg-[#0a0a0a] p-3 font-mono text-[10px] text-[var(--muted)] overflow-x-auto whitespace-pre-wrap">
                {example.request}
              </pre>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-[#0a0a0a] border border-[var(--card-border)] p-4 font-mono text-xs text-[var(--muted)] overflow-x-auto">
        <code>{code}</code>
      </pre>
      <button
        onClick={copyToClipboard}
        className="absolute top-2 right-2 p-1.5 bg-[var(--card)] border border-[var(--card-border)] opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Navbar />

      {/* Hero */}
      <section className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 border border-[var(--accent)]/30 bg-[var(--accent)]/5 text-[var(--accent)] text-xs font-mono mb-6"
          >
            <Terminal size={14} />
            API v1.0
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-4xl font-bold mb-4"
          >
            GUAP <span className="text-[var(--accent)]">Public API</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[var(--muted)] max-w-2xl mx-auto mb-8"
          >
            Integrate prediction markets into your app. Enable your users to trade on real-world events with our simple REST API.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-4"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-[var(--card)] border border-[var(--card-border)]">
              <Globe size={16} className="text-blue-400" />
              <span className="text-sm font-mono">REST API</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-[var(--card)] border border-[var(--card-border)]">
              <ShieldCheck size={16} className="text-yellow-400" />
              <span className="text-sm font-mono">API Key Auth</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-[var(--card)] border border-[var(--card-border)]">
              <Gauge size={16} className="text-green-400" />
              <span className="text-sm font-mono">Rate Limited</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="px-4 pb-20">
        <div className="max-w-4xl mx-auto">
          {/* Quick Start */}
          <div className="mb-12">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Lightning size={20} className="text-yellow-400" />
              Quick Start
            </h2>

            <div className="space-y-4">
              <div className="p-4 bg-[var(--card)] border border-[var(--card-border)]">
                <h3 className="text-sm font-mono font-bold text-[var(--accent)] mb-2">1. Get API Key</h3>
                <p className="text-xs text-[var(--muted)] mb-3">
                  Contact us to register as a partner and get your API credentials.
                </p>
                <CodeBlock code="Authorization: Bearer gp_live_xxxxxxxxxxxxxxxx" />
              </div>

              <div className="p-4 bg-[var(--card)] border border-[var(--card-border)]">
                <h3 className="text-sm font-mono font-bold text-[var(--accent)] mb-2">2. Create User</h3>
                <p className="text-xs text-[var(--muted)] mb-3">
                  Create or get a user using your own external ID (e.g., phone number).
                </p>
                <CodeBlock
                  code={`curl -X POST https://www.guap.gold/api/v1/users \\
  -H "Authorization: Bearer gp_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"externalId": "255712345678"}'`}
                />
              </div>

              <div className="p-4 bg-[var(--card)] border border-[var(--card-border)]">
                <h3 className="text-sm font-mono font-bold text-[var(--accent)] mb-2">3. Place Trade</h3>
                <p className="text-xs text-[var(--muted)] mb-3">
                  Let your users trade on prediction markets.
                </p>
                <CodeBlock
                  code={`curl -X POST https://www.guap.gold/api/v1/trades \\
  -H "Authorization: Bearer gp_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "externalId": "255712345678",
    "marketId": "clxyz123",
    "side": "YES",
    "amountTzs": 5000
  }'`}
                />
              </div>
            </div>
          </div>

          {/* Authentication */}
          <div className="mb-12">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Key size={20} className="text-yellow-400" />
              Authentication
            </h2>

            <div className="p-4 bg-[var(--card)] border border-[var(--card-border)]">
              <p className="text-sm text-[var(--muted)] mb-4">
                All API requests require a Bearer token in the Authorization header:
              </p>
              <CodeBlock code="Authorization: Bearer gp_live_xxxxxxxxxxxxxxxx" />

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { tier: "FREE", limit: "100/min", color: "text-gray-400" },
                  { tier: "BASIC", limit: "500/min", color: "text-blue-400" },
                  { tier: "PRO", limit: "2,000/min", color: "text-purple-400" },
                  { tier: "ENTERPRISE", limit: "10,000/min", color: "text-yellow-400" },
                ].map((t) => (
                  <div key={t.tier} className="p-3 bg-[var(--background)] border border-[var(--card-border)] text-center">
                    <div className={`text-xs font-mono font-bold ${t.color}`}>{t.tier}</div>
                    <div className="text-[10px] text-[var(--muted)]">{t.limit}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Endpoints */}
          <div className="mb-12">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Code size={20} className="text-[var(--accent)]" />
              API Endpoints
            </h2>

            {/* Users */}
            <h3 className="text-sm font-mono font-bold text-purple-400 mb-3 flex items-center gap-2 mt-6">
              <Users size={16} />
              Users
            </h3>
            <Endpoint
              method="POST"
              path="/api/v1/users"
              description="Create or get user by external ID"
              body={{
                "externalId": "string (required) — Your user ID",
                "email": "string (optional) — User email",
                "username": "string (optional) — Username",
                "displayName": "string (optional) — Display name",
                "phone": "string (optional) — Phone number",
              }}
              response={{
                "userId": "string — GUAP user ID",
                "externalId": "string — Your user ID",
                "username": "string",
                "balanceTzs": "number — Wallet balance",
                "isNew": "boolean — True if newly created",
              }}
              example={{
                request: `curl -X POST /api/v1/users \\
  -H "Authorization: Bearer gp_live_xxx" \\
  -d '{"externalId": "255712345678"}'`,
                response: "",
              }}
            />

            {/* Wallet */}
            <h3 className="text-sm font-mono font-bold text-green-400 mb-3 flex items-center gap-2 mt-6">
              <Wallet size={16} />
              Wallet
            </h3>
            <Endpoint
              method="GET"
              path="/api/v1/wallet/balance"
              description="Get user's wallet balance"
              query={{
                "externalId": "string (required) — Your user ID",
              }}
              response={{
                "externalId": "string",
                "balanceTzs": "number — Balance in TZS",
                "currency": "TZS",
              }}
            />

            {/* Markets */}
            <h3 className="text-sm font-mono font-bold text-blue-400 mb-3 flex items-center gap-2 mt-6">
              <ChartLine size={16} />
              Markets
            </h3>
            <Endpoint
              method="GET"
              path="/api/v1/markets"
              description="List all markets"
              query={{
                "status": "OPEN | RESOLVED | ALL (default: OPEN)",
                "category": "string (optional) — Filter by category",
                "limit": "number (max 100, default 50)",
                "offset": "number — Pagination offset",
              }}
              response={{
                "markets": "array — Market objects with prices",
                "pagination": "object — {total, limit, offset, hasMore}",
              }}
            />
            <Endpoint
              method="GET"
              path="/api/v1/markets/:id"
              description="Get single market details"
              response={{
                "id": "string",
                "title": "string",
                "description": "string",
                "status": "OPEN | RESOLVED",
                "type": "BINARY | MULTI",
                "prices": "object — Current prices/probabilities",
                "totalVolume": "number — Total traded volume",
                "totalShares": "object — Shares by outcome",
              }}
            />

            {/* Trading */}
            <h3 className="text-sm font-mono font-bold text-orange-400 mb-3 flex items-center gap-2 mt-6">
              <ArrowsLeftRight size={16} />
              Trading
            </h3>
            <Endpoint
              method="POST"
              path="/api/v1/trades"
              description="Place a trade"
              body={{
                "externalId": "string (required) — Your user ID",
                "marketId": "string (required) — Market to trade on",
                "side": "YES | NO (required for binary markets)",
                "optionIndex": "number (required for multi-option markets)",
                "amountTzs": "number (required) — Amount in TZS (min 100)",
              }}
              response={{
                "tradeId": "string",
                "marketId": "string",
                "side": "string",
                "amountTzs": "number",
                "shares": "number — Shares received",
                "price": "number — Average price per share",
                "fee": "number — 5% entry fee",
              }}
              example={{
                request: `curl -X POST /api/v1/trades \\
  -H "Authorization: Bearer gp_live_xxx" \\
  -d '{
    "externalId": "255712345678",
    "marketId": "clxyz123",
    "side": "YES",
    "amountTzs": 5000
  }'`,
                response: "",
              }}
            />
            <Endpoint
              method="GET"
              path="/api/v1/trades"
              description="Get user's trade history"
              query={{
                "externalId": "string (required)",
                "limit": "number (optional)",
                "offset": "number (optional)",
              }}
              response={{
                "trades": "array — Trade objects",
                "pagination": "object",
              }}
            />

            {/* Positions */}
            <h3 className="text-sm font-mono font-bold text-pink-400 mb-3 flex items-center gap-2 mt-6">
              <CheckCircle size={16} />
              Positions & Redemption
            </h3>
            <Endpoint
              method="GET"
              path="/api/v1/positions"
              description="Get user's positions/portfolio"
              query={{
                "externalId": "string (required)",
                "status": "OPEN | RESOLVED | ALL",
              }}
              response={{
                "positions": "array — Position objects with potential payouts",
                "count": "number",
              }}
            />
            <Endpoint
              method="POST"
              path="/api/v1/positions/:id/redeem"
              description="Redeem winnings from resolved market"
              body={{
                "externalId": "string (required)",
              }}
              response={{
                "positionId": "string",
                "marketId": "string",
                "winningShares": "number",
                "grossPayout": "number",
                "settlementFee": "number — 5% fee",
                "netPayout": "number — Amount credited",
              }}
            />
          </div>

          {/* Fees */}
          <div className="mb-12">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Wallet size={20} className="text-green-400" />
              Fee Structure
            </h2>

            <div className="p-4 bg-[var(--card)] border border-[var(--card-border)]">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 bg-[var(--background)] border border-[var(--card-border)] text-center">
                  <div className="text-2xl font-bold text-[var(--accent)]">5%</div>
                  <div className="text-xs text-[var(--muted)]">Entry Fee</div>
                  <div className="text-[10px] text-[var(--muted)] mt-1">Deducted at trade time</div>
                </div>
                <div className="p-4 bg-[var(--background)] border border-[var(--card-border)] text-center">
                  <div className="text-2xl font-bold text-[var(--accent)]">5%</div>
                  <div className="text-xs text-[var(--muted)]">Settlement Fee</div>
                  <div className="text-[10px] text-[var(--muted)] mt-1">Deducted at redemption</div>
                </div>
                <div className="p-4 bg-[var(--background)] border border-[var(--card-border)] text-center">
                  <div className="text-2xl font-bold text-orange-400">~9.75%</div>
                  <div className="text-xs text-[var(--muted)]">Total Per Cycle</div>
                  <div className="text-[10px] text-[var(--muted)] mt-1">All fees go to platform.</div>
                </div>
              </div>

              <p className="text-xs text-[var(--muted)] mt-4 text-center">
                Partners keep 100% of their own fees. 
              </p>
            </div>
          </div>

          {/* Errors */}
          <div className="mb-12">
            <h2 className="text-xl font-bold mb-4">Error Codes</h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { code: 400, desc: "Bad Request", color: "text-yellow-400" },
                { code: 401, desc: "Unauthorized", color: "text-red-400" },
                { code: 403, desc: "Forbidden", color: "text-red-400" },
                { code: 404, desc: "Not Found", color: "text-orange-400" },
                { code: 429, desc: "Rate Limited", color: "text-purple-400" },
                { code: 500, desc: "Server Error", color: "text-red-400" },
              ].map((e) => (
                <div key={e.code} className="p-3 bg-[var(--card)] border border-[var(--card-border)]">
                  <span className={`font-mono font-bold ${e.color}`}>{e.code}</span>
                  <span className="text-xs text-[var(--muted)] ml-2">{e.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="p-6 bg-[var(--accent)]/5 border border-[var(--accent)]/30 text-center">
            <h2 className="text-lg font-bold mb-2">Ready to Integrate?</h2>
            <p className="text-sm text-[var(--muted)] mb-4">
              Contact us to register as a partner and get your API credentials.
            </p>
            <a
              href="mailto:machuche@nedapay.xyz"
              className="inline-flex items-center gap-2 px-6 py-2 border-2 border-[var(--accent)] text-[var(--accent)] font-mono text-sm font-bold hover:bg-[var(--accent)] hover:text-[var(--background)] transition-colors"
            >
              <Key size={16} />
              Request API Access
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
