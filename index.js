import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';

const app = express();
const upload = multer({ dest: 'uploads/' });

// 🔑 OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 👉 Перевірка що сервер живий
app.get('/', (req, res) => {
  res.send('Server is working ✅');
});

// 👉 Основний endpoint
app.post('/voice', upload.single('file'), async (req, res) => {
  try {
    const response = await openai.audio.transcriptions.create({
      file: await fetch(req.file.path),
      model: 'gpt-4o-transcribe',
    });

    res.json({ text: response.text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// 👉 Порт
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
