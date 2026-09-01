import supabase, { supabaseAdmin } from "../config/supabase.js";
import { awardAppointmentPointsHelper } from "../controllers/loyaltyController.js";

// Helper to check Supabase config
const isSupabaseConfigured = () => {
    const url = process.env.SUPABASE_URL || '';
    return url && url !== 'https://placeholder.supabase.co' && url.includes('.supabase.co');
};

// 1. Get Salon Profile Details
export const getSalonProfile = async (req, res) => {
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

// 2. Update Salon Profile Details
export const updateSalonProfile = async (req, res) => {
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

// 3. Get Salon Appointments / Booking Schedule for Dashboard
export const getSalonAppointments = async (req, res) => {
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

        // Fetch late arrival notifications and reschedules for this salon
        let lateAlertsMap = {};
        try {
            const { getSalonLateNotifications } = await import("../Appointments and notification/controllers/appointmentController.js");
            const lateAlerts = getSalonLateNotifications(ownerId);
            lateAlerts.forEach(alert => {
                lateAlertsMap[alert.appointment_id] = alert;
            });
        } catch (alertErr) {
            console.warn("Could not load late alerts:", alertErr.message);
        }

        const reschedulesMap = {};
        try {
            const { default: loyaltyDb } = await import("../database/loyaltyDb.js");
            // Group and sum all reschedule fees for each appointment
            const reschedules = loyaltyDb.prepare(`
                SELECT appointment_id, 
                       MAX(created_at) as latest_reschedule, 
                       previous_date, 
                       previous_time, 
                       new_date, 
                       new_time, 
                       COUNT(*) as total_reschedules, 
                       SUM(fee_charged) as total_fee_charged
                FROM appointment_reschedules 
                GROUP BY appointment_id
            `).all();

            (reschedules || []).forEach(r => {
                reschedulesMap[r.appointment_id] = {
                    ...r,
                    fee_charged: Number(r.total_fee_charged) || 0
                };
            });
        } catch (dbErr) {
            console.warn("Could not load reschedule info for salon owner dashboard:", dbErr.message);
        }

        // Fetch services map for pricing
        const { data: ownerServices } = await client
            .from("salon_owner_services")
            .select("name, price")
            .eq("owner_id", ownerId);

        const servicePriceMap = {};
        (ownerServices || []).forEach(s => {
            if (s.name) servicePriceMap[s.name.toLowerCase().trim()] = Number(s.price) || 0;
        });

        const appointmentsWithClients = await Promise.all(data.map(async (apt) => {
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

            const lateInfo = lateAlertsMap[apt.id] || null;
            const rescheduleInfo = reschedulesMap[apt.id] || null;
            const baseServicePrice = servicePriceMap[(apt.service_name || '').toLowerCase().trim()] || 0;
            const rescheduleFee = rescheduleInfo ? (Number(rescheduleInfo.fee_charged) || 0) : 0;
            const totalPrice = baseServicePrice + rescheduleFee;

            return {
                id: apt.id,
                client_name: apt.customer_name || "Guest Client",
                client_email: apt.customer_email || "N/A",
                client_phone: phone,
                service: apt.service_name || "Salon Service",
                stylist: "Any Stylist",
                date: apt.appointment_date,
                time: apt.appointment_time || "N/A",
                base_price: baseServicePrice,
                reschedule_fee: rescheduleFee,
                price: String(totalPrice),
                status: apt.booking_status || "Confirmed",
                created_at: apt.created_at,
                late_notification: lateInfo,
                reschedule_info: rescheduleInfo,
                is_rescheduled: !!rescheduleInfo
            };
        }));

        return res.status(200).json({ success: true, appointments: appointmentsWithClients });
    } catch (err) {
        console.error("Error fetching appointments:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 4. Update Appointment Status from Dashboard
export const updateSalonAppointmentStatus = async (req, res) => {
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

        // Reward logic trigger: Once the salon owner completes the appointment
        if (status === 'Completed' && data) {
            try {
                let customerData = null;

                // 1. Try finding in users table
                const { data: userData } = await client
                    .from("users")
                    .select("id, full_name, email")
                    .eq("email", data.customer_email)
                    .maybeSingle();

                if (userData) {
                    customerData = { id: userData.id, full_name: userData.full_name, email: userData.email };
                } else {
                    // Fallback to customer_name / customer_email directly from appointment
                    customerData = {
                        id: data.customer_email, // identifier fallback
                        full_name: data.customer_name || 'Customer',
                        email: data.customer_email
                    };
                }

                if (customerData) {
                    const { data: serviceData } = await client
                        .from("salon_owner_services")
                        .select("price")
                        .eq("owner_id", data.salon_id)
                        .eq("name", data.service_name)
                        .maybeSingle();

                    const price = serviceData ? Number(serviceData.price) : 0;

                    // Point distribution rule:
                    // Base: 500 Style Points
                    // >= Rs. 2,500: 5,000 Style Points
                    // >= Rs. 5,000: 10,000 Style Points
                    let earnedPoints = 500;
                    if (price >= 5000) earnedPoints = 10000;
                    else if (price >= 2500) earnedPoints = 5000;
                    else earnedPoints = 500;

                    const rewardRes = awardAppointmentPointsHelper(customerData, earnedPoints, data.id);
                    console.log(`[Loyalty System] Awarded ${earnedPoints} Style Points to ${customerData.email} for appointment ${data.id}:`, rewardRes);
                }
            } catch (pointErr) {
                console.error("Could not award points on completion:", pointErr.message);
            }
        }

        return res.status(200).json({ success: true, message: `Appointment marked as ${status} successfully.`, appointment: data });
    } catch (err) {
        console.error("Error updating appointment status:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};
