import express from "express";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";

const app = express();
const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ТЕСТОВИЙ РУТ (щоб перевірити що сервер живий)
app.get("/", (req, res) => {
  res.send("Server is working 🚀");
});

app.post("/voice", upload.single("audio"), async (req, res) => {
  try {
    console.log("VOICE REQUEST RECEIVED");

    // 1. Розпізнаємо голос
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "gpt-4o-mini-transcribe",
    });

    console.log("TEXT:", transcription.text);

    // 2. Генеруємо відповідь
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Ти голосовий асистент." },
        { role: "user", content: transcription.text },
      ],
    });

    const reply = response.choices[0].message.content;

    console.log("REPLY:", reply);

    // 3. Озвучуємо
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: reply,
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());

    res.set({
      "Content-Type": "audio/mpeg",
    });

    res.send(audioBuffer);

    fs.unlinkSync(req.file.path);
  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).send("SERVER ERROR");
  }
});

// 🔥 ВАЖЛИВО ДЛЯ RAILWAY
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});
