import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const app = express();
const upload = multer({ dest: 'uploads/' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
      model: 'gpt-4o-transcribe',
    });

    res.json({ text: transcription.text });
  } catch (error) {
    console.error('OPENAI ERROR:', error);
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
