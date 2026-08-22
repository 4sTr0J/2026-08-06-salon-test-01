import supabase, { supabaseAdmin } from '../config/supabase.js';

const db = supabaseAdmin || supabase;

/**
 * Cancels an appointment and calculates the refund based on the salon's active cancellation policy.
 */
export const cancelAppointment = async (appointmentId, customerEmail) => {
    // 1. Fetch the appointment
    const { data: appointment, error: apptError } = await db
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

    if (apptError || !appointment) {
        throw new Error('Appointment not found');
    }

    if (appointment.customer_email !== customerEmail) {
        throw new Error('Unauthorized to cancel this appointment');
    }

    if (appointment.booking_status === 'Cancelled') {
        throw new Error('Appointment is already cancelled');
    }

    // 2. Fetch the active cancellation policy for the salon
    const { data: policy, error: policyError } = await db
        .from('cancellation_policies')
        .select('*')
        .eq('salon_id', appointment.salon_id)
        .eq('is_active', true)
        .maybeSingle();

    // 3. Calculate hours until appointment
    const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
    const now = new Date();
    const msDifference = appointmentDateTime.getTime() - now.getTime();
    const hoursDifference = msDifference / (1000 * 60 * 60);

    // Default policy if none found: 0 hours window, 100% refund (i.e., very flexible)
    const windowHours = policy ? policy.cancellation_window_hours : 0;
    const maxRefund = policy ? policy.refund_percentage : 100;

    // 4. Determine actual refund percentage
    let actualRefundPercentage = 0;
    if (hoursDifference >= windowHours) {
        // Cancelled outside the penalty window
        actualRefundPercentage = maxRefund;
    } else {
        // Cancelled inside the penalty window (too close to appointment)
        actualRefundPercentage = 0;
    }

    // 5. Update the appointment status
    const { data: updatedAppointment, error: updateError } = await db
        .from('appointments')
        .update({
            booking_status: 'Cancelled',
            // Ideally we'd store refund info, but we'll return it for the frontend to show
            // If the table had a notes column we could append it there.
        })
        .eq('id', appointmentId)
        .select()
        .single();

    if (updateError) {
        throw new Error('Failed to update appointment status');
    }

    return {
        appointment: updatedAppointment,
        refundPercentage: actualRefundPercentage,
        hoursUntilAppointment: Math.max(0, hoursDifference).toFixed(1),
        policyApplied: policy ? policy.policy_type : 'default_flexible',
    };
};
