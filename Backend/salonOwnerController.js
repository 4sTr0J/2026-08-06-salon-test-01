import supabase, { supabaseAdmin } from "./config/supabase.js";

// Helper to check Supabase config
const isSupabaseConfigured = () => {
    const url = process.env.SUPABASE_URL || '';
    return url && url !== 'https://placeholder.supabase.co' && url.includes('.supabase.co');
};

// 1. Get Salon Details
export const getSalonDetails = async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    try {
        const client = supabaseAdmin || supabase;
        const ownerId = req.user.id;

        const { data, error } = await client
            .from("salon_owners")
            .select("salon_name, salon_reg_id, salon_address, salon_website, full_name, email, phone")
            .eq("id", ownerId)
            .single();

        if (error) throw error;

        return res.status(200).json({ success: true, salon: data });
    } catch (err) {
        console.error("Error fetching salon details:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 2. Update Salon Details
export const updateSalonDetails = async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    try {
        const client = supabaseAdmin || supabase;
        const ownerId = req.user.id;
        const { salonName, salonAddress, salonWebsite, salonRegId } = req.body;

        const { data, error } = await client
            .from("salon_owners")
            .update({
                salon_name: salonName,
                salon_address: salonAddress,
                salon_website: salonWebsite,
                salon_reg_id: salonRegId,
                updated_at: new Date().toISOString()
            })
            .eq("id", ownerId)
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json({ success: true, message: "Salon details updated successfully.", salon: data });
    } catch (err) {
        console.error("Error updating salon details:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 3. Get Services
export const getServices = async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    try {
        const client = supabaseAdmin || supabase;
        const ownerId = req.user.id;

        const { data, error } = await client
            .from("salon_owner_services")
            .select("*")
            .eq("owner_id", ownerId)
            .order("created_at", { ascending: false });

        if (error) throw error;

        return res.status(200).json({ success: true, services: data });
    } catch (err) {
        console.error("Error fetching services:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 4. Add Service
export const addService = async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    try {
        const client = supabaseAdmin || supabase;
        const ownerId = req.user.id;
        const { name, price, duration } = req.body;

        if (!name || !price || !duration) {
            return res.status(400).json({ success: false, message: "Name, price, and duration are required." });
        }

        const { data, error } = await client
            .from("salon_owner_services")
            .insert({
                owner_id: ownerId,
                name,
                price: parseFloat(price),
                duration: parseInt(duration),
                category: "General"
            })
            .select()
            .single();

        if (error) throw error;

        return res.status(201).json({ success: true, message: "Service added successfully.", service: data });
    } catch (err) {
        console.error("Error adding service:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 5. Delete Service
export const deleteService = async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    try {
        const client = supabaseAdmin || supabase;
        const ownerId = req.user.id;
        const { id } = req.params;

        const { error } = await client
            .from("salon_owner_services")
            .delete()
            .eq("id", id)
            .eq("owner_id", ownerId);

        if (error) throw error;

        return res.status(200).json({ success: true, message: "Service deleted successfully." });
    } catch (err) {
        console.error("Error deleting service:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 6. Get Appointments
export const getAppointments = async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    try {
        const client = supabaseAdmin || supabase;
        const ownerId = req.user.id;

        const { data, error } = await client
            .from("appointments")
            .select(`
                id,
                service,
                stylist,
                date,
                time,
                price,
                status,
                created_at,
                user_id
            `)
            .eq("salon_id", ownerId)
            .order("date", { ascending: true });

        if (error) throw error;

        const appointmentsWithClients = await Promise.all(data.map(async (apt) => {
            const { data: userData } = await client
                .from("users")
                .select("full_name, email, phone")
                .eq("id", apt.user_id)
                .maybeSingle();

            return {
                ...apt,
                client_name: userData?.full_name || "Guest Client",
                client_email: userData?.email || "N/A",
                client_phone: userData?.phone || "N/A"
            };
        }));

        return res.status(200).json({ success: true, appointments: appointmentsWithClients });
    } catch (err) {
        console.error("Error fetching appointments:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};
