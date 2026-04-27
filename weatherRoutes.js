const express = require("express");
const router = express.Router();

router.get("/weather", async (req, res) => {
    try {
        const city = req.query.city || "Kyiv";

        // 🔥 поки заглушка
        const text = `Погода в ${city}: +20°C, сонячно ☀️`;

        res.json({
            text
        });

    } catch (e) {
        res.status(500).json({
            text: "Помилка погоди"
        });
    }
});

module.exports = router;
