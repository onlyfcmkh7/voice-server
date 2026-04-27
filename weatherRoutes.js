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

// 🔥 НОВЕ — витягуємо місто з голосу
function extractCity(query = "") {
  return normalizeCityName(query)
    .replace("погода", "")
    .replace("температура", "")
    .replace("прогноз", "")
    .replace("яка", "")
    .replace("буде", "")
    .replace("чи", "")
    .replace("дощ", "")
    .replace("сьогодні", "")
    .replace("завтра", "")
    .replace("післязавтра", "")
    .replace(/на\s+\d+\s*(дні|дня|днів)/, "")
    .replace(/\bв\b/g, "")
    .replace(/\bу\b/g, "")
    .trim();
}

function cityVariants(cityName) {
  const city = normalizeCityName(cityName);

  return [...new Set([
    city,

    city.replace(/ії$/, "ія"),
    city.replace(/лії$/, "лія"),
    city.replace(/еї$/, "ея"),
    city.replace(/ої$/, "а"),
    city.replace(/і$/, ""),
    city.replace(/ї$/, ""),
    city.replace(/ю$/, "я"),
    city.replace(/ем$/, ""),
    city.replace(/ом$/, ""),

    city.replace(/ковелі$/, "ковель"),
    city.replace(/ізюмі$/, "ізюм"),
    city.replace(/балаклеї$/, "балаклія"),
    city.replace(/балаклії$/, "балаклія"),

    city.replace(/харькове$/, "харків"),
    city.replace(/киеве$/, "київ"),
    city.replace(/львове$/, "львів"),
    city.replace(/одессе$/, "одеса"),
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

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Geocoding ${response.status}: ${body}`);
    }

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
    48: "туман з памороззю",
    51: "слабка мряка",
    53: "мряка",
    55: "сильна мряка",
    61: "слабкий дощ",
    63: "дощ",
    65: "сильний дощ",
    71: "слабкий сніг",
    73: "сніг",
    75: "сильний сніг",
    80: "короткий дощ",
    81: "зливи",
    82: "сильні зливи",
    95: "гроза",
    96: "гроза з градом",
    99: "сильна гроза з градом",
  };

  return map[code] || "невідомі умови";
}

function parseWeatherIntent(query = "") {
  const q = normalizeCityName(query);

  if (q.includes("післязавтра")) return { type: "day", offset: 2 };
  if (q.includes("завтра")) return { type: "day", offset: 1 };

  const match = q.match(/на\s+(\d+)\s*(дні|дня|днів)/);

  if (match) {
    return {
      type: "range",
      days: Math.min(Math.max(Number(match[1]), 3), 5),
    };
  }

  return { type: "current", offset: 0 };
}

function formatDailyWeather(daily, index) {
  const description = weatherText(daily.weather_code[index]);
  const min = Math.round(daily.temperature_2m_min[index]);
  const max = Math.round(daily.temperature_2m_max[index]);
  const rain = daily.precipitation_sum[index] ?? 0;

  let day = "сьогодні";
  if (index === 1) day = "завтра";
  if (index === 2) day = "післязавтра";
  if (index > 2) day = `через ${index} дні`;

  let text = `${day}: ${description}, від ${min} до ${max} градусів`;

  if (rain > 0.5) {
    text += `, опади близько ${Math.round(rain)} міліметрів`;
  }

  return text;
}

router.get("/", async (req, res) => {
  try {
    const queryText = req.query.q || req.query.text || "";

    // 🔥 КЛЮЧОВИЙ ФІКС
    const extracted = extractCity(queryText);
    const rawCity = normalizeCityName(req.query.city || extracted || "київ");

    const intent = parseWeatherIntent(queryText);

    const location = await findCity(rawCity);

    if (!location) {
      return res.json({
        text: `Не знайшов місто ${rawCity}.`,
      });
    }

    const place = [
      location.name,
      location.admin1,
      location.country,
    ].filter(Boolean).join(", ");

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${location.latitude}` +
      `&longitude=${location.longitude}` +
      `&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&forecast_days=5` +
      `&timezone=auto`;

    const response = await fetch(url);
    const data = await response.json();

    const current = data.current || {};
    const daily = data.daily || {};

    let text;

    if (intent.type === "day") {
      text = `Погода: ${place}. ${formatDailyWeather(daily, intent.offset)}.`;
    } else if (intent.type === "range") {
      const days = [];

      for (let i = 0; i < intent.days; i++) {
        days.push(formatDailyWeather(daily, i));
      }

      text = `Прогноз: ${place} на ${intent.days} дні. ${days.join(". ")}.`;
    } else {
      text =
        `Погода: ${place}. ${Math.round(current.temperature_2m)} градусів. ` +
        `${weatherText(current.weather_code)}.`;
    }

    res.json({ text });

  } catch (e) {
    res.status(500).json({
      text: "Не вдалося отримати погоду.",
    });
  }
});

export default router;
