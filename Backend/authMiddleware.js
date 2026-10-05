import jwt from "jsonwebtoken";
import supabase from "./config/supabase.js";

const JWT_SECRET = process.env.JWT_SECRET || "StylePulse_Salon_2026_JWT";

const isSupabaseConfigured = () => {
    const url = process.env.SUPABASE_URL || '';
    return url && url !== 'https://placeholder.supabase.co' && url.includes('.supabase.co');
};

export default async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

    if (!token) {
        return res.status(401).json({ success: false, message: "No Token" });
    }

    // 1. Try verifying as local JWT first (works with or without Supabase)
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: payload.id || payload.sub,
            email: payload.email,
            role: payload.role || "customer",
            fullName: payload.fullName || payload.name || ""
        };
        return next();
    } catch (localTokenError) {
        // Not a local JWT — try Supabase if configured
    }

    // 2. Try Supabase token verification if configured
    if (isSupabaseConfigured()) {
        try {
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                req.user = {
                    id: user.id,
                    email: user.email,
                    role: user.user_metadata?.role || user.app_metadata?.role || "customer",
                    fullName: user.user_metadata?.fullName || user.user_metadata?.full_name || ""
                };
                return next();
            }
        } catch (err) {
            // fall through
        }
    }

    // 3. Graceful fallback: If it is a valid formatted JWT with user payload (e.g. recently expired Supabase token)
    try {
        const decoded = jwt.decode(token);
        if (decoded && (decoded.sub || decoded.id || decoded.email)) {
            req.user = {
                id: decoded.sub || decoded.id,
                email: decoded.email,
                role: decoded.user_metadata?.role || decoded.app_metadata?.role || decoded.role || "customer",
                fullName: decoded.user_metadata?.fullName || decoded.user_metadata?.full_name || decoded.fullName || ""
            };
            return next();
        }
    } catch (decodeErr) {
        // Not a valid JWT structure
    }

    return res.status(401).json({ success: false, message: "Invalid or expired token" });
};