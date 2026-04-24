import express from "express";

const router = express.Router();

const COINS = {
  BTC: "bitcoin",
  SOL: "solana",
  AVAX: "avalanche-2",
  LTC: "litecoin",
};

const cache = new Map();
const CACHE_TTL = 60 * 1000; // 60 секунд

async function fetchPrices(symbols) {
  const ids = symbols.map((s) => COINS[s]).join(",");

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(`CoinGecko error ${response.status}: ${errorText}`);
  }

  return response.json();
}

router.get("/price", async (req, res) => {
  try {
    const symbol = String(req.query.symbol || "").toUpperCase();
    const coinId = COINS[symbol];

    if (!coinId) {
      return res.status(400).json({
        error: "Unsupported symbol",
      });
    }

    const cached = cache.get(`price:${symbol}`);

    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return res.json({
        ...cached.data,
        cached: true,
      });
    }

    const data = await fetchPrices([symbol]);
    const coin = data[coinId];

    if (!coin || typeof coin.usd !== "number") {
      return res.status(502).json({
        error: "Invalid CoinGecko response",
        data,
      });
    }

    const change24h =
      typeof coin.usd_24h_change === "number"
        ? Number(coin.usd_24h_change.toFixed(2))
        : null;

    const result = {
      symbol,
      coinId,
      priceUsd: coin.usd,
      change24h,
      text: `${symbol} зараз ${coin.usd}${
        change24h !== null ? `, зміна ${change24h}%` : ""
      }. Це не інвестпорада.`,
      cached: false,
    };

    cache.set(`price:${symbol}`, {
      data: result,
      time: Date.now(),
    });

    return res.json(result);
  } catch (e) {
    console.error("Crypto price error:", e);

    return res.status(500).json({
      error: "Crypto price error",
      details: e.message,
    });
  }
});

router.get("/summary", async (req, res) => {
  try {
    const symbols = ["BTC", "SOL", "AVAX", "LTC"];

    const cached = cache.get("summary");

    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return res.json({
        ...cached.data,
        cached: true,
      });
    }

    const data = await fetchPrices(symbols);

    const coins = symbols.map((symbol) => {
      const coinId = COINS[symbol];
      const coin = data[coinId];

      const change24h =
        typeof coin?.usd_24h_change === "number"
          ? Number(coin.usd_24h_change.toFixed(2))
          : null;

      return {
        symbol,
        coinId,
        priceUsd: coin?.usd ?? null,
        change24h,
      };
    });

    const text = coins
      .map((c) => {
        const direction =
          c.change24h > 0 ? "плюс" : c.change24h < 0 ? "мінус" : "без змін";

        return `${c.symbol}: ${c.priceUsd}$, ${direction} ${Math.abs(
          c.change24h ?? 0
        )}%`;
      })
      .join(". ");

    const result = {
      coins,
      text: `${text}. Це не інвестпорада.`,
      cached: false,
    };

    cache.set("summary", {
      data: result,
      time: Date.now(),
    });

    return res.json(result);
  } catch (e) {
    console.error("Crypto summary error:", e);

    return res.status(500).json({
      error: "Crypto summary error",
      details: e.message,
    });
  }
});

export default router;
