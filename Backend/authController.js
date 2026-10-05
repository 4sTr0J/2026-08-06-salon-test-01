import supabase, { supabaseAdmin } from "./config/supabase.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "StylePulse_Salon_2026_JWT";

// Check if Supabase is actually configured
const isSupabaseConfigured = () => {
    const url = process.env.SUPABASE_URL || '';
    return url && url !== 'https://placeholder.supabase.co' && url.includes('.supabase.co');
};

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, "data", "users.json");

const getLocalUsers = () => {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE, "utf-8");
            return JSON.parse(data);
        }
    } catch (err) {
        console.error("Error reading users.json:", err);
    }
    return [];
};

const saveLocalUsers = (users) => {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
    } catch (err) {
        console.error("Error writing users.json:", err);
    }
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const getSafeUserPayload = (user) => ({
    id: user?.id,
    email: user?.email,
    fullName: user?.user_metadata?.fullName || user?.fullName || user?.email?.split("@")[0] || "",
    phone: user?.user_metadata?.phone || user?.phone || "",
    role: user?.app_metadata?.role || user?.user_metadata?.role || user?.role || "customer"
});

const saveProfileToSupabase = async ({ id, fullName, email, phone, role, isApproved, salonName, salonRegId, salonAddress, salonWebsite }) => {
    if (!isSupabaseConfigured()) return;
    const client = supabaseAdmin || supabase;
    
    if (role === 'owner') {
        const { error } = await client.from("salon_owners").insert({
            id,
            full_name: fullName,
            email,
            phone,
            role: 'owner',
            salon_name: salonName,
            salon_reg_id: salonRegId,
            salon_address: salonAddress,
            salon_website: salonWebsite,
            is_approved: false
        });
        if (error) console.warn("Salon owners persistence skipped:", error.message);
    } else {
        const { error } = await client.from("users").upsert(
            { 
                id, 
                full_name: fullName, 
                email, 
                phone, 
                role: role || "customer"
            },
            { onConflict: "id" }
        );
        if (error) console.warn("Users persistence skipped:", error.message);
    }
};

const recordLoginActivity = async (req, user, session) => {
    if (!user?.id || !isSupabaseConfigured()) return;
    const fullName = user.user_metadata?.fullName || user.email?.split("@")[0] || "";
    const phone = user.user_metadata?.phone || "";
    const role = user.user_metadata?.role || user.app_metadata?.role || "customer";
    await supabase.from("login_logs").insert({
        user_id: user.id,
        full_name: fullName,
        email: user.email,
        phone,
        role,
        user_details: { fullName, phone, role, email: user.email },
        ip_address: req.ip || req.headers["x-forwarded-for"] || "unknown",
        user_agent: req.headers["user-agent"] || "unknown",
        access_token: session?.access_token || null,
        logged_in_at: new Date().toISOString(),
        logged_out_at: null,
        is_active: true
    });
};

// =========================
// REGISTER USER
// =========================

export const register = async (req, res) => {
    try {
        const { email, phone, password, salonName, salonRegId, salonAddress, salonWebsite } = req.body;
        const fullName = req.body.fullName || req.body.name;
        const reqRole = req.body.role === 'owner' ? 'owner' : 'customer';
        const isApproved = reqRole === 'owner' ? false : true;

        if (!fullName || !email || !phone || !password) {
            return res.status(400).json({ success: false, message: "All fields are required." });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
        }

        const normalizedEmail = normalizeEmail(email);

        // ---- Try Supabase if configured ----
        if (isSupabaseConfigured()) {
            try {
                let authUser, authSession = null;

                if (supabaseAdmin) {
                    const { data, error } = await supabaseAdmin.auth.admin.createUser({
                        email: normalizedEmail,
                        password,
                        email_confirm: true,
                        user_metadata: { fullName, phone, role: reqRole },
                        app_metadata: { role: reqRole }
                    });
                    if (error) return res.status(400).json({ success: false, message: error.message });
                    authUser = data.user;

                    if (isApproved) {
                        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
                        if (!loginError) authSession = loginData.session;
                    }
                } else {
                    const { data, error } = await supabase.auth.signUp({
                        email: normalizedEmail,
                        password,
                        options: { data: { fullName, phone, role: reqRole } }
                    });
                    if (error) return res.status(400).json({ success: false, message: error.message });
                    authUser = data.user;
                    authSession = isApproved ? data.session : null;
                }

                if (!authUser) return res.status(400).json({ success: false, message: "Registration failed. Please try again." });

                await saveProfileToSupabase({ 
                    id: authUser.id, 
                    fullName, 
                    email: normalizedEmail, 
                    phone, 
                    role: reqRole, 
                    isApproved,
                    salonName,
                    salonRegId,
                    salonAddress,
                    salonWebsite
                });

                // Also save to local storage as a fallback
                const localUsers = getLocalUsers();
                const hashedPassword = await bcrypt.hash(password, 10);
                if (!localUsers.find(u => u.email === normalizedEmail)) {
                    localUsers.push({
                        id: authUser.id,
                        email: normalizedEmail,
                        fullName,
                        phone,
                        password: hashedPassword,
                        role: "customer",
                        createdAt: new Date().toISOString()
                    });
                    saveLocalUsers(localUsers);
                }

                return res.status(201).json({
                    success: true,
                    message: authSession ? "Registration successful!" : "Registration successful! Please check your email to confirm your account, then sign in.",
                    user: getSafeUserPayload(authUser),
                    token: authSession?.access_token || null,
                    session: authSession
                });
            } catch (supabaseErr) {
                console.warn("Supabase registration failed, falling back to local:", supabaseErr.message);
            }
        }

        // ---- Local fallback (when Supabase not configured) ----
        const localUsers = getLocalUsers();
        const existingUser = localUsers.find(u => u.email === normalizedEmail);
        if (existingUser) {
            return res.status(400).json({ success: false, message: "An account with this email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: `local_${Date.now()}`,
            email: normalizedEmail,
            fullName,
            phone,
            password: hashedPassword,
            role: "customer",
            createdAt: new Date().toISOString()
        };
        localUsers.push(newUser);
        saveLocalUsers(localUsers);

        const token = jwt.sign(
            { id: newUser.id, email: newUser.email, role: newUser.role },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.status(201).json({
            success: true,
            message: "Registration successful!",
            user: { id: newUser.id, email: newUser.email, fullName: newUser.fullName, phone: newUser.phone, role: newUser.role },
            token
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// =========================
// LOGIN USER
// =========================

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required." });
        }

        const normalizedEmail = normalizeEmail(email);

        // ---- Strict Supabase Authentication ----
        if (isSupabaseConfigured()) {
            try {
                const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
                if (error) {
                    return res.status(401).json({ success: false, message: error.message });
                }
                // Check if user is approved
                const client = supabaseAdmin || supabase;
                const userRole = data.user.user_metadata?.role || data.user.app_metadata?.role || 'customer';
                
                if (userRole === 'owner') {
                    const { data: salonProfile } = await client
                        .from('salon_owners')
                        .select('is_approved')
                        .eq('id', data.user.id)
                        .maybeSingle();
                    
                    if (salonProfile && salonProfile.is_approved === false) {
                        return res.status(401).json({ success: false, message: "Your account is pending approval by the admin." });
                    }
                }
                
                await recordLoginActivity(req, data.user, data.session);
                return res.status(200).json({
                    success: true,
                    message: "Login successful.",
                    user: getSafeUserPayload(data.user),
                    token: data.session?.access_token,
                    session: data.session
                });
            } catch (supabaseErr) {
                return res.status(500).json({ success: false, message: "Internal server error during authentication." });
            }
        }

        // ---- Local fallback (Only runs if Supabase is NOT configured) ----
        const localUsers = getLocalUsers();
        const localUser = localUsers.find(u => u.email === normalizedEmail);
        if (!localUser) {
            return res.status(401).json({ success: false, message: supabaseError || "Invalid email or password." });
        }

        const passwordMatch = await bcrypt.compare(password, localUser.password);
        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password." });
        }

        const token = jwt.sign(
            { id: localUser.id, email: localUser.email, role: localUser.role },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            user: { id: localUser.id, email: localUser.email, fullName: localUser.fullName, phone: localUser.phone, role: localUser.role },
            token
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// =========================
// LOGOUT USER
// =========================

export const logout = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId || !isSupabaseConfigured()) {
            return res.status(200).json({ success: true, message: "Logged out successfully." });
        }

        const { error } = await supabase.from("login_logs").update({
            logged_out_at: new Date().toISOString(),
            is_active: false
        }).eq("user_id", userId).is("logged_out_at", null);

        if (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

        return res.status(200).json({ success: true, message: "Logged out successfully." });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// =========================
// GET ALL APPROVED SALONS
// =========================
export const getApprovedSalons = async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    try {
        const client = supabaseAdmin || supabase;
        let response = await client
            .from("salon_owners")
            .select("id, salon_name, salon_address, salon_website, salon_image, full_name, email");

        // Fallback if salon_image column does not exist (Postgres code 42703)
        if (response.error && response.error.code === "42703") {
            console.log("Fallback: salon_image column not found in DB. Querying without it.");
            response = await client
                .from("salon_owners")
                .select("id, salon_name, salon_address, salon_website, full_name, email");
        }

        if (response.error) throw response.error;

        // Fetch ratings, sentiment averages, and services for each salon in parallel
        const salonsWithData = await Promise.all(response.data.map(async (salon) => {
            try {
                // 1. Fetch reviews
                const { data: reviews, error: rError } = await client
                    .from('salon_reviews')
                    .select('rating, sentiment_score')
                    .eq('salon_id', salon.id);

                if (!rError && reviews && reviews.length > 0) {
                    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
                    const totalSentiment = reviews.reduce((sum, r) => sum + parseFloat(r.sentiment_score || 0), 0);
                    salon.averageRating = parseFloat((totalRating / reviews.length).toFixed(1));
                    salon.averageSentiment = parseFloat((totalSentiment / reviews.length).toFixed(2));
                    salon.reviewCount = reviews.length;
                } else {
                    salon.averageRating = 0.0;
                    salon.averageSentiment = 0.0;
                    salon.reviewCount = 0;
                }

                // 2. Fetch services
                const { data: services, error: sError } = await client
                    .from('salon_owner_services')
                    .select('*')
                    .eq('owner_id', salon.id);

                salon.services = (!sError && services) ? services : [];
            } catch (err) {
                salon.averageRating = 0.0;
                salon.averageSentiment = 0.0;
                salon.reviewCount = 0;
                salon.services = [];
            }
            return salon;
        }));

        return res.status(200).json({ success: true, salons: salonsWithData });
    } catch (err) {
        console.error("Error fetching approved salons:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// =========================
// GET SERVICES OF A PARTICULAR SALON
// =========================
export const getSalonServices = async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    try {
        const client = supabaseAdmin || supabase;
        const { id } = req.params;

        const { data, error } = await client
            .from("salon_owner_services")
            .select("*")
            .eq("owner_id", id)
            .order("created_at", { ascending: false });

        if (error) throw error;

        return res.status(200).json({ success: true, services: data });
    } catch (err) {
        console.error("Error fetching salon services:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// =========================
// BOOK APPOINTMENT (CUSTOMER)
// =========================
export const bookAppointment = async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    try {
        const client = supabaseAdmin || supabase;
        const { salonId, serviceName, date, time } = req.body;
        const userEmail = req.user.email;
        
        // Extract full name from req.user payload
        const fullName = req.user.fullName || req.user.name || userEmail.split('@')[0];

        if (!salonId || !serviceName || !date || !time) {
            return res.status(400).json({ success: false, message: "salonId, serviceName, date, and time are required." });
        }

        const { data, error } = await client
            .from("appointments")
            .insert({
                salon_id: salonId,
                customer_name: fullName,
                customer_email: userEmail,
                service_name: serviceName,
                appointment_date: date,
                appointment_time: time,
                appointment_datetime: `${date}T${time}:00`,
                reminder_time: `${date}T${time}:00`,
                reminder_status: "Pending",
                booking_status: "Confirmed" // Default status
            })
            .select()
            .single();

        if (error) throw error;

        return res.status(201).json({ success: true, message: "Appointment booked successfully.", appointment: data });
    } catch (err) {
        console.error("Error booking appointment:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// =========================
// GET CUSTOMER APPOINTMENTS
// =========================
export const getCustomerAppointments = async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    try {
        const client = supabaseAdmin || supabase;
        const userEmail = req.user.email;

        // Fetch user appointments
        const { data: appointments, error: apptError } = await client
            .from("appointments")
            .select("*")
            .eq("customer_email", userEmail)
            .order("appointment_date", { ascending: true });

        if (apptError) throw apptError;

        // Fetch salons list to map names
        const { data: salons, error: salonsError } = await client
            .from("salon_owners")
            .select("id, salon_name, salon_address");

        const salonsMap = {};
        if (!salonsError && salons) {
            salons.forEach(s => {
                salonsMap[s.id] = s;
            });
        }

        // Fetch reviewed appointment IDs
        const { data: reviews } = await client
            .from("salon_reviews")
            .select("appointment_id")
            .eq("customer_email", userEmail);

        const reviewedIds = new Set((reviews || []).map(r => r.appointment_id));

        const now = new Date();
        const mapped = appointments.map(a => {
            const timeStr = a.appointment_time && a.appointment_time !== 'N/A' ? a.appointment_time : '00:00';
            const apptDate = new Date(`${a.appointment_date}T${timeStr}`);
            const isPast = !isNaN(apptDate.getTime()) && apptDate.getTime() < now.getTime();
            const currentStatus = (a.booking_status || '').toLowerCase();
            const effectiveStatus = currentStatus === 'cancelled' 
                ? 'Cancelled' 
                : (isPast ? 'Completed' : (a.booking_status || 'Confirmed'));

            if (isPast && currentStatus !== 'cancelled' && currentStatus !== 'completed') {
                client.from('appointments').update({ booking_status: 'Completed' }).eq('id', a.id).then().catch(() => {});
            }

            return {
                ...a,
                booking_status: effectiveStatus,
                is_past: isPast,
                salon_name: salonsMap[a.salon_id]?.salon_name || "Premium Salon",
                salon_address: salonsMap[a.salon_id]?.salon_address || "",
                isReviewed: reviewedIds.has(a.id)
            };
        });

        return res.status(200).json({ success: true, appointments: mapped });
    } catch (err) {
        console.error("Error fetching customer appointments:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};