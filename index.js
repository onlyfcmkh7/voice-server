import express from "express";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";

const app = express();
const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 👉 ОСЬ ЦЕ ДОДАЙ
app.get("/", (req, res) => {
  res.send("OK");
});

// 👉 твій основний роут
app.post("/voice", upload.single("audio"), async (req, res) => {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "gpt-4o-mini-transcribe",
    });

    const text = transcription.text;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Ти голосовий асистент." },
        { role: "user", content: text },
      ],
    });

    const reply = response.choices[0].message.content;

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
    console.error(err);
    res.status(500).send("Error");
  }
});

app.listen(process.env.PORT || 8080, () => {
  console.log("🚀 Server running on port 8080");
});
