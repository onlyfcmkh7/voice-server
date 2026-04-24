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
    const data = await response.json();

    const coin = data[coinId];

    res.json({
      symbol,
      priceUsd: coin.usd,
      change24h: Number(coin.usd_24h_change?.toFixed(2)),
      text: `${symbol} зараз ${coin.usd}$, зміна ${coin.usd_24h_change?.toFixed(2)}%. Це не інвестпорада.`,
    });
  } catch (e) {
    res.status(500).json({ error: "Crypto error" });
  }
});

export default router;
