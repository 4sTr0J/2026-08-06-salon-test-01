const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Initialize database (runs schema + seed on import)
require('./config/db');

const loyaltyRoutes = require('./routes/loyaltyRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Mount routes
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/auth', authRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Salon Loyalty & Rewards API is running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
