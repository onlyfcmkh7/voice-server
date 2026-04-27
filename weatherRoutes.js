import express from "express";
import fetch from "node-fetch";

const router = express.Router();

function normalizeCityName(city) {
  return String(city || "")
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:()"]/g, "")
    .replace(/\s+/g, " ");
}

// 🔥 ВИТЯГУЄМО МІСТО З ГОЛОСУ (ФІКС ВСІХ "ПОСЛЕ")
function extractCity(query = "") {
  return normalizeCityName(query)
    .replace("погода", "")
    .replace("температура", "")
    .replace("прогноз", "")
    .replace("яка", "")
    .replace("буде", "")
    .replace("чи", "")
    .replace("дощ", "")

    // дні (укр + рос + кривий STT)
    .replace("сьогодні", "")
    .replace("сегодня", "")
    .replace("завтра", "")
    .replace("післязавтра", "")
    .replace("після завтра", "")
    .replace("послезавтра", "")
    .replace("после завтра", "")
    .replace("после", "")

    // діапазон
    .replace(/на\s+\d+\s*(дні|дня|днів|день|дней)/, "")

    // прийменники
    .replace(/\bв\b/g, "")
    .replace(/\bу\b/g, "")

    .trim();
}

function cityVariants(cityName) {
  const city = normalizeCityName(cityName);

  return [...new Set([
    city,

    // українські відмінки
    city.replace(/ії$/, "ія"),
    city.replace(/лії$/, "лія"),
    city.replace(/еї$/, "ея"),
    city.replace(/ої$/, "а"),
    city.replace(/і$/, ""),
    city.replace(/ї$/, ""),
    city.replace(/ю$/, "я"),
    city.replace(/ем$/, ""),
    city.replace(/ом$/, ""),

    // часті кейси
    city.replace(/ковелі$/, "ковель"),
    city.replace(/ізюмі$/, "ізюм"),
    city.replace(/балаклеї$/, "балаклія"),
    city.replace(/балаклії$/, "балаклія"),

    // рос / STT
    city.replace(/харькове$/, "харків"),
    city.replace(/киеве$/, "київ"),
    city.replace(/львове$/, "львів"),
    city.replace(/одессе$/, "одеса"),
    city.replace(/одесса$/, "одеса"),
    city.replace(/днепре$/, "дніпро"),
  ])].filter(Boolean);
}

async function findCity(cityName) {
  const variants = cityVariants(cityName);

  for (const variant of variants) {
    const query = encodeURIComponent(variant);

    const url =
      `https://geocoding-api.open-meteo.com/v1/search` +
      `?name=${query}` +
      `&count=1` +
      `&language=uk` +
      `&country=UA` +
      `&format=json`;

    const response = await fetch(url);

    if (!response.ok) continue;

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      return data.results[0];
    }
  }

  return null;
}

function weatherText(code) {
  const map = {
    0: "ясно",
    1: "переважно ясно",
    2: "мінлива хмарність",
    3: "хмарно",
    45: "туман",
    48: "туман",
    51: "мряка",
    53: "мряка",
    55: "сильна мряка",
    61: "дощ",
    63: "дощ",
    65: "сильний дощ",
    71: "сніг",
    73: "сніг",
    75: "сильний сніг",
    80: "дощ",
    81: "зливи",
    82: "сильні зливи",
    95: "гроза",
  };

  return map[code] || "без опадів";
}

function parseWeatherIntent(query = "") {
  const q = normalizeCityName(query);

  if (q.includes("післязавтра") || q.includes("послезавтра")) {
    return { type: "day", offset: 2 };
  }

  if (q.includes("завтра")) {
    return { type: "day", offset: 1 };
  }

  const match = q.match(/на\s+(\d+)\s*(дні|дня|днів|день|дней)/);

  if (match) {
    return {
      type: "range",
      days: Math.min(Math.max(Number(match[1]), 3), 5),
    };
  }

  return { type: "current" };
}

function formatDailyWeather(daily, index) {
  const description = weatherText(daily.weather_code[index]);
  const min = Math.round(daily.temperature_2m_min[index]);
  const max = Math.round(daily.temperature_2m_max[index]);
  const rain = daily.precipitation_sum[index] ?? 0;

  let day = "сьогодні";
  if (index === 1) day = "завтра";
  if (index === 2) day = "післязавтра";

  let text = `${day}: ${description}, ${min}–${max}°`;

  if (rain > 0.5) {
    text += `, дощ`;
  }

  return text;
}

router.get("/", async (req, res) => {
  try {
    const queryText = req.query.q || "";

    // 🔥 ГОЛОВНЕ: беремо місто з голосу
    const extracted = extractCity(queryText);
    const rawCity = normalizeCityName(req.query.city || extracted || "київ");

    const intent = parseWeatherIntent(queryText);

    const location = await findCity(rawCity);

    if (!location) {
      return res.json({
        text: `Не знайшов місто ${rawCity}.`,
      });
    }

    const place = location.name;

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${location.latitude}` +
      `&longitude=${location.longitude}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&current=temperature_2m,weather_code` +
      `&forecast_days=5` +
      `&timezone=auto`;

    const response = await fetch(url);
    const data = await response.json();

    const daily = data.daily;
    const current = data.current;

    let text;

    if (intent.type === "day") {
      text = `${place}. ${formatDailyWeather(daily, intent.offset)}.`;
    } else if (intent.type === "range") {
      const parts = [];

      for (let i = 0; i < intent.days; i++) {
        parts.push(formatDailyWeather(daily, i));
      }

      text = `${place}. ${parts.join(". ")}.`;
    } else {
      text =
        `${place}. ${Math.round(current.temperature_2m)}°, ` +
        `${weatherText(current.weather_code)}.`;
    }

    res.json({ text });

  } catch (e) {
    console.error(e);

    res.status(500).json({
      text: "Не вдалося отримати погоду.",
    });
  }
});

export default router;
