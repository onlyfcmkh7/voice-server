import express from "express";
import { getWorkUaEmails } from "./gmailClient.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const emails = await getWorkUaEmails();

  const summary = emails
    .map((email) => email.snippet)
    .join(". ");

  res.json({
    text: summary || "Нових оновлень Work.ua немає."
  });
});

export default router;
