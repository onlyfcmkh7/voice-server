import express from "express";
import { getWorkUaEmails } from "./gmailClient.js";

const router = express.Router();

function buildHumanText(emails) {
  if (!emails.length) {
    return "Важливих оновлень від Work.ua немає.";
  }

  const jobOffers = emails.filter((email) => email.type === "job_offer");
  const resumeViews = emails.filter((email) => email.type === "resume_view");
  const messages = emails.filter((email) => email.type === "message");
  const applicationViews = emails.filter((email) => email.type === "application_view");

  let text = "Є оновлення по Work.ua. ";

  if (jobOffers.length > 0) {
    text += `У вас ${jobOffers.length} непереглянуті пропозиції від роботодавців. `;
  }

  if (resumeViews.length > 0) {
    text += `Резюме переглядали ${resumeViews.length} разів. `;
  }

  if (messages.length > 0) {
    text += `Є ${messages.length} нові повідомлення. `;
  }

  if (applicationViews.length > 0) {
    text += `Ваші відгуки переглянули ${applicationViews.length} разів. `;
  }

  text += "Рекомендую зайти в кабінет Work.ua і перевірити деталі.";

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
