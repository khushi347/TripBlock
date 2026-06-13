const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middlewares/error.middleware');

// Load env variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
const authRouter = require('./routes/auth.routes');
const requestRouter = require('./routes/request.routes');
const tripBlockRouter = require('./routes/tripBlock.routes');
const assignmentRouter = require('./routes/assignment.routes');
const dashboardRouter = require('./routes/dashboard.routes');
const analyticsRouter = require('./routes/analytics.routes');

app.use('/api/auth', authRouter);
app.use('/api/requests', requestRouter);
app.use('/api/tripblocks', tripBlockRouter);
app.use('/api/assignments', assignmentRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/analytics', analyticsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'TripBlock Backend is running' });
});

// Error handling middleware
app.use(errorHandler);

module.exports = app;
