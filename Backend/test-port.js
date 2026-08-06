import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

const server = app.listen(5001, async () => {
    console.log("Test server running on port 5001");
    try {
        const res = await fetch("http://localhost:5001/api/auth/salons");
        console.log("Result status on port 5001:", res.status);
        const data = await res.json().catch(() => null);
        console.log("Result body:", data);
    } catch (err) {
        console.error("Test fetch error:", err.message);
    }
    server.close();
});
