import express from "express";

const router = express.Router();

const CITY_COORDS = {
  "київ": { name: "Київ", lat: 50.4501, lon: 30.5234 },
  "львів": { name: "Львів", lat: 49.8397, lon: 24.0297 },
  "одеса": { name: "Одеса", lat: 46.4825, lon: 30.7233 },
  "харків": { name: "Харків", lat: 49.9935, lon: 36.2304 },
  "дніпро": { name: "Дніпро", lat: 48.4647, lon: 35.0462 },
};

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
  };

  return map[code] || "невідомі умови";
}

router.get("/", async (req, res) => {
  try {
    const rawCity = String(req.query.city || "київ").toLowerCase().trim();
    const city = CITY_COORDS[rawCity] || CITY_COORDS["київ"];

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${city.lat}` +
      `&longitude=${city.lon}` +
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

    const text =
      `Погода в місті ${city.name}: ${temp} градусів, відчувається як ${feels}. ` +
      `${description}. Вітер ${wind} кілометрів на годину. ` +
      `Опади: ${precipitation} міліметрів.`;

    res.json({
      city: city.name,
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
