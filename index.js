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
    console.log("STEP 1: REQUEST RECEIVED");

    if (!req.file) {
      console.log("STEP 1.1: NO FILE");
      return res.status(400).json({
        error: true,
        message: "Audio file not provided",
      });
    }

    uploadedPath = req.file.path;

    console.log("STEP 2: FILE RECEIVED");
    console.log("path:", req.file.path);
    console.log("name:", req.file.originalname);
    console.log("mimetype:", req.file.mimetype);
    console.log("size:", req.file.size);

    console.log("STEP 3: START TRANSCRIPTION");

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "gpt-4o-mini-transcribe",
    });

    const text = transcription.text || "";
    console.log("STEP 4: TRANSCRIBED:", text);

    console.log("STEP 5: START CHAT");

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

    const reply =
      response.choices?.[0]?.message?.content || "Не вдалося сформувати відповідь.";

    console.log("STEP 6: CHAT READY:", reply);

    console.log("STEP 7: START TTS");

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: reply,
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());

    console.log("STEP 8: TTS READY, bytes:", audioBuffer.length);

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
    });

    res.send(audioBuffer);

    console.log("STEP 9: RESPONSE SENT");
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
        console.log("STEP 10: TEMP FILE DELETED");
      } catch (deleteError) {
        console.error("DELETE ERROR:", deleteError);
      }
    }
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
