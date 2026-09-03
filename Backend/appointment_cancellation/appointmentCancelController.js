import { cancelAppointment, getCancelPreview } from './cancellationService.js';

export const handleCancelPreview = async (req, res) => {
    try {
        const { id } = req.params;
        const customerEmail = req.user.email;

        if (!id) {
            return res.status(400).json({ success: false, message: 'Appointment ID is required' });
        }

        const preview = await getCancelPreview(id, customerEmail);
        return res.status(200).json({ success: true, data: preview });
    } catch (err) {
        console.error('Error previewing cancellation:', err.message);
        const status = err.message.includes('not found') ? 404 : 
                       err.message.includes('Unauthorized') ? 403 : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
};

export const handleCancelAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const { bankDetails } = req.body || {};
        const customerEmail = req.user.email;

        if (!id) {
            return res.status(400).json({ success: false, message: 'Appointment ID is required' });
        }

        const result = await cancelAppointment(id, customerEmail, bankDetails);

        return res.status(200).json({
            success: true,
            message: result.refundPercentage > 0 
                ? `Appointment cancelled. Refund of Rs. ${result.refundAmount || 0} (${result.refundPercentage}%) will be transferred to your bank account.`
                : 'Appointment cancelled successfully.',
            data: result
        });
    } catch (err) {
        console.error('Error cancelling appointment:', err.message);
        const status = err.message.includes('not found') ? 404 : 
                       err.message.includes('Unauthorized') ? 403 : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
};
