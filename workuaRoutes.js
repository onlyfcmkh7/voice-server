import express from "express";
import { getWorkUaEmails } from "./gmailClient.js";

const router = express.Router();

function buildHumanText(emails) {
  if (!emails.length) {
    return "Нових оновлень по резюме немає.";
  }

  let text = "Є оновлення по вашим резюме. ";

  let androidViews = 0;
  let horecaViews = 0;

  for (const email of emails) {
    if (email.resume.includes("Android")) {
      androidViews++;
    }

    if (email.resume.includes("HoReCa")) {
      horecaViews++;
    }
  }

  if (androidViews > 0) {
    text += `Android резюме переглянули ${androidViews} раз. `;
  }

  if (horecaViews > 0) {
    text += `По HoReCa є ${horecaViews} переглядів. `;
  }

  // 🔥 проста аналітика
  if (horecaViews > androidViews) {
    text += "Поки що більше відгуку на попередній досвід.";
  } else if (androidViews > 0) {
    text += "Є інтерес до IT напрямку, варто продовжувати.";
  }

  return text.trim();
}

router.get("/", async (req, res) => {
  try {
    const emails = await getWorkUaEmails();
    const summary = buildHumanText(emails);

    res.json({
      text: summary
    });
  } catch (e) {
    console.error("WORKUA ERROR:", e);

    res.status(500).json({
      text: "Не вдалося отримати оновлення Work.ua"
    });
  }
});

export default router;
