import express from "express";
import fetch from "node-fetch";

const router = express.Router();

function normalizeCityName(city) {
  return String(city || "київ")
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:()"]/g, "")
    .replace(/\s+/g, " ");
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

    // типові міста
    city.replace(/ковелі$/, "ковель"),
    city.replace(/ізюмі$/, "ізюм"),
    city.replace(/балаклеї$/, "балаклія"),
    city.replace(/балаклії$/, "балаклія"),

    // рос/мікс після STT
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

router.get("/", async (req, res) => {
  try {
    const rawCity = normalizeCityName(req.query.city || "київ");
    const location = await findCity(rawCity);

    if (!location) {
      return res.json({
        text: `Не знайшов місто ${rawCity}. Спробуй сказати назву точніше.`,
      });
    }

    const cityName = location.name || rawCity;
    const country = location.country || "";
    const region = location.admin1 || "";

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${location.latitude}` +
      `&longitude=${location.longitude}` +
      `&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
      `&timezone=auto`;

    const response = await fetch(url);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Open-Meteo ${response.status}: ${body}`);
    }

    const data = await response.json();
    const current = data.current || {};

    const temp = Math.round(current.temperature_2m);
    const feels = Math.round(current.apparent_temperature);
    const wind = Math.round(current.wind_speed_10m);
    const precipitation = current.precipitation ?? 0;
    const description = weatherText(current.weather_code);

    const place = [cityName, region, country].filter(Boolean).join(", ");

    const text =
      `Погода: ${place}. ${temp} градусів, відчувається як ${feels}. ` +
      `${description}. Вітер ${wind} кілометрів на годину. ` +
      `Опади: ${precipitation} міліметрів.`;

    res.json({
      city: cityName,
      region,
      country,
      latitude: location.latitude,
      longitude: location.longitude,
      temperature: temp,
      feelsLike: feels,
      wind,
      precipitation,
      weatherCode: current.weather_code,
      text,
    });
  } catch (e) {
    console.error("WEATHER ERROR:", e);

    res.status(500).json({
      text: "Не вдалося отримати погоду.",
      error: "weather error",
      details: e.message,
    });
  }
});

export default router;
