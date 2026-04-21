import express from "express";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";

const app = express();
const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
  res.send("Voice server is running");
});

app.post("/voice", upload.single("audio"), async (req, res) => {
  let uploadedPath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        error: true,
        message: "Audio file not provided",
      });
    }

    uploadedPath = req.file.path;

    console.log("File received:");
    console.log("path:", req.file.path);
    console.log("name:", req.file.originalname);
    console.log("mimetype:", req.file.mimetype);
    console.log("size:", req.file.size);

    // 1. Розпізнавання голосу
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "gpt-4o-mini-transcribe",
    });

    const text = transcription.text || "";
    console.log("Transcription:", text);

    // 2. Генерація відповіді
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Ти голосовий асистент. Відповідай коротко, дружньо і українською мовою.",
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    const reply = response.choices?.[0]?.message?.content || "Не вдалося сформувати відповідь.";
    console.log("Reply:", reply);

    // 3. Озвучка
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: reply,
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
    });

    res.send(audioBuffer);
  } catch (err) {
    console.error("VOICE ERROR:");
    console.error(err);

    res.status(500).json({
      error: true,
      message: err.message || "Unknown server error",
      cause: err.cause?.code || null,
    });
  } finally {
    if (uploadedPath && fs.existsSync(uploadedPath)) {
      try {
        fs.unlinkSync(uploadedPath);
      } catch (deleteError) {
        console.error("Failed to delete temp file:", deleteError);
      }
    }
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
