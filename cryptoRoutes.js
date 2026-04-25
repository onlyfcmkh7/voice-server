import express from "express";
import OpenAI from "openai";

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 20000,
});

// 🔥 ТІЛЬКИ ТВОЇ МОНЕТИ
const DEFAULT_SYMBOLS = ["BTC", "SOL", "AVAX", "LTC"];

const COINS = {
  BTC: "bitcoin",
  SOL: "solana",
  AVAX: "avalanche-2",
  LTC: "litecoin",
};

// кеш
const cache = new Map();
const CACHE_TTL = 60 * 1000;

// 🔹 отримання цін
async function fetchPrices(symbols) {
  const ids = symbols.map((s) => COINS[s]).join(",");

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`CoinGecko ${response.status}: ${text}`);
  }

  return response.json();
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
      text: `${symbol} зараз ${coin.usd}$, ${
        change >= 0 ? "плюс" : "мінус"
      } ${Math.abs(change)}%. Це не інвестпорада.`,
      cached: false,
    };

    cache.set(`price:${symbol}`, { data: result, time: Date.now() });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "price error", details: e.message });
  }
});

// =====================
// 🔹 SUMMARY (FIXED)
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

    // 🔥 ФІКС: додаємо ціну
    const text =
      coins
        .map(
          (c) =>
            `${c.symbol} зараз ${c.priceUsd}$, ${
              c.change24h >= 0 ? "плюс" : "мінус"
            } ${Math.abs(c.change24h)}%`
        )
        .join(". ") +
      `. Ринок ${
        coins.filter((c) => c.change24h > 0).length >= 3
          ? "переважно росте"
          : "змішаний"
      }. Це не інвестпорада.`;

    const result = { coins, text, cached: false };

    cache.set("summary", { data: result, time: Date.now() });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "summary error", details: e.message });
  }
});

// =====================
// 🔹 COMPARE (GPT)
// =====================
router.get("/compare", async (req, res) => {
  try {
    const symbolsParam = String(req.query.symbols || "").toUpperCase();

    const symbols = symbolsParam
      ? symbolsParam.split(",").map((s) => s.trim())
      : DEFAULT_SYMBOLS;

    const valid = symbols.filter((s) => COINS[s]);

    if (valid.length < 2) {
      return res.status(400).json({ error: "Need 2+ symbols" });
    }

    const cacheKey = `compare:${valid.join(",")}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return res.json({ ...cached.data, cached: true });
    }

    const data = await fetchPrices(valid);

    const coins = valid.map((s) => {
      const c = data[COINS[s]];
      return {
        symbol: s,
        priceUsd: c?.usd ?? null,
        change24h: Number(c?.usd_24h_change?.toFixed(2) || 0),
      };
    });

    const best = [...coins].sort((a, b) => b.change24h - a.change24h)[0];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Ти крипто-аналітик для голосового асистента. Коротко, по ділу, без гарантій. Завжди додавай: Це не інвестпорада.",
        },
        {
          role: "user",
          content: `
Монети:

${coins
  .map(
    (c) =>
      `${c.symbol}: ціна ${c.priceUsd}, зміна за 24г ${c.change24h}%`
  )
  .join("\n")}

Скажи:
- хто виглядає сильніше
- чи варто заходити
- ризики
- короткий висновок

Максимум 4 короткі речення.
`,
        },
      ],
    });

    const text =
      completion.choices?.[0]?.message?.content?.trim() ||
      `${best.symbol} виглядає сильніше за динамікою. Ризик високий через волатильність. Заходити краще частинами. Це не інвестпорада.`;

    const result = {
      coins,
      best: best.symbol,
      text,
      cached: false,
    };

    cache.set(cacheKey, { data: result, time: Date.now() });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "compare error", details: e.message });
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

    const change = Number(coin?.usd_24h_change?.toFixed(2) || 0);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Крипто-аналітик. Коротко: тренд, ризик, чи входити. Без гарантій. Завжди: Це не інвестпорада.",
        },
        {
          role: "user",
          content: `
Монета: ${symbol}
Ціна: ${coin.usd}
Зміна: ${change}%

Дай коротку відповідь.
`,
        },
      ],
    });

    const text =
      completion.choices?.[0]?.message?.content?.trim() ||
      `${symbol} зараз ${coin.usd}$. Ризик високий. Це не інвестпорада.`;

    res.json({
      symbol,
      priceUsd: coin.usd,
      change24h: change,
      text,
    });
  } catch (e) {
    res.status(500).json({ error: "analyze error", details: e.message });
  }
});

export default router;
