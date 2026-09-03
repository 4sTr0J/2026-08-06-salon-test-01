import { cancelAppointmentWithPolicy, previewCancellationRefund } from '../payment policies/cancellationPolicyService.js';

/**
 * Previews cancellation refund eligibility for an appointment.
 */
export const getCancelPreview = async (appointmentId, customerEmail) => {
    return await previewCancellationRefund(appointmentId, customerEmail);
};

/**
 * Cancels an appointment and calculates the refund based on the salon's active cancellation policy,
 * debiting the salon earnings and platform revenue ledgers, and saving customer bank details if eligible.
 */
export const cancelAppointment = async (appointmentId, customerEmail, bankDetails = null) => {
    return await cancelAppointmentWithPolicy(appointmentId, customerEmail, bankDetails);
};
