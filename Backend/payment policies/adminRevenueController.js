/**
 * Admin Income & Platform Revenue Controller
 * Summarizes customer payments, 10% platform commission, and 90% salon payouts to release.
 */
export const getPlatformRevenueSummary = async (req, res) => {
    try {
        const { default: loyaltyDb } = await import("../database/loyaltyDb.js");
        const data = loyaltyDb.prepare("SELECT * FROM platform_revenue ORDER BY created_at DESC").all() || [];
        const payments = loyaltyDb.prepare("SELECT * FROM payments").all() || [];

        let totalCustomerPaid = 0;
        let totalSalonPayout = 0;
        let totalPendingPayout = 0;
        let totalReleasedPayout = 0;

        payments.forEach(p => {
            if (p.payment_status === 'Completed') {
                totalCustomerPaid += parseFloat(p.net_amount || p.gross_amount || 0);
                const earnings = parseFloat(p.salon_earnings || 0);
                totalSalonPayout += earnings;
                if (p.payout_status === 'Released') {
                    totalReleasedPayout += earnings;
                } else {
                    totalPendingPayout += earnings;
                }
            }
        });

        let totalCredits = 0;
        let totalDebits = 0;

        data.forEach(r => {
            const amt = parseFloat(r.amount) || 0;
            if (r.transaction_type === 'CREDIT') totalCredits += amt;
            if (r.transaction_type === 'DEBIT') totalDebits += amt;
        });

        const netRevenue = parseFloat((totalCredits - totalDebits).toFixed(2));

        return res.status(200).json({
            success: true,
            totalCustomerPaid: parseFloat(totalCustomerPaid.toFixed(2)),
            totalSalonPayout: parseFloat(totalSalonPayout.toFixed(2)),
            totalPendingPayout: parseFloat(totalPendingPayout.toFixed(2)),
            totalReleasedPayout: parseFloat(totalReleasedPayout.toFixed(2)),
            totalCredits: parseFloat(totalCredits.toFixed(2)),
            totalDebits: parseFloat(totalDebits.toFixed(2)),
            netRevenue,
            transactions: data
        });
    } catch (err) {
        console.error("Error fetching platform revenue summary:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Lists the latest marketplace payments enriched with customer and appointment details.
 */
export const getRecentPayments = async (req, res) => {
    try {
        const { default: loyaltyDb } = await import("../database/loyaltyDb.js");
        const payments = loyaltyDb.prepare("SELECT * FROM payments ORDER BY created_at DESC LIMIT 50").all() || [];

        // Enrich with appointment and salon details from Supabase
        const apptIds = payments.map(p => p.appointment_id).filter(Boolean);
        let apptMap = {};
        let salonMap = {};

        if (apptIds.length > 0) {
            try {
                const { default: supabase, supabaseAdmin } = await import("../config/supabase.js");
                const client = supabaseAdmin || supabase;

                const { data: appts } = await client
                    .from('appointments')
                    .select('id, customer_name, customer_email, service_name, appointment_date, appointment_time, booking_status, salon_id')
                    .in('id', apptIds);

                if (appts) {
                    const salonIds = [...new Set(appts.map(a => a.salon_id).filter(Boolean))];
                    if (salonIds.length > 0) {
                        const { data: salons } = await client
                            .from('salon_owners')
                            .select('id, salon_name')
                            .in('id', salonIds);
                        (salons || []).forEach(s => {
                            salonMap[s.id] = s.salon_name;
                        });
                    }

                    appts.forEach(a => {
                        apptMap[a.id] = {
                            ...a,
                            salon_name: salonMap[a.salon_id] || 'Salon'
                        };
                    });
                }
            } catch (err) {
                console.warn("Could not enrich payments with Supabase appointments:", err.message);
            }
        }

        const enrichedPayments = payments.map(p => {
            const appt = apptMap[p.appointment_id] || {};
            let custName = appt.customer_name;
            if (!custName && p.customer_email) {
                const prefix = p.customer_email.split('@')[0];
                custName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
            }
            return {
                ...p,
                customer_name: custName || 'Customer',
                customer_email: appt.customer_email || p.customer_email,
                service_name: appt.service_name || 'Salon Service',
                salon_name: appt.salon_name || salonMap[p.salon_id] || 'Salon',
                appointment_date: appt.appointment_date,
                appointment_time: appt.appointment_time,
                booking_status: appt.booking_status || p.payment_status
            };
        });

        return res.status(200).json({ success: true, payments: enrichedPayments });
    } catch (err) {
        console.error("Error fetching recent payments:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Releases the payout for an appointment to the salon owner once the service is completed.
 */
export const releaseSalonPayout = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { default: loyaltyDb } = await import("../database/loyaltyDb.js");

        const payment = loyaltyDb.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId);
        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment record not found." });
        }

        loyaltyDb.prepare("UPDATE payments SET payout_status = 'Released' WHERE id = ?").run(paymentId);

        return res.status(200).json({
            success: true,
            message: `Payout of Rs. ${parseFloat(payment.salon_earnings).toLocaleString(undefined, { minimumFractionDigits: 2 })} released to Salon.`,
            paymentId
        });
    } catch (err) {
        console.error("Error releasing salon payout:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Lists all customer cancellation refunds with bank transfer details.
 */
export const getRefundRequests = async (req, res) => {
    try {
        const { default: loyaltyDb } = await import("../database/loyaltyDb.js");
        const refunds = loyaltyDb.prepare("SELECT * FROM cancellation_refunds ORDER BY created_at DESC LIMIT 50").all() || [];
        return res.status(200).json({ success: true, refunds });
    } catch (err) {
        console.error("Error fetching refund requests:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Settles a customer bank refund and records the bank reference.
 */
export const markRefundCompleted = async (req, res) => {
    try {
        const { refundId } = req.params;
        const { referenceId } = req.body || {};
        const { default: loyaltyDb } = await import("../database/loyaltyDb.js");

        try {
            loyaltyDb.exec("ALTER TABLE cancellation_refunds ADD COLUMN reference_id TEXT;");
        } catch (e) {}
        try {
            loyaltyDb.exec("ALTER TABLE cancellation_refunds ADD COLUMN settled_at DATETIME;");
        } catch (e) {}

        loyaltyDb.prepare(`
            UPDATE cancellation_refunds 
            SET status = 'Settled', 
                reference_id = ?, 
                settled_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(referenceId || 'BANK_TRANSFER', refundId);

        return res.status(200).json({ 
            success: true, 
            message: "Refund settled successfully! Bank transfer recorded." 
        });
    } catch (err) {
        console.error("Error settling refund:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};
