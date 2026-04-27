import express from "express";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const city = req.query.city || "Kyiv";

        const text = `Погода в ${city}: +20°C, сонячно ☀️`;

        res.json({ text });

    } catch (e) {
        res.status(500).json({
            text: "Помилка погоди"
        });
    }
});

export default router;
