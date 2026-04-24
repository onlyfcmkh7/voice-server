import express from "express";

const router = express.Router();

const COINS = {
  BTC: "bitcoin",
  SOL: "solana",
  AVAX: "avalanche-2",
  LTC: "litecoin",
};

router.get("/price", async (req, res) => {
  try {
    const symbol = String(req.query.symbol || "").toUpperCase();
    const coinId = COINS[symbol];

    if (!coinId) {
      return res.status(400).json({ error: "Unsupported symbol" });
    }

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(502).json({
        error: "CoinGecko error",
        status: response.status,
        details: errorText,
      });
    }

    const data = await response.json();
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

    res.json({
      symbol,
      coinId,
      priceUsd: coin.usd,
      change24h,
      text: `${symbol} зараз ${coin.usd}${
        change24h !== null ? `, зміна ${change24h}%` : ""
      }. Це не інвестпорада.`,
    });
  } catch (e) {
    console.error("Crypto error:", e);

    res.status(500).json({
      error: "Crypto error",
      details: e.message,
    });
  }
});

export default router;
