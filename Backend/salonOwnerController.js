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

        let response = await client
            .from("salon_owners")
            .select("salon_name, salon_reg_id, salon_address, salon_website, salon_image, full_name, email, phone, operating_start, operating_end")
            .eq("id", ownerId)
            .single();

        // Fallback if operating_start or operating_end or salon_image columns do not exist
        if (response.error && response.error.code === "42703") {
            console.log("Fallback: some operating_start/end or salon_image columns not found in DB. Querying without them.");
            response = await client
                .from("salon_owners")
                .select("salon_name, salon_reg_id, salon_address, salon_website, full_name, email, phone")
                .eq("id", ownerId)
                .single();
            
            if (!response.error && response.data) {
                response.data.operating_start = '09:00';
                response.data.operating_end = '18:30';
            }
        }

        if (response.error) throw response.error;

        return res.status(200).json({ success: true, salon: response.data });
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
        const { salonName, salonAddress, salonWebsite, salonRegId, salonImage, operatingStart, operatingEnd } = req.body;

        let updatePayload = {
            salon_name: salonName,
            salon_address: salonAddress,
            salon_website: salonWebsite,
            salon_reg_id: salonRegId,
            salon_image: salonImage,
            operating_start: operatingStart || '09:00',
            operating_end: operatingEnd || '18:30',
            updated_at: new Date().toISOString()
        };

        let { data, error } = await client
            .from("salon_owners")
            .update(updatePayload)
            .eq("id", ownerId)
            .select()
            .single();

        // Fallback if operating_start / operating_end columns do not exist
        if (error && error.code === "42703") {
            console.log("Fallback: operating columns not found on update. Retrying without them.");
            delete updatePayload.operating_start;
            delete updatePayload.operating_end;
            
            const retryRes = await client
                .from("salon_owners")
                .update(updatePayload)
                .eq("id", ownerId)
                .select()
                .single();
            
            data = retryRes.data;
            error = retryRes.error;
        }

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
                customer_name,
                customer_email,
                service_name,
                appointment_date,
                appointment_time,
                booking_status,
                created_at
            `)
            .eq("salon_id", ownerId)
            .order("appointment_date", { ascending: true });

        if (error) throw error;

        const appointmentsWithClients = await Promise.all(data.map(async (apt) => {
            // Attempt to look up additional user details like phone number from email
            let phone = "N/A";
            if (apt.customer_email) {
                const { data: userData } = await client
                    .from("users")
                    .select("phone")
                    .eq("email", apt.customer_email)
                    .maybeSingle();
                if (userData?.phone) {
                    phone = userData.phone;
                }
            }

            return {
                id: apt.id,
                client_name: apt.customer_name || "Guest Client",
                client_email: apt.customer_email || "N/A",
                client_phone: phone,
                service: apt.service_name || "Salon Service",
                stylist: "Any Stylist",
                date: apt.appointment_date,
                time: apt.appointment_time || "N/A",
                price: "0", // Fallback placeholder
                status: apt.booking_status || "Confirmed",
                created_at: apt.created_at
            };
        }));

        return res.status(200).json({ success: true, appointments: appointmentsWithClients });
    } catch (err) {
        console.error("Error fetching appointments:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 7. Update Appointment Status
export const updateAppointmentStatus = async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    try {
        const client = supabaseAdmin || supabase;
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, message: "Status is required." });
        }

        const { data, error } = await client
            .from("appointments")
            .update({ booking_status: status, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json({ success: true, message: `Appointment marked as ${status} successfully.`, appointment: data });
    } catch (err) {
        console.error("Error updating appointment status:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

