import supabase, { supabaseAdmin } from '../config/supabase.js';

const db = supabaseAdmin || supabase;

// ─── Preset defaults for each policy type ───────────────────────────────────
const POLICY_DEFAULTS = {
    flexible: {
        refund_percentage: 100,
        cancellation_window_hours: 24,
        description: 'Full refund if cancelled at least 24 hours before the appointment.',
    },
    moderate: {
        refund_percentage: 50,
        cancellation_window_hours: 48,
        description: '50% refund if cancelled at least 48 hours before the appointment. No refund after that.',
    },
    limited: {
        refund_percentage: 0,
        cancellation_window_hours: 72,
        description: 'No refund on cancellations. Please cancel at least 72 hours in advance as a courtesy.',
    },
};

const VALID_POLICY_TYPES = Object.keys(POLICY_DEFAULTS);

// ─── GET /cancellation-policy/active?salon_id=<uuid> ────────────────────────
// Returns the single active policy for a salon.
const getActiveCancellationPolicy = async (req, res) => {
    try {
        const { salon_id } = req.query;

        if (!salon_id) {
            return res.status(400).json({ message: 'salon_id query parameter is required' });
        }

        const { data, error } = await db
            .from('cancellation_policies')
            .select('*')
            .eq('salon_id', salon_id)
            .eq('is_active', true)
            .maybeSingle();

        if (error) {
            return res.status(500).json({ message: 'Database query error', error: error.message });
        }

        if (!data) {
            return res.status(404).json({ message: 'No active cancellation policy found for this salon' });
        }

        return res.status(200).json({ message: 'Active policy fetched successfully', policy: data });
    } catch (err) {
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ─── GET /cancellation-policy?salon_id=<uuid> ───────────────────────────────
// Returns all policies (active and inactive) for a salon.
const getAllCancellationPolicies = async (req, res) => {
    try {
        const { salon_id } = req.query;

        if (!salon_id) {
            return res.status(400).json({ message: 'salon_id query parameter is required' });
        }

        const { data, error } = await db
            .from('cancellation_policies')
            .select('*')
            .eq('salon_id', salon_id)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: 'Database query error', error: error.message });
        }

        return res.status(200).json({ message: 'Policies fetched successfully', policies: data });
    } catch (err) {
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ─── POST /cancellation-policy ───────────────────────────────────────────────
// Create a new cancellation policy.
// Required body: { salon_id, policy_type }
// Optional overrides: { refund_percentage, cancellation_window_hours, description, is_active }
const createCancellationPolicy = async (req, res) => {
    try {
        const {
            salon_id,
            policy_type,
            refund_percentage,
            cancellation_window_hours,
            description,
            is_active = true,
        } = req.body;

        // ── Validate required fields ─────────────────────────────────────────
        if (!salon_id) {
            return res.status(400).json({ message: 'salon_id is required' });
        }

        if (!policy_type) {
            return res.status(400).json({ message: 'policy_type is required (flexible | moderate | limited)' });
        }

        if (!VALID_POLICY_TYPES.includes(policy_type)) {
            return res.status(400).json({
                message: `Invalid policy_type. Must be one of: ${VALID_POLICY_TYPES.join(', ')}`,
            });
        }

        if (refund_percentage !== undefined && (refund_percentage < 0 || refund_percentage > 100)) {
            return res.status(400).json({ message: 'refund_percentage must be between 0 and 100' });
        }

        if (cancellation_window_hours !== undefined && cancellation_window_hours < 0) {
            return res.status(400).json({ message: 'cancellation_window_hours must be a positive number' });
        }

        // ── Merge preset defaults with any provided overrides ────────────────
        const defaults = POLICY_DEFAULTS[policy_type];
        const policyData = {
            salon_id,
            policy_type,
            refund_percentage: refund_percentage !== undefined ? refund_percentage : defaults.refund_percentage,
            cancellation_window_hours:
                cancellation_window_hours !== undefined
                    ? cancellation_window_hours
                    : defaults.cancellation_window_hours,
            description: description || defaults.description,
            is_active,
        };

        // ── If this is the active policy, deactivate existing active ones ────
        if (is_active) {
            await db
                .from('cancellation_policies')
                .update({ is_active: false })
                .eq('salon_id', salon_id)
                .eq('is_active', true);
        }

        const { data, error } = await db
            .from('cancellation_policies')
            .insert([policyData])
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: 'Database insert error', error: error.message });
        }

        return res.status(201).json({ message: 'Cancellation policy created successfully', policy: data });
    } catch (err) {
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ─── PUT /cancellation-policy/:id ───────────────────────────────────────────
// Update an existing policy by its ID.
const updateCancellationPolicy = async (req, res) => {
    try {
        const { id } = req.params;
        const { policy_type, refund_percentage, cancellation_window_hours, description, is_active } = req.body;

        const updates = {};

        // ── Validate and build partial update object ─────────────────────────
        if (policy_type !== undefined) {
            if (!VALID_POLICY_TYPES.includes(policy_type)) {
                return res.status(400).json({
                    message: `Invalid policy_type. Must be one of: ${VALID_POLICY_TYPES.join(', ')}`,
                });
            }
            updates.policy_type = policy_type;

            // Re-apply preset defaults for the new type when type changes
            const defaults = POLICY_DEFAULTS[policy_type];
            if (refund_percentage === undefined) updates.refund_percentage = defaults.refund_percentage;
            if (cancellation_window_hours === undefined)
                updates.cancellation_window_hours = defaults.cancellation_window_hours;
            if (description === undefined) updates.description = defaults.description;
        }

        if (refund_percentage !== undefined) {
            if (refund_percentage < 0 || refund_percentage > 100) {
                return res.status(400).json({ message: 'refund_percentage must be between 0 and 100' });
            }
            updates.refund_percentage = refund_percentage;
        }

        if (cancellation_window_hours !== undefined) {
            if (cancellation_window_hours < 0) {
                return res.status(400).json({ message: 'cancellation_window_hours must be a positive number' });
            }
            updates.cancellation_window_hours = cancellation_window_hours;
        }

        if (description !== undefined) updates.description = description;
        if (is_active !== undefined) updates.is_active = is_active;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No valid fields provided to update' });
        }

        // ── If activating this policy, deactivate others for the same salon ──
        if (is_active === true) {
            // Fetch salon_id for this policy first
            const { data: existing } = await db
                .from('cancellation_policies')
                .select('salon_id')
                .eq('id', id)
                .single();

            if (existing) {
                await db
                    .from('cancellation_policies')
                    .update({ is_active: false })
                    .eq('salon_id', existing.salon_id)
                    .eq('is_active', true)
                    .neq('id', id);
            }
        }

        const { data, error } = await db
            .from('cancellation_policies')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: 'Database update error', error: error.message });
        }

        if (!data) {
            return res.status(404).json({ message: 'Cancellation policy not found' });
        }

        return res.status(200).json({ message: 'Cancellation policy updated successfully', policy: data });
    } catch (err) {
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ─── DELETE /cancellation-policy/:id ────────────────────────────────────────
const deleteCancellationPolicy = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await db
            .from('cancellation_policies')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: 'Database delete error', error: error.message });
        }

        if (!data) {
            return res.status(404).json({ message: 'Cancellation policy not found' });
        }

        return res.status(200).json({ message: 'Cancellation policy deleted successfully', policy: data });
    } catch (err) {
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};

export {
    getActiveCancellationPolicy,
    getAllCancellationPolicies,
    createCancellationPolicy,
    updateCancellationPolicy,
    deleteCancellationPolicy,
};
