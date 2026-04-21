import express from "express";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";

const app = express();
const upload = multer({ dest: "uploads/" });

// 🔑 OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ ТЕСТ (щоб перевірити що сервер живий)
app.get("/", (req, res) => {
  res.send("OK");
});

// 🎤 ГОЛОС
app.post("/voice", upload.single("audio"), async (req, res) => {
  try {
    console.log("➡️ REQUEST RECEIVED");

    if (!req.file) {
      console.log("❌ NO FILE");
      return res.status(400).send("No file");
    }

    // 1️⃣ Speech → Text
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "gpt-4o-mini-transcribe",
    });

    const text = transcription.text;
    console.log("📝 TEXT:", text);

    // 2️⃣ GPT
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Ти голосовий асистент." },
        { role: "user", content: text },
      ],
    });

    const reply = completion.choices[0].message.content;
    console.log("🤖 REPLY:", reply);

    // 3️⃣ Text → Speech
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

    // 🧹 очищаємо файл
    fs.unlinkSync(req.file.path);

  } catch (err) {
    console.error("🔥 ERROR:", err);
    res.status(500).send(err.message || "Server error");
  }
});

// 🚀 запуск
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
