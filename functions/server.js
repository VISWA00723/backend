const express = require('express');
const router = express.Router();

router.post('/analyze', async (req, res) => {
    // Change the model from 'mistralai/devstral-2512:free' to 'nvidia/nemotron-3-super-120b-a12b:free'
    const model = 'nvidia/nemotron-3-super-120b-a12b:free';
    // Your existing analyze logic
});

router.post('/add-expense', async (req, res) => {
    // Change the model from 'mistralai/devstral-2512:free' to 'nvidia/nemotron-3-super-120b-a12b:free'
    const model = 'nvidia/nemotron-3-super-120b-a12b:free';
    // Your existing add expense logic
});

module.exports = router;