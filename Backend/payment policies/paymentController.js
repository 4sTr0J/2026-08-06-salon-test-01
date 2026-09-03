import supabase, { supabaseAdmin } from "../config/supabase.js";
import crypto from "crypto";

// Check if Supabase is configured
const isSupabaseConfigured = () => {
    const url = process.env.SUPABASE_URL || '';
    return url && url !== 'https://placeholder.supabase.co' && url.includes('.supabase.co');
};

/**
 * Creates and records a payment for an appointment.
 * Automatically splits payment: 10% platform commission, 90% salon earnings.
 */
export const createPayment = async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    try {
        const client = supabaseAdmin || supabase;
        const userEmail = req.user?.email;
        const { appointmentId, salonId, grossAmount, pointsDiscount = 0, cardLast4, paymentMethod = 'CARD' } = req.body;

        if (!appointmentId || !salonId || grossAmount === undefined) {
            return res.status(400).json({ success: false, message: "appointmentId, salonId, and grossAmount are required." });
        }

        const netAmount = Math.max(0, parseFloat(grossAmount) - parseFloat(pointsDiscount));
        const platformCommissionPct = 10.00; // 10% Platform fee for Admin income
        const platformCommissionAmt = parseFloat((netAmount * (platformCommissionPct / 100)).toFixed(2));
        const salonEarnings = parseFloat((netAmount - platformCommissionAmt).toFixed(2));

        // 1. Verify Appointment & Ownership
        const { data: appointment, error: apptError } = await client
            .from("appointments")
            .select("*")
            .eq("id", appointmentId)
            .single();

        if (apptError || !appointment) {
            return res.status(404).json({ success: false, message: "Appointment not found." });
        }

        if (userEmail && appointment.customer_email && appointment.customer_email.toLowerCase() !== userEmail.toLowerCase()) {
            return res.status(403).json({ success: false, message: "Not authorized to pay for this appointment." });
        }

        const { default: loyaltyDb } = await import("../database/loyaltyDb.js");

        // Check if payment already exists
        const existing = loyaltyDb.prepare("SELECT * FROM payments WHERE appointment_id = ?").get(appointmentId);
        if (existing) {
            return res.status(200).json({
                success: true,
                message: "Payment already recorded for this appointment.",
                payment: existing,
                appointment
            });
        }

        const paymentId = crypto.randomUUID();

        // 2. Insert Payment Record
        loyaltyDb.prepare(`
            INSERT INTO payments (
                id, appointment_id, customer_email, salon_id, gross_amount, 
                points_discount, net_amount, platform_commission_pct, 
                platform_commission_amt, salon_earnings, payment_status, 
                card_last4, payment_method
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            paymentId, appointmentId, userEmail || appointment.customer_email || 'guest@example.com', salonId,
            parseFloat(grossAmount), parseFloat(pointsDiscount), netAmount, platformCommissionPct,
            platformCommissionAmt, salonEarnings, 'Completed', cardLast4 || 'CASH', paymentMethod
        );

        // 3. Insert Salon Earnings Ledger (Credit 90%)
        const earnId = crypto.randomUUID();
        loyaltyDb.prepare(`
            INSERT INTO salon_earnings (
                id, salon_id, payment_id, appointment_id, transaction_type, amount, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            earnId, salonId, paymentId, appointmentId, 'CREDIT',
            salonEarnings, `Payment collected for appt ${appointmentId.substring(0, 8)}`
        );

        // 4. Insert Platform Revenue Ledger (Credit 10% Admin Income)
        const revId = crypto.randomUUID();
        loyaltyDb.prepare(`
            INSERT INTO platform_revenue (
                id, salon_id, payment_id, appointment_id, transaction_type, amount, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            revId, salonId, paymentId, appointmentId, 'CREDIT',
            platformCommissionAmt, `Platform commission (10%) on appt ${appointmentId.substring(0, 8)}`
        );

        // 5. Update Appointment Status to Confirmed
        const { data: updatedAppt, error: updateError } = await client
            .from("appointments")
            .update({ booking_status: "Confirmed", updated_at: new Date().toISOString() })
            .eq("id", appointmentId)
            .select()
            .single();

        if (updateError) {
            console.warn("Could not update booking status in Supabase:", updateError.message);
        }

        const payment = loyaltyDb.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId);

        return res.status(201).json({
            success: true,
            message: "Payment processed successfully.",
            payment,
            appointment: updatedAppt || appointment
        });

    } catch (err) {
        console.error("Error creating payment:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Get payment details by appointment ID
 */
export const getPaymentByAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const userEmail = req.user?.email;

        const { default: loyaltyDb } = await import("../database/loyaltyDb.js");
        const payment = loyaltyDb.prepare("SELECT * FROM payments WHERE appointment_id = ?").get(appointmentId);

        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment not found." });
        }

        if (userEmail && payment.customer_email.toLowerCase() !== userEmail.toLowerCase() && req.user?.role !== 'admin' && req.user?.role !== 'owner') {
            return res.status(403).json({ success: false, message: "Not authorized to view this payment." });
        }

        return res.status(200).json({ success: true, payment });

    } catch (err) {
        console.error("Error fetching payment:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};
