import express from "express";
import dotenv from "dotenv";
import cors from "cors";

// Existing route integrations
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import salonOwnerRoutes from "./routes/salonOwnerRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import aiRoutes from "./AI Agent/src/routes/ai.routes.js";
import reviewRoutes from "./salon_reviews/reviewRoutes.js";
import cancellationPolicyRoutes from "./appointment_cancellation/cancellationPolicyRoutes.js";
import appointmentCancelRoutes from "./appointment_cancellation/appointmentCancelRoutes.js";
import loyaltyRoutes from "./routes/loyaltyRoutes.js";

// Modular Domain Routes
import customerDomainRoutes from "./Customer profile management/customerRoutes.js";
import salonDashboardDomainRoutes from "./salon profile and dashbboard/salonDashboardRoutes.js";
import salonServicesDomainRoutes from "./salon services/serviceRoutes.js";

import { startReminderScheduler } from "./Appointments and notification/jobs/reminderScheduler.js";

dotenv.config();

const app = express();

// Allow localhost and cloud frontend connections (Railway, custom domains)
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, or server-to-server)
        if (!origin) return callback(null, true);
        
        // Allow any localhost / local IP
        if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
            return callback(null, true);
        }
        
        // Allow Railway domains (*.up.railway.app, *.railway.app)
        if (origin.endsWith('.railway.app') || origin.includes('.up.railway.app')) {
            return callback(null, true);
        }

        // Allow custom FRONTEND_URL or ALLOWED_ORIGINS if configured
        const allowed = process.env.FRONTEND_URL || process.env.ALLOWED_ORIGINS;
        if (allowed && allowed.split(',').map(s => s.trim()).includes(origin)) {
            return callback(null, true);
        }

        callback(null, true); // Fallback allow for public frontend API access
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

// Domain Modular Routes
app.use("/api/customer", customerDomainRoutes);
app.use("/api/salon-dashboard", salonDashboardDomainRoutes);
app.use("/api/salon-services", salonServicesDomainRoutes);

// Compatibility Routes
app.use("/api/salons", salonServicesDomainRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/owner", salonOwnerRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/cancellation-policy", cancellationPolicyRoutes);
app.use("/api/appointments", appointmentCancelRoutes);
app.use("/api/loyalty", loyaltyRoutes);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    console.log(`[Backend Services Active on port ${PORT}]`);
    startReminderScheduler();
});