import express from "express";
import OpenAI from "openai";

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 20000,
});

// 🔥 МОНЕТИ
const DEFAULT_SYMBOLS = ["BTC", "ETH", "SOL", "AVAX", "LTC"];

const COINS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  AVAX: "avalanche-2",
  LTC: "litecoin",
};

// 🔥 Назви для голосу
const nameMap = {
  BTC: "Біткоїн",
  ETH: "Ефір",
  SOL: "Солана",
  AVAX: "Avalanche",
  LTC: "Litecoin"
};

// кеш
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

// =====================
// 🔹 FETCH PRICES (FIXED)
// =====================
async function fetchPrices(symbols) {
  const ids = symbols
    .map((s) => COINS[s])
    .filter(Boolean)
    .join(",");

  const cacheKey = `coingecko:${ids}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }

  const url =
    `https://api.coingecko.com/api/v3/simple/price` +
    `?ids=${ids}` +
    `&vs_currencies=usd` +
    `&include_24hr_change=true`;

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 429) {
      if (cached) return cached.data;
      throw new Error("COINGECKO_RATE_LIMIT");
    }

    const text = await response.text();
    throw new Error(`CoinGecko ${response.status}: ${text}`);
  }

  const data = await response.json();

  cache.set(cacheKey, {
    data,
    time: Date.now(),
  });

  return data;
}

// =====================
// 🔹 PRICE
// =====================
router.get("/price", async (req, res) => {
  try {
    const symbol = String(req.query.symbol || "").toUpperCase();

    if (!COINS[symbol]) {
      return res.status(400).json({ error: "Unsupported symbol" });
    }

    const cached = cache.get(`price:${symbol}`);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return res.json({ ...cached.data, cached: true });
    }

    const data = await fetchPrices([symbol]);
    const coin = data[COINS[symbol]];

    const change = Number(coin?.usd_24h_change?.toFixed(2) || 0);

    const result = {
      symbol,
      priceUsd: coin.usd,
      change24h: change,
      text: `${nameMap[symbol] || symbol} зараз ${coin.usd}$, ${
        change >= 0 ? "плюс" : "мінус"
      } ${Math.abs(change)}%. Це не інвестпорада.`,
      cached: false,
    };

    cache.set(`price:${symbol}`, { data: result, time: Date.now() });

    res.json(result);
  } catch (e) {
    const text =
      e.message === "COINGECKO_RATE_LIMIT"
        ? "Крипто API тимчасово обмежив запити. Спробуй пізніше."
        : "Не вдалося отримати курс.";

    res.status(200).json({ text, error: "price error" });
  }
});

// =====================
// 🔹 SUMMARY
// =====================
router.get("/summary", async (req, res) => {
  try {
    const cached = cache.get("summary");

    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return res.json({ ...cached.data, cached: true });
    }

    const data = await fetchPrices(DEFAULT_SYMBOLS);

    const coins = DEFAULT_SYMBOLS.map((s) => {
      const c = data[COINS[s]];
      return {
        symbol: s,
        priceUsd: c?.usd ?? null,
        change24h: Number(c?.usd_24h_change?.toFixed(2) || 0),
      };
    });

    const text =
      coins
        .map(
          (c) =>
            `${nameMap[c.symbol] || c.symbol} ${c.priceUsd}$, ${
              c.change24h >= 0 ? "+" : "-"
            }${Math.abs(c.change24h)}%`
        )
        .join(". ") + ".";

    const result = { coins, text, cached: false };

    cache.set("summary", { data: result, time: Date.now() });

    res.json(result);
  } catch (e) {
    res.status(200).json({
      text: "Не вдалося отримати крипто ціни.",
      error: "summary error",
    });
  }
});

// =====================
// 🔹 COMPARE
// =====================
router.get("/compare", async (req, res) => {
  try {
    const data = await fetchPrices(DEFAULT_SYMBOLS);

    const coins = DEFAULT_SYMBOLS.map((s) => {
      const c = data[COINS[s]];
      return {
        symbol: s,
        priceUsd: c?.usd ?? null,
        change24h: Number(c?.usd_24h_change?.toFixed(2) || 0),
      };
    });

    const best = [...coins].sort((a, b) => b.change24h - a.change24h)[0];

    res.json({
      coins,
      best: best.symbol,
      text: `${nameMap[best.symbol]} виглядає сильніше за динамікою. Це не інвестпорада.`,
    });
  } catch (e) {
    res.status(200).json({
      text: "Не вдалося порівняти крипту.",
      error: "compare error",
    });
  }
});

// =====================
// 🔹 ANALYZE
// =====================
router.get("/analyze", async (req, res) => {
  try {
    const symbol = String(req.query.symbol || "").toUpperCase();

    if (!COINS[symbol]) {
      return res.status(400).json({ error: "Unsupported symbol" });
    }

    const data = await fetchPrices([symbol]);
    const coin = data[COINS[symbol]];

    res.json({
      symbol,
      priceUsd: coin.usd,
      text: `${nameMap[symbol]} зараз ${coin.usd}$. Ризик високий.`,
    });
  } catch (e) {
    res.status(200).json({
      text: "Не вдалося зробити аналіз.",
      error: "analyze error",
    });
  }
});

export default router;
