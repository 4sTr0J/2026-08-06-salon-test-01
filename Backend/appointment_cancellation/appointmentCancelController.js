import { cancelAppointment } from './cancellationService.js';

export const handleCancelAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const customerEmail = req.user.email; // check against email since that's how appointments are tied to users

        if (!id) {
            return res.status(400).json({ success: false, message: 'Appointment ID is required' });
        }

        const result = await cancelAppointment(id, customerEmail);

        return res.status(200).json({
            success: true,
            message: 'Appointment cancelled successfully',
            data: result
        });
    } catch (err) {
        console.error('Error cancelling appointment:', err.message);
        const status = err.message.includes('not found') ? 404 : 
                       err.message.includes('Unauthorized') ? 403 : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
};
