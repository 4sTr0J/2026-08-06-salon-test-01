import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import salonOwnerRoutes from "./routes/salonOwnerRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import aiRoutes from "./AI Agent/src/routes/ai.routes.js";
import reviewRoutes from "./salon_reviews/reviewRoutes.js";
import cancellationPolicyRoutes from "./appointment_cancellation/cancellationPolicyRoutes.js";
import appointmentCancelRoutes from "./appointment_cancellation/appointmentCancelRoutes.js";
import { startReminderScheduler } from "./Appointments and notification/jobs/reminderScheduler.js";

dotenv.config();

const app = express();

// Allow React frontend connection on any localhost port
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        // Allow any localhost origin
        if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.get("/", (req, res) => {
    res.send("Salon Booking API is running");
});
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/owner", salonOwnerRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/cancellation-policy", cancellationPolicyRoutes);
app.use("/api/appointments", appointmentCancelRoutes);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    console.log(`[Backend Services Active on port ${PORT}]`);
    startReminderScheduler();
});