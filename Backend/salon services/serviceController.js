import supabase, { supabaseAdmin } from "../config/supabase.js";

// Helper to check Supabase config
const isSupabaseConfigured = () => {
    const url = process.env.SUPABASE_URL || '';
    return url && url !== 'https://placeholder.supabase.co' && url.includes('.supabase.co');
};

// 1. Get All Approved Salons (with reviews, ratings, and attached services)
export const getApprovedSalons = async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    try {
        const client = supabaseAdmin || supabase;
        let response = await client
            .from("salon_owners")
            .select("id, salon_name, salon_address, salon_website, salon_image, full_name, email");

        if (response.error && response.error.code === "42703") {
            console.log("Fallback: salon_image column not found in DB. Querying without it.");
            response = await client
                .from("salon_owners")
                .select("id, salon_name, salon_address, salon_website, full_name, email");
        }

        if (response.error) throw response.error;

        // Fetch appointments to count completed bookings per salon
        const { data: allAppointments } = await client
            .from('appointments')
            .select('salon_id, booking_status');

        const bookingCountMap = {};
        (allAppointments || []).forEach(a => {
            if (a.salon_id) {
                if (!bookingCountMap[a.salon_id]) bookingCountMap[a.salon_id] = { total: 0, completed: 0 };
                bookingCountMap[a.salon_id].total++;
                if (a.booking_status === 'Completed') bookingCountMap[a.salon_id].completed++;
            }
        });

        const salonsWithData = await Promise.all(response.data.map(async (salon) => {
            try {
                // Fetch reviews
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

                // Fetch services
                const { data: services, error: sError } = await client
                    .from('salon_owner_services')
                    .select('*')
                    .eq('owner_id', salon.id);

                salon.services = (!sError && services) ? services : [];

                // Attach completed appointments count
                salon.completedOrders = (bookingCountMap[salon.id] && bookingCountMap[salon.id].completed) || 0;
                salon.totalBookings = (bookingCountMap[salon.id] && bookingCountMap[salon.id].total) || 0;

                // ── Multi-Factor Bayesian Quality & Authority Score ──
                // Parameters:
                const R = salon.averageRating || 0;
                const v = salon.reviewCount || 0;
                const m = 3.0; // Minimum reviews threshold constant
                const C = 3.5; // Baseline platform-wide rating
                const bayesianRating = v > 0 ? ((v / (v + m)) * R + (m / (v + m)) * C) : C;

                const completed = salon.completedOrders;
                const volumeBonus = 2.5 * Math.log(1 + completed); // Logarithmic volume scaling
                const sentimentBoost = 1.2 * (salon.averageSentiment || 0);
                const catalogBonus = Math.min((salon.services.length * 0.2), 1.0);

                salon.qualityScore = parseFloat((bayesianRating + volumeBonus + sentimentBoost + catalogBonus).toFixed(3));
            } catch (err) {
                salon.averageRating = 0.0;
                salon.averageSentiment = 0.0;
                salon.reviewCount = 0;
                salon.services = [];
                salon.completedOrders = 0;
                salon.totalBookings = 0;
                salon.qualityScore = 0.0;
            }
            return salon;
        }));

        // Default sort by Multi-Factor Bayesian Authority Score
        salonsWithData.sort((a, b) => b.qualityScore - a.qualityScore);

        return res.status(200).json({ success: true, salons: salonsWithData });
    } catch (err) {
        console.error("Error fetching approved salons:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 2. Get Services by Specific Salon ID (Public / Customer exploration)
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

// 3. Get Services for Current Authenticated Salon Owner
export const getOwnerServices = async (req, res) => {
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

// 4. Add New Service (Salon Owner)
export const addSalonService = async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    try {
        const client = supabaseAdmin || supabase;
        const ownerId = req.user.id;
        const { name, price, duration, category } = req.body;

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
                category: category || "General"
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

// 5. Delete Service (Salon Owner)
export const deleteSalonService = async (req, res) => {
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
