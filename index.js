import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import cryptoRoutes from "./cryptoRoutes.js";
import weatherRoutes from "./weatherRoutes.js";

import {
  startTelegram,
  getUnreadTelegramMessages
} from "./telegramClient.js";

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

// анти-спам для частих однакових запитів
const lastRequests = new Map();

app.use((req, res, next) => {
  const key = req.ip + req.method + req.path;
  const now = Date.now();

  const lastTime = lastRequests.get(key) || 0;

  if (now - lastTime < 1000) {
    return res.status(200).json({
      text: "Занадто часті запити. Спробуй ще раз за секунду.",
    });
  }

  lastRequests.set(key, now);
  next();
});

app.use("/crypto", cryptoRoutes);
app.use("/weather", weatherRoutes);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 20000
});

const sessions = new Map();

const USERS_FILE = path.join(process.cwd(), 'users.json');
const CRYPTO_FILE = path.join(process.cwd(), 'crypto.json');
const CAR_FILE = path.join(process.cwd(), 'car.json');
const READ_NEWS_FILE = path.join(process.cwd(), 'read_news.json');
const LAST_NEWS_FILE = path.join(process.cwd(), 'last_news.json');

function safeReadJson(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.error(`JSON READ ERROR: ${filePath}`, error);
    return fallback;
  }
}

function getUserProfile(userId) {
  const users = safeReadJson(USERS_FILE, {});
  return users[userId] || null;
}

function getCryptoContext() {
  return safeReadJson(CRYPTO_FILE, null);
}

function getCarContext() {
  return safeReadJson(CAR_FILE, null);
}

function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[.,!?;:()"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function getMessageKey(message) {
  return `${message.chat}:${message.id}`;
}

function shouldUseCryptoContext(text) {
  const normalized = normalizeText(text);

  const cryptoKeywords = [
    'крипт',
    'btc',
    'bitcoin',
    'біткоїн',
    'биткоин',
    'портфель',
    'sol',
    'link',
    'ltc',
    'avax',
    'arb',
    'inj',
    'альт',
    'ринок',
    'ринку',
    'цикл',
    'циклу',
    'монет',
    'монета',
    'інвест',
    'інвести',
  ];

  return cryptoKeywords.some((word) => normalized.includes(word));
}

function shouldUseCarContext(text) {
  const normalized = normalizeText(text);

  const carKeywords = [
    'getz',
    'гетц',
    'hyundai',
    'хуендай',
    'двигун',
    'мотор',
    'масло',
    'гбц',
    'прокладк',
    'антифриз',
    'тосол',
    'щуп',
    'розхід масла',
    'витрата масла',
    'компрес',
    'кільця',
    'сальник',
    'машин',
    'авто',
    'перегрів',
    'температур',
  ];

  return carKeywords.some((word) => normalized.includes(word));
}

function buildSystemPrompt({ userProfile, useCrypto, useCar }) {
  let systemPrompt =
    'Ти корисний голосовий помічник. Пам’ятай контекст поточної розмови. Відповідай дуже коротко, природно, українською мовою.';

  if (userProfile?.profilePrompt) {
    systemPrompt += `\n\nПРОФІЛЬ КОРИСТУВАЧА:\n${userProfile.profilePrompt}`;
  }

  if (useCrypto) {
    const crypto = getCryptoContext();
    if (crypto) {
      systemPrompt += `\n\nКРИПТО-КОНТЕКСТ:\n${JSON.stringify(crypto, null, 2)}`;
    }
  }

  if (useCar) {
    const car = getCarContext();
    if (car) {
      systemPrompt += `\n\nАВТО-КОНТЕКСТ:\n${JSON.stringify(car, null, 2)}`;
    }
  }

  return systemPrompt;
}

app.get('/', (req, res) => {
  res.status(200).send('Server is working ✅');
});

app.post('/voice', upload.single('file'), async (req, res) => {
  let tempPath = null;
  let fixedPath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.file.size || req.file.size <= 0) {
      return res.status(400).json({ error: 'Empty audio file' });
    }

    tempPath = req.file.path;

    const originalName = req.file.originalname || 'record.wav';
    const ext = path.extname(originalName) || '.wav';
    fixedPath = `${tempPath}${ext}`;

    fs.copyFileSync(tempPath, fixedPath);

    console.log('FILE INFO:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      tempPath,
      fixedPath,
      size: req.file.size,
    });

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(fixedPath),
      model: 'gpt-4o-mini-transcribe',
      language: 'uk',
    });

    const text = (transcription.text || '').trim();

    console.log('TRANSCRIPTION:', text);

    res.json({ text });
  } catch (error) {
    console.error('VOICE ERROR:', error);

    res.status(500).json({
      error: 'Something went wrong',
      details: error?.message || 'Unknown error',
    });
  } finally {
    try {
      if (tempPath && fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }

      if (fixedPath && fs.existsSync(fixedPath)) {
        fs.unlinkSync(fixedPath);
      }
    } catch (cleanupError) {
      console.error('CLEANUP ERROR:', cleanupError);
    }
  }
});

app.post('/chat', async (req, res) => {
  try {
    const { text, sessionId, userId = 'user123' } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (!sessionId || !sessionId.trim()) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    if (!userId || !String(userId).trim()) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const cleanText = text.trim();

    const session = sessions.get(sessionId) || {
      previousResponseId: null,
    };

    const userProfile = getUserProfile(String(userId).trim());
    const useCrypto = shouldUseCryptoContext(cleanText);
    const useCar = shouldUseCarContext(cleanText);

    const systemPrompt = buildSystemPrompt({
      userProfile,
      useCrypto,
      useCar,
    });

    const response = await openai.responses.create({
      model: 'gpt-5.4',
      previous_response_id: session.previousResponseId || undefined,
      input: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: cleanText,
        },
      ],
    });

    sessions.set(sessionId, {
      previousResponseId: response.id,
    });

    console.log('CHAT SESSION:', {
      sessionId,
      userId,
      previousResponseId: session.previousResponseId,
      newResponseId: response.id,
      userText: cleanText,
      useCrypto,
      useCar,
      hasProfile: !!userProfile,
    });

    res.json({
      reply: response.output_text,
      sessionId,
      responseId: response.id,
    });
  } catch (error) {
    console.error('CHAT ERROR:', error);

    res.status(500).json({
      error: 'Chat failed',
      details: error?.message || 'Unknown error',
    });
  }
});

app.post('/reset', (req, res) => {
  try {
    const { sessionId } = req.body || {};

    if (!sessionId || !sessionId.trim()) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    sessions.delete(sessionId);

    console.log('SESSION RESET:', { sessionId });

    res.json({
      ok: true,
      message: 'Context cleared',
    });
  } catch (error) {
    console.error('RESET ERROR:', error);

    res.status(500).json({
      error: 'Reset failed',
      details: error?.message || 'Unknown error',
    });
  }
});

app.post('/tts', async (req, res) => {
  try {
    const { text } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const cleanText = text.trim().slice(0, 800);

    const speech = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: 'marin',
      input: cleanText,
    });

    const buffer = Buffer.from(await speech.arrayBuffer());

    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (error) {
    console.error('TTS ERROR:', error);

    res.status(500).json({
      error: 'TTS failed',
      details: error?.message || 'Unknown error',
    });
  }
});

app.get("/telegram/news", async (req, res) => {
  try {
    const messages = await getUnreadTelegramMessages(5);

    if (messages.length === 0) {
      return res.json({ summary: "Нових новин немає." });
    }

    const readNews = safeReadJson(READ_NEWS_FILE, {});

    const unreadMessages = messages.filter((m) => {
      return !readNews[getMessageKey(m)];
    });

    if (unreadMessages.length === 0) {
      return res.json({ summary: "Нових новин немає." });
    }

    fs.writeFileSync(
      LAST_NEWS_FILE,
      JSON.stringify(unreadMessages.slice(0, 20), null, 2)
    );

    const text = unreadMessages
      .slice(0, 20)
      .map((m) => `[${m.chat}] ${m.text}`)
      .join("\n")
      .slice(0, 3000);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Ти новинний асистент для голосу.

Відповідай українською.
Максимум 5 коротких пунктів.
До 10 слів кожен.
Без вступу.
Без води.
Без пояснень.
Ігноруй неважливі повідомлення.

Формат:
1. ...
2. ...
3. ...
`
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    const summary = (completion?.choices?.[0]?.message?.content || "")
      .trim()
      .slice(0, 600);

    for (const msg of unreadMessages) {
      readNews[getMessageKey(msg)] = true;
    }

    fs.writeFileSync(READ_NEWS_FILE, JSON.stringify(readNews, null, 2));

    res.json({
      summary: summary || "Не знайшов важливих новин."
    });

  } catch (e) {
    console.error("TELEGRAM NEWS ERROR:", e);

    res.status(500).json({
      error: "Telegram error",
      details: e.message || "Unknown error"
    });
  }
});

app.get("/telegram/news/detail", async (req, res) => {
  try {
    const number = Number(req.query.number || 1);

    if (!Number.isInteger(number) || number < 1) {
      return res.status(400).json({
        error: "Invalid news number"
      });
    }

    const lastNews = safeReadJson(LAST_NEWS_FILE, []);

    if (!Array.isArray(lastNews) || lastNews.length === 0) {
      return res.json({
        detail: "Спочатку попроси короткі новини."
      });
    }

    const selected = lastNews[number - 1];

    if (!selected) {
      return res.json({
        detail: "Такої новини в останньому списку немає."
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
content: `
Ти пояснюєш одну новину для голосового асистента.

Відповідай українською.
Використовуй ТІЛЬКИ текст новини, який дав користувач.
НЕ вигадуй факти, дати, причини або наслідки.
Якщо інформації мало — скажи: "Деталей у повідомленні мало."

До 4 коротких речень.
Без води.
`
`
        },
        {
          role: "user",
          content: `[${selected.chat}] ${selected.text}`
        }
      ]
    });

    const detail = (completion?.choices?.[0]?.message?.content || "")
      .trim()
      .slice(0, 900);

    res.json({
      detail: detail || "Не вдалося пояснити цю новину."
    });

  } catch (e) {
    console.error("TELEGRAM NEWS DETAIL ERROR:", e);

    res.status(500).json({
      error: "Telegram news detail error",
      details: e.message || "Unknown error"
    });
  }
});

const PORT = process.env.PORT || 3000;

console.log("STARTING TELEGRAM...");

try {
  startTelegram();
} catch (e) {
  console.error("TELEGRAM START ERROR:", e);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
