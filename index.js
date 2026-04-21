import express from "express";
import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";
import OpenAI from "openai";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
  res.send("Voice server is running");
});

app.get("/ping", (req, res) => {
  console.log("PING OK");
  res.json({ ok: true });
});

app.post("/voice", upload.single("audio"), async (req, res) => {
  let tempFilePath = null;

  try {
    console.log("STEP 1: REQUEST RECEIVED");

    if (!req.file) {
      console.log("STEP 1.1: NO FILE");
      return res.status(400).json({
        error: true,
        message: "Audio file not provided",
      });
    }

    console.log("STEP 2: FILE RECEIVED");
    console.log("originalname:", req.file.originalname);
    console.log("mimetype:", req.file.mimetype);
    console.log("size:", req.file.size);

    tempFilePath = path.join(os.tmpdir(), `voice-${Date.now()}.m4a`);
    fs.writeFileSync(tempFilePath, req.file.buffer);

    console.log("STEP 3: TEMP FILE SAVED:", tempFilePath);
    console.log("STEP 4: START TRANSCRIPTION");

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "gpt-4o-mini-transcribe",
    });

    const text = transcription.text || "";
    console.log("STEP 5: TRANSCRIBED:", text);

    console.log("STEP 6: START CHAT");
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Ти голосовий асистент. Відповідай коротко, дружньо і українською мовою.",
        },
        {
          role: "user",
          content: text || "Користувач нічого не сказав",
        },
      ],
    });

    const reply =
      response.choices?.[0]?.message?.content ||
      "Не вдалося сформувати відповідь.";

    console.log("STEP 7: CHAT READY:", reply);
    console.log("STEP 8: START TTS");

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: reply,
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());

    console.log("STEP 9: TTS READY, bytes:", audioBuffer.length);

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
    });

    res.send(audioBuffer);
    console.log("STEP 10: RESPONSE SENT");
  } catch (err) {
    console.error("VOICE ERROR:");
    console.error(err);

    res.status(500).json({
      error: true,
      message: err.message || "Unknown server error",
      cause: err.cause?.code || null,
    });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log("STEP 11: TEMP FILE DELETED");
      } catch (deleteError) {
        console.error("DELETE ERROR:", deleteError);
      }
    }
  }
});

// middleware-level error logging
app.use((err, req, res, next) => {
  console.error("EXPRESS ERROR:");
  console.error(err);

  res.status(500).json({
    error: true,
    message: err.message || "Express middleware error",
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
