import express from "express";
import { getWorkUaEmails } from "./gmailClient.js";

const router = express.Router();

function buildHumanText(emails) {
  if (!emails.length) {
    return "Нових листів від Work.ua за останні 7 днів немає.";
  }

  let androidCount = 0;
  let horecaCount = 0;
  let unknownCount = 0;

  for (const email of emails) {
    if (email.resume === "Android / AI Developer") {
      androidCount++;
    } else if (email.resume === "Менеджер HoReCa") {
      horecaCount++;
    } else {
      unknownCount++;
    }
  }

  let text = "Є оновлення по Work.ua. ";

  if (androidCount > 0) {
    text += `По Android / AI резюме є ${androidCount} нових подій. `;
  }

  if (horecaCount > 0) {
    text += `По HoReCa резюме є ${horecaCount} нових подій. `;
  }

  if (unknownCount > 0) {
    text += `Ще ${unknownCount} подій не вдалося прив’язати до конкретного резюме. `;
  }

  if (androidCount > 0 && horecaCount > androidCount) {
    text += "Поки що більше активності по HoReCa.";
  } else if (androidCount > 0) {
    text += "Є активність по IT-напрямку, варто продовжувати відгуки.";
  }

  return text.trim();
}

router.get("/", async (req, res) => {
  try {
    const emails = await getWorkUaEmails();
    const text = buildHumanText(emails);

    res.json({
      ok: true,
      count: emails.length,
      text,
      emails
    });
  } catch (error) {
    console.error("WORKUA ROUTE ERROR:", error);

    res.status(500).json({
      ok: false,
      text: "Не вдалося отримати оновлення Work.ua.",
      error: error?.message || "Unknown error"
    });
  }
});

export default router;
