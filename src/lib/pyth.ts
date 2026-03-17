/**
 * Pyth Network price feed integration via Hermes REST API
 * Docs: https://docs.pyth.network/price-feeds/api-reference/hermes
 */

const HERMES_BASE_URL = "https://hermes.pyth.network";

export interface PythPriceFeed {
  id: string;
  attributes: {
    asset_type: string;
    base: string;
    description: string;
    display_symbol: string;
    generic_symbol: string;
    quote_currency: string;
    symbol: string;
    country?: string;
    cms_symbol?: string;
    cqs_symbol?: string;
  };
}

export interface PythPrice {
  id: string;
  price: {
    price: string;      // price as integer string
    conf: string;       // confidence interval
    expo: number;       // exponent (price = price * 10^expo)
    publish_time: number;
  };
  ema_price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
}

export interface PythPriceResult {
  feedId: string;
  symbol: string;
  price: number;          // human-readable price
  confidence: number;
  publishTime: Date;
  rawPrice: string;
  expo: number;
}

/** Parse raw Pyth price to human-readable float */
function parseRawPrice(rawPrice: string, expo: number): number {
  return parseFloat(rawPrice) * Math.pow(10, expo);
}

/**
 * Search for price feed IDs by symbol (e.g. "BTC", "ETH", "SOL")
 * Returns the first matching feed ID
 */
export async function getPriceFeedId(symbol: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${HERMES_BASE_URL}/v2/price_feeds?query=${encodeURIComponent(symbol)}&asset_type=crypto`,
      { next: { revalidate: 3600 } } // cache for 1 hour
    );
    if (!res.ok) return null;
    const feeds: PythPriceFeed[] = await res.json();

    // Find exact match first
    const exact = feeds.find(
      (f) =>
        f.attributes.base?.toUpperCase() === symbol.toUpperCase() &&
        f.attributes.quote_currency === "USD"
    );
    if (exact) return `0x${exact.id}`;

    // Fall back to first result
    return feeds.length > 0 ? `0x${feeds[0].id}` : null;
  } catch (err) {
    console.error("Pyth: failed to get price feed ID for", symbol, err);
    return null;
  }
}

/**
 * Fetch the latest price for a given Pyth price feed ID
 */
export async function getLatestPrice(feedId: string): Promise<PythPriceResult | null> {
  try {
    // Remove 0x prefix if present for the Hermes API
    const cleanId = feedId.startsWith("0x") ? feedId.slice(2) : feedId;

    const res = await fetch(
      `${HERMES_BASE_URL}/v2/updates/price/latest?ids[]=${cleanId}&parsed=true`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const parsed: PythPrice[] = data.parsed || [];
    if (parsed.length === 0) return null;

    const entry = parsed[0];
    const price = parseRawPrice(entry.price.price, entry.price.expo);
    const confidence = parseRawPrice(entry.price.conf, entry.price.expo);

    return {
      feedId,
      symbol: feedId,
      price,
      confidence,
      publishTime: new Date(entry.price.publish_time * 1000),
      rawPrice: entry.price.price,
      expo: entry.price.expo,
    };
  } catch (err) {
    console.error("Pyth: failed to fetch latest price for", feedId, err);
    return null;
  }
}

/**
 * Fetch prices for multiple feed IDs at once
 */
export async function getMultiplePrices(feedIds: string[]): Promise<PythPriceResult[]> {
  try {
    const cleanIds = feedIds.map((id) => (id.startsWith("0x") ? id.slice(2) : id));
    const params = cleanIds.map((id) => `ids[]=${id}`).join("&");

    const res = await fetch(
      `${HERMES_BASE_URL}/v2/updates/price/latest?${params}&parsed=true`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];

    const data = await res.json();
    const parsed: PythPrice[] = data.parsed || [];

    return parsed.map((entry) => ({
      feedId: `0x${entry.id}`,
      symbol: `0x${entry.id}`,
      price: parseRawPrice(entry.price.price, entry.price.expo),
      confidence: parseRawPrice(entry.price.conf, entry.price.expo),
      publishTime: new Date(entry.price.publish_time * 1000),
      rawPrice: entry.price.price,
      expo: entry.price.expo,
    }));
  } catch (err) {
    console.error("Pyth: failed to fetch multiple prices", err);
    return [];
  }
}

/**
 * Evaluate if a crypto market's resolution criteria is met
 * @param currentPrice - current price from Pyth
 * @param targetPrice  - threshold/target price
 * @param operator     - "above", "below", "equal"
 */
export function evaluateResolution(
  currentPrice: number,
  targetPrice: number,
  operator: "above" | "below" | "equal"
): boolean {
  switch (operator) {
    case "above":
      return currentPrice >= targetPrice;
    case "below":
      return currentPrice <= targetPrice;
    case "equal":
      return Math.abs(currentPrice - targetPrice) / targetPrice < 0.01; // within 1%
  }
}

/**
 * Well-known Pyth price feed IDs for crypto, FX, and commodities
 * Source: https://pyth.network/developers/price-feed-ids
 */
export const PYTH_FEED_IDS: Record<string, string> = {
  // Crypto
  BTC:  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH:  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL:  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  BNB:  "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f",
  MATIC:"0x5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52",
  AVAX: "0x93da3352f9f1d105fdfe4971cfa80e9269ef23a9a5d3abd37f36571a3e56f538",
  ADA:  "0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d",
  DOT:  "0xca3eed9b267293f6595901c734c7525ce8ef49adafe8284606ceb307afa2ca5b",
  LINK: "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
  UNI:  "0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501",
  // FX Pairs
  "EUR/USD": "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b",
  "GBP/USD": "0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1",
  "USD/JPY": "0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52",
  "AUD/USD": "0x67a6f93030420c1c9e3fe37c1ab6b77966af82f995944a9fefce357a22854a80",
  "USD/CHF": "0x0b1e3297e69f162877b577b0d6a47a0d63b2392bc8499e6540da4187a63e28f8",
  "USD/CAD": "0x3112b03a41c910ed446852aacf67118cb1bec67b2cd0b9a214c58cc0eaa2ecca",
  "NZD/USD": "0x92eea8ba1b00078cdc2ef6f64f091f262e8c7d0576ee4677571c4a8e8e0d5d11",
  // Metals / Commodities
  "XAU/USD": "0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2",
  "XAG/USD": "0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e",
  "XPT/USD": "0x398e4bbc7cbf89d6648c21e08019d878967677753b3096799595c78f805a34e5",
  "XCU/USD": "0x636bedafa14a37912993f265eda22431a2be363ad41a10276424bbe1b7f508c4",
};

/** Crypto symbols for the market creation UI */
export const CRYPTO_SYMBOLS = [
  { symbol: "BTC",   label: "Bitcoin (BTC)",   emoji: "₿" },
  { symbol: "ETH",   label: "Ethereum (ETH)",  emoji: "Ξ" },
  { symbol: "SOL",   label: "Solana (SOL)",    emoji: "◎" },
  { symbol: "BNB",   label: "BNB",             emoji: "🔶" },
  { symbol: "AVAX",  label: "Avalanche (AVAX)", emoji: "🔺" },
  { symbol: "MATIC", label: "Polygon (MATIC)", emoji: "🟣" },
  { symbol: "ADA",   label: "Cardano (ADA)",   emoji: "🔵" },
  { symbol: "LINK",  label: "Chainlink (LINK)", emoji: "⛓️" },
];

/** FX pairs for the market creation UI */
export const FX_SYMBOLS = [
  { symbol: "EUR/USD", label: "EUR/USD", emoji: "💶" },
  { symbol: "GBP/USD", label: "GBP/USD", emoji: "💷" },
  { symbol: "USD/JPY", label: "USD/JPY", emoji: "💴" },
  { symbol: "AUD/USD", label: "AUD/USD", emoji: "🇦🇺" },
  { symbol: "USD/CHF", label: "USD/CHF", emoji: "🇨🇭" },
  { symbol: "USD/CAD", label: "USD/CAD", emoji: "🇨🇦" },
  { symbol: "NZD/USD", label: "NZD/USD", emoji: "🇳🇿" },
];

/** Commodities for the market creation UI */
export const COMMODITY_SYMBOLS = [
  { symbol: "XAU/USD", label: "Gold (XAU)", emoji: "🥇" },
  { symbol: "XAG/USD", label: "Silver (XAG)", emoji: "🥈" },
  { symbol: "XPT/USD", label: "Platinum (XPT)", emoji: "⚪" },
  { symbol: "XCU/USD", label: "Copper (XCU)", emoji: "🟤" },
];

/** All Pyth symbols combined for the market creation UI */
export const ALL_PYTH_SYMBOLS = [
  ...FX_SYMBOLS,
  ...COMMODITY_SYMBOLS,
  ...CRYPTO_SYMBOLS,
];
