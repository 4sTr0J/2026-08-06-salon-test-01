import supabase, { supabaseAdmin } from "../database/supabase.js";

// Check if Supabase is configured
const isSupabaseConfigured = () => {
    const url = process.env.SUPABASE_URL || '';
    return url && url !== 'https://placeholder.supabase.co' && url.includes('.supabase.co');
};

// Admin Login Authentication Endpoint
export const adminLogin = async (req, res) => {
    const { email, password } = req.body;
    const configuredPassword = (process.env.ADMIN_PASSWORD || 'admin123').trim();
    const configuredEmail = (process.env.ADMIN_EMAIL || 'annyafernando915@gmail.com').trim().toLowerCase();

    const inputEmail = (email || '').trim().toLowerCase();
    const inputPassword = (password || '').trim();

    if (inputEmail === configuredEmail && inputPassword === configuredPassword) {
        // Return admin session token
        return res.status(200).json({
            success: true,
            token: process.env.ADMIN_SECRET_TOKEN || 'stylepulse_admin_secret_token_secure_99',
            message: "Super Admin authenticated successfully."
        });
    }

    return res.status(401).json({
        success: false,
        message: "Invalid Admin credentials. Access denied."
    });
};

// Admin Authentication Middleware
export const verifyAdminSecret = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const configuredSecret = process.env.ADMIN_SECRET_TOKEN || 'stylepulse_admin_secret_token_secure_99';

    if (!authHeader || (!authHeader.includes(configuredSecret) && !authHeader.includes('Bearer ' + configuredSecret))) {
        return res.status(403).json({
            success: false,
            message: "Unauthorized: Super Admin credentials required."
        });
    }
    next();
};

export const getPendingOwners = async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    try {
        const client = supabaseAdmin || supabase;
        const { data, error } = await client
            .from("salon_owners")
            .select("id, full_name, email, phone, salon_name, salon_reg_id, salon_address, salon_website, is_approved, created_at");

        if (error) throw error;

        // Map columns to match frontend expectations
        const mappedOwners = data.map(o => ({
            id: o.id,
            full_name: o.full_name,
            email: o.email,
            phone: o.phone,
            is_approved: o.is_approved,
            created_at: o.created_at,
            salon_name: o.salon_name,
            salon_reg_id: o.salon_reg_id,
            salon_address: o.salon_address,
            salon_website: o.salon_website
        }));

        return res.status(200).json({ success: true, owners: mappedOwners });
    } catch (err) {
        console.error("Error fetching owners:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const approveOwner = async (req, res) => {
    const { id } = req.params;

    if (!isSupabaseConfigured()) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    if (!supabaseAdmin) {
        return res.status(403).json({ success: false, message: "Server is missing Admin Key to approve users." });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from("salon_owners")
            .update({ is_approved: true })
            .eq("id", id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({ success: false, message: "Owner registration not found." });
        }

        return res.status(200).json({ success: true, message: "Owner approved successfully.", user: data[0] });
    } catch (err) {
        console.error("Error approving owner:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const deleteOwner = async (req, res) => {
    const { id } = req.params;

    if (!isSupabaseConfigured()) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    if (!supabaseAdmin) {
        return res.status(403).json({ success: false, message: "Server is missing Admin Key to delete users." });
    }

    try {
        const { error: dbError } = await supabaseAdmin
            .from("salon_owners")
            .delete()
            .eq("id", id);

        if (dbError) throw dbError;

        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
        
        if (authError && !authError.message.includes("User not found")) {
            console.warn("Auth user deletion warning:", authError.message);
        }

        return res.status(200).json({ success: true, message: "Salon owner removed successfully." });
    } catch (err) {
        console.error("Error deleting owner:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};
