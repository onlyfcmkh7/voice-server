import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import fs from 'fs';

const app = express();
const upload = multer({ dest: 'uploads/' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Health check / root
app.get('/', (req, res) => {
  res.status(200).send('Server is working ✅');
});

// Voice transcription
app.post('/voice', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: 'gpt-4o-transcribe',
    });

    res.json({ text: transcription.text });
  } catch (error) {
    console.error('VOICE ERROR:', error);
    res.status(500).json({
      error: 'Something went wrong',
      details: error?.message || 'Unknown error',
    });
  } finally {
    // чистимо тимчасовий файл після обробки
    if (req.file?.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) {
          console.error('Failed to delete temp file:', err.message);
        }
      });
    }
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
