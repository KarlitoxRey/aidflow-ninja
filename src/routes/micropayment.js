const express = require('express');
const router = express.Router();
const { registerMicropayment } = require('../utils/micropayment');

router.post('/micropayment', async (req, res) => {
    try {
        const { userId, amount, eventType, referenceId, notes } = req.body;

        const micropayment = await registerMicropayment({
            userId, amount, eventType, referenceId, notes
        });

        res.status(201).json({ success: true, micropayment });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = router;
