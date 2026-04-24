import express from "express";

const router = express.Router();

const COINS = {
  BTC: "bitcoin",
  SOL: "solana",
  AVAX: "avalanche-2",
  LTC: "litecoin",
  LINK: "chainlink",
};

const cache = new Map();
const CACHE_TTL = 60 * 1000; // 60 сек

// 🔹 універсальний запит
async function fetchPrices(symbols) {
  const ids = symbols.map((s) => COINS[s]).join(",");

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CoinGecko ${response.status}: ${errorText}`);
  }

  return response.json();
}

// =====================
// 🔹 PRICE (1 монета)
// =====================
router.get("/price", async (req, res) => {
  try {
    const symbol = String(req.query.symbol || "").toUpperCase();
    const coinId = COINS[symbol];

    if (!coinId) {
      return res.status(400).json({ error: "Unsupported symbol" });
    }

    const cached = cache.get(`price:${symbol}`);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return res.json({ ...cached.data, cached: true });
    }

    const data = await fetchPrices([symbol]);
    const coin = data[coinId];

    if (!coin?.usd) {
      return res.status(502).json({ error: "Invalid data", data });
    }

    const change24h = Number(coin.usd_24h_change?.toFixed(2) || 0);

    const result = {
      symbol,
      priceUsd: coin.usd,
      change24h,
      text: `${symbol} зараз ${coin.usd}$, ${
        change24h >= 0 ? "плюс" : "мінус"
      } ${Math.abs(change24h)}%. Це не інвестпорада.`,
      cached: false,
    };

    cache.set(`price:${symbol}`, { data: result, time: Date.now() });

    res.json(result);
  } catch (e) {
    console.error("PRICE ERROR:", e);
    res.status(500).json({ error: "Crypto price error", details: e.message });
  }
});

// =====================
// 🔹 SUMMARY (всі монети)
// =====================
router.get("/summary", async (req, res) => {
  try {
    const symbols = ["BTC", "SOL", "AVAX", "LTC"];

    const cached = cache.get("summary");
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return res.json({ ...cached.data, cached: true });
    }

    const data = await fetchPrices(symbols);

    const coins = symbols.map((symbol) => {
      const coin = data[COINS[symbol]];
      const change24h = Number(coin?.usd_24h_change?.toFixed(2) || 0);

      return {
        symbol,
        priceUsd: coin?.usd ?? null,
        change24h,
      };
    });

    const text = coins
      .map(
        (c) =>
          `${c.symbol} ${
            c.change24h >= 0 ? "плюс" : "мінус"
          } ${Math.abs(c.change24h)}%`
      )
      .join(". ");

    const result = {
      coins,
      text: `${text}. Ринок ${
        coins.every((c) => c.change24h >= 0)
          ? "переважно росте"
          : "змішаний"
      }. Це не інвестпорада.`,
      cached: false,
    };

    cache.set("summary", { data: result, time: Date.now() });

    res.json(result);
  } catch (e) {
    console.error("SUMMARY ERROR:", e);
    res
      .status(500)
      .json({ error: "Crypto summary error", details: e.message });
  }
});

// =====================
// 🔹 COMPARE (2+ монети)
// =====================
router.get("/compare", async (req, res) => {
  try {
    const symbolsParam = String(req.query.symbols || "").toUpperCase();
    const symbols = symbolsParam.split(",").map((s) => s.trim());

    if (symbols.length < 2) {
      return res.status(400).json({
        error: "Example: /compare?symbols=SOL,LINK",
      });
    }

    const validSymbols = symbols.filter((s) => COINS[s]);

    if (validSymbols.length < 2) {
      return res.status(400).json({
        error: "Not enough valid symbols",
      });
    }

    const data = await fetchPrices(validSymbols);

    const coins = validSymbols.map((symbol) => {
      const coin = data[COINS[symbol]];
      const change24h = Number(coin?.usd_24h_change?.toFixed(2) || 0);

      return {
        symbol,
        priceUsd: coin?.usd ?? null,
        change24h,
      };
    });

    const best = [...coins].sort((a, b) => b.change24h - a.change24h)[0];

    const text =
      coins
        .map(
          (c) =>
            `${c.symbol} ${
              c.change24h >= 0 ? "плюс" : "мінус"
            } ${Math.abs(c.change24h)}%`
        )
        .join(". ") +
      `. Краще виглядає ${best.symbol}. Це не інвестпорада.`;

    res.json({
      coins,
      best: best.symbol,
      text,
    });
  } catch (e) {
    console.error("COMPARE ERROR:", e);
    res
      .status(500)
      .json({ error: "Crypto compare error", details: e.message });
  }
});

export default router;
