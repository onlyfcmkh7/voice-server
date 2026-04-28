import express from "express";

const router = express.Router();

router.get("/", async (req, res) => {
  res.json({
    text: "Work.ua моніторинг підключено. Нових оновлень поки не перевіряю."
  });
});

export default router;
