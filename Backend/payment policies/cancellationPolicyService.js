import supabase, { supabaseAdmin } from '../config/supabase.js';
import crypto from 'crypto';

const db = supabaseAdmin || supabase;

/**
 * Previews the cancellation refund eligibility and amount for an appointment.
 */
export const previewCancellationRefund = async (appointmentId, customerEmail) => {
    const { data: appointment, error: apptError } = await db
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

    if (apptError || !appointment) {
        throw new Error('Appointment not found');
    }

    if (customerEmail && appointment.customer_email && appointment.customer_email.toLowerCase() !== customerEmail.toLowerCase()) {
        throw new Error('Unauthorized to access this appointment');
    }

    const { default: loyaltyDb } = await import("../database/loyaltyDb.js");
    let policy = null;
    try {
        policy = loyaltyDb.prepare("SELECT * FROM cancellation_policies WHERE salon_id = ? AND is_active = 1 LIMIT 1").get(appointment.salon_id);
    } catch (e) {}

    const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
    const now = new Date();
    const msDifference = appointmentDateTime.getTime() - now.getTime();
    const hoursDifference = msDifference / (1000 * 60 * 60);

    const windowHours = policy ? policy.cancellation_window_hours : 24;
    const maxRefund = policy ? policy.refund_percentage : 100;

    let actualRefundPercentage = 0;
    if (hoursDifference >= windowHours) {
        actualRefundPercentage = maxRefund;
    } else {
        actualRefundPercentage = Math.max(0, maxRefund - 50);
    }

    // Look up original payment
    let netPaid = 0;
    try {
        const payment = loyaltyDb.prepare("SELECT * FROM payments WHERE appointment_id = ?").get(appointmentId);
        if (payment) {
            netPaid = parseFloat(payment.net_amount || payment.gross_amount || 0);
        }
    } catch (e) {}

    const refundAmount = parseFloat((netPaid * (actualRefundPercentage / 100)).toFixed(2));

    return {
        appointmentId: appointment.id,
        serviceName: appointment.service_name,
        appointmentDate: appointment.appointment_date,
        appointmentTime: appointment.appointment_time,
        hoursUntilAppointment: Math.max(0, hoursDifference).toFixed(1),
        netPaid,
        refundPercentage: actualRefundPercentage,
        refundAmount,
        isEligible: actualRefundPercentage > 0,
        policyApplied: policy ? policy.policy_type : 'standard_24h_window',
        policyDescription: actualRefundPercentage === 100
            ? 'Eligible for 100% full refund (cancelled 24+ hours in advance).'
            : actualRefundPercentage > 0
                ? `Eligible for partial ${actualRefundPercentage}% refund (late cancellation within 24h window).`
                : 'Not eligible for monetary refund (within late cancellation window).'
    };
};

/**
 * Cancels an appointment and calculates the refund based on the salon's active cancellation policy.
 * Also handles automated financial ledger debits and stores bank refund details if eligible.
 */
export const cancelAppointmentWithPolicy = async (appointmentId, customerEmail, bankDetails = null) => {
    // 1. Fetch the appointment
    const { data: appointment, error: apptError } = await db
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

    if (apptError || !appointment) {
        throw new Error('Appointment not found');
    }

    if (customerEmail && appointment.customer_email && appointment.customer_email.toLowerCase() !== customerEmail.toLowerCase()) {
        throw new Error('Unauthorized to cancel this appointment');
    }

    if (appointment.booking_status === 'Cancelled') {
        throw new Error('Appointment is already cancelled');
    }

    // 2. Fetch the active cancellation policy for the salon
    const { default: loyaltyDb } = await import("../database/loyaltyDb.js");
    let policy = null;
    try {
        policy = loyaltyDb.prepare("SELECT * FROM cancellation_policies WHERE salon_id = ? AND is_active = 1 LIMIT 1").get(appointment.salon_id);
    } catch (e) {}

    // 3. Calculate hours until appointment
    const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
    const now = new Date();
    const msDifference = appointmentDateTime.getTime() - now.getTime();
    const hoursDifference = msDifference / (1000 * 60 * 60);

    // Default policy: 24-hour window, 100% refund
    const windowHours = policy ? policy.cancellation_window_hours : 24;
    const maxRefund = policy ? policy.refund_percentage : 100;

    // 4. Calculate refund percentage
    let actualRefundPercentage = 0;
    if (hoursDifference >= windowHours) {
        actualRefundPercentage = maxRefund;
    } else {
        actualRefundPercentage = Math.max(0, maxRefund - 50);
    }

    let totalRefundToCustomer = 0;

    // 5. Update Financial Ledgers (Debit refund from Salon and Admin)
    try {
        const payment = loyaltyDb.prepare("SELECT * FROM payments WHERE appointment_id = ?").get(appointmentId);

        if (payment && (payment.payment_status === 'Completed' || payment.payment_status === 'Partial_Refund')) {
            const refundPct = actualRefundPercentage / 100;
            const refundAmountSalon = parseFloat((parseFloat(payment.salon_earnings) * refundPct).toFixed(2));
            const refundAmountPlatform = parseFloat((parseFloat(payment.platform_commission_amt) * refundPct).toFixed(2));
            totalRefundToCustomer = parseFloat((parseFloat(payment.net_amount) * refundPct).toFixed(2));

            if (totalRefundToCustomer > 0) {
                // Debit from salon earnings
                loyaltyDb.prepare(`
                    INSERT INTO salon_earnings (id, salon_id, payment_id, appointment_id, transaction_type, amount, description) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(
                    crypto.randomUUID(), appointment.salon_id, payment.id, appointment.id, 'DEBIT', refundAmountSalon,
                    `Refund (${actualRefundPercentage}%) for cancelled appt ${appointment.id.substring(0, 8)}`
                );

                // Debit from platform revenue (admin commission refund)
                loyaltyDb.prepare(`
                    INSERT INTO platform_revenue (id, salon_id, payment_id, appointment_id, transaction_type, amount, description) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(
                    crypto.randomUUID(), appointment.salon_id, payment.id, appointment.id, 'DEBIT', refundAmountPlatform,
                    `Commission refund (${actualRefundPercentage}%) on cancelled appt ${appointment.id.substring(0, 8)}`
                );

                // Update payment status
                const newStatus = actualRefundPercentage === 100 ? 'Refunded' : 'Partial_Refund';
                loyaltyDb.prepare("UPDATE payments SET payment_status = ? WHERE id = ?").run(newStatus, payment.id);

                // If customer provided bank details for their refund, store them for admin bank transfer
                if (bankDetails && bankDetails.accountNumber && bankDetails.bankName) {
                    loyaltyDb.prepare(`
                        INSERT INTO cancellation_refunds (
                            id, appointment_id, customer_email, salon_id,
                            refund_percentage, refund_amount, bank_name, branch_name,
                            account_number, account_holder_name, status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        crypto.randomUUID(), appointment.id, appointment.customer_email || customerEmail,
                        appointment.salon_id, actualRefundPercentage, totalRefundToCustomer,
                        bankDetails.bankName, bankDetails.branchName || '',
                        bankDetails.accountNumber, bankDetails.accountHolderName || appointment.customer_name || 'Customer',
                        'Pending_Bank_Transfer'
                    );
                    console.log(`[Refunds] Stored bank transfer details for appt ${appointment.id.substring(0, 8)}: Rs. ${totalRefundToCustomer} to ${bankDetails.bankName}`);
                }
            }
        }
    } catch (err) {
        console.error("Error processing cancellation refund financials:", err);
    }

    // 6. Update the appointment status in Supabase
    const { data: updatedAppointment, error: updateError } = await db
        .from('appointments')
        .update({
            booking_status: 'Cancelled',
            updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId)
        .select()
        .single();

    if (updateError) {
        console.warn("Supabase appointment status update warning:", updateError.message);
    }

    return {
        appointment: updatedAppointment || appointment,
        refundPercentage: actualRefundPercentage,
        refundAmount: totalRefundToCustomer,
        bankDetailsSubmitted: !!(bankDetails && bankDetails.accountNumber),
        hoursUntilAppointment: Math.max(0, hoursDifference).toFixed(1),
        policyApplied: policy ? policy.policy_type : 'default_standard_24h'
    };
};
