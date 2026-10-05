function initDashboard() {
    // 1. Check Authentication Status (Auth Guard)
    const token = localStorage.getItem('stylepulse_token');
    const userStr = localStorage.getItem('stylepulse_user');

    if (!token || !userStr) {
        window.location.href = '../login.html';
        return;
    }

    let user;
    try {
        user = JSON.parse(userStr);
    } catch (e) {
        localStorage.removeItem('stylepulse_token');
        localStorage.removeItem('stylepulse_user');
        window.location.href = '../login.html';
        return;
    }

    // Guard: if user object is empty or malformed
    if (!user || typeof user !== 'object') {
        localStorage.removeItem('stylepulse_token');
        localStorage.removeItem('stylepulse_user');
        window.location.href = '../login.html';
        return;
    }

    // Role Guard: Salon owners belong in the Owner Portal, not Customer Dashboard
    if (user.role === 'owner') {
        window.location.href = '../SalonOwnerDashboard/dashboard.html';
        return;
    }

    // 2. Populate User Data in UI
    try {
        const nameDisplay = document.getElementById('user-name-display');
        const emailDisplay = document.getElementById('user-email-display');
        const profileName = document.getElementById('profile-name');
        const profileEmail = document.getElementById('profile-email');
        const profileRole = document.getElementById('profile-role');

        const userEmail = user.email || '';
        const fullName = user.fullName || user.name || (userEmail ? userEmail.split('@')[0] : 'Friend');
        const firstName = fullName.split(' ')[0];

        if (nameDisplay) nameDisplay.textContent = firstName;
        if (emailDisplay) emailDisplay.textContent = userEmail;
        if (profileName) profileName.textContent = fullName;
        if (profileEmail) profileEmail.textContent = userEmail;
        if (profileRole) profileRole.textContent = user.role || 'Customer';
    } catch (uiErr) {
        console.error('Dashboard UI init error:', uiErr);
    }

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_ROOT = (window.STYLEPULSE_API_BASE || (isLocal ? 'http://localhost:5001' : 'https://backend-production-8cd3.up.railway.app')).replace(/\/$/, '');

    // Load Loyalty Rewards Summary on Dashboard
    async function loadRewardsSummary() {
        const pointsEl = document.getElementById('dash-points-display');
        const tierEl = document.getElementById('dash-reward-tier');
        if (!pointsEl) return;
        try {
            const customerId = user.id || user.email;
            const res = await fetch(`${API_ROOT}/api/loyalty/account/${customerId}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.account) {
                    pointsEl.textContent = (data.account.available_points || 0).toLocaleString();
                    if (tierEl) tierEl.textContent = data.account.current_tier || 'BRONZE';
                }
            } else {
                pointsEl.textContent = '0';
            }
        } catch (err) {
            console.warn("Rewards summary load error:", err);
            pointsEl.textContent = '0';
        }
    }
    loadRewardsSummary();

    // 3. Logout Logic
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Clear local storage
            localStorage.removeItem('stylepulse_token');
            localStorage.removeItem('stylepulse_user');
            
            // Show alert and redirect
            showAlert('Logging out...', 'success', 1000);
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 1000);
        });
    }

    // 4. Fetch & Filter Appointments
    const appointmentsContainer = document.getElementById("appointments-list-container");
    const tabButtons = document.querySelectorAll(".tab-btn");
    let customerAppointments = [];
    let activeFilterStatus = "Upcoming";

    // Helper: calculate appointment timestamp safely
    function getApptTimestamp(a) {
        if (!a || !a.appointment_date) return 0;
        let timeStr = (a.appointment_time && a.appointment_time !== 'N/A') ? a.appointment_time.trim() : '00:00';
        if (timeStr.length === 5) timeStr += ':00';
        const parsed = new Date(`${a.appointment_date}T${timeStr}`);
        return isNaN(parsed.getTime()) ? new Date(a.appointment_date).getTime() : parsed.getTime();
    }

    async function loadCustomerAppointments() {
        try {
            const res = await fetch(`${API_ROOT}/api/auth/appointments`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && data.appointments) {
                customerAppointments = data.appointments;
                renderAppointments();
                populateNotifications();
                
                // Automatically prompt for review if a completed or past appointment has not been reviewed
                const nowMs = Date.now();
                const pendingReview = customerAppointments.find(a => {
                    const status = (a.booking_status || "").toLowerCase();
                    const apptTime = getApptTimestamp(a);
                    const isPast = apptTime > 0 && apptTime < nowMs;
                    const isCompleted = status === "completed" || (status !== "cancelled" && isPast);
                    return isCompleted && !a.isReviewed;
                });
                if (pendingReview) {
                    setTimeout(() => {
                        window.openReviewModal(
                            pendingReview.salon_id, 
                            pendingReview.id, 
                            pendingReview.service_name, 
                            pendingReview.salon_name || 'StylePulse Salon'
                        );
                    }, 800);
                }
            } else {
                if (appointmentsContainer) {
                    appointmentsContainer.innerHTML = `<div class="empty-state">Failed to load appointments.</div>`;
                }
            }
        } catch (err) {
            console.error("Error loading appointments:", err);
            if (appointmentsContainer) {
                appointmentsContainer.innerHTML = `<div class="empty-state">Server connection error.</div>`;
            }
        }
    }

    // === Notification Bell Logic ===
    const notifBellBtn = document.getElementById("notif-bell-btn");
    const notifDropdown = document.getElementById("notif-dropdown");
    const notifBadge = document.getElementById("notif-badge");
    const notifCountLabel = document.getElementById("notif-count-label");
    const notifItemsContainer = document.getElementById("notif-items-container");

    if (notifBellBtn && notifDropdown) {
        notifBellBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isVisible = notifDropdown.style.display === "block";
            notifDropdown.style.display = isVisible ? "none" : "block";
        });

        document.addEventListener("click", (e) => {
            if (!notifDropdown.contains(e.target) && e.target !== notifBellBtn) {
                notifDropdown.style.display = "none";
            }
        });
    }

    function populateNotifications() {
        const nowMs = Date.now();
        const pending = customerAppointments.filter(a => {
            const status = (a.booking_status || "").toLowerCase();
            const apptTime = getApptTimestamp(a);
            const isPast = apptTime > 0 && apptTime < nowMs;
            const isCompleted = status === "completed" || (status !== "cancelled" && isPast);
            return isCompleted && !a.isReviewed;
        });

        // Update badge
        if (notifBadge) {
            if (pending.length > 0) {
                notifBadge.style.display = "flex";
                notifBadge.textContent = pending.length;
            } else {
                notifBadge.style.display = "none";
            }
        }

        // Update count label
        if (notifCountLabel) {
            notifCountLabel.textContent = `${pending.length} pending`;
        }

        // Render items
        if (notifItemsContainer) {
            if (pending.length === 0) {
                notifItemsContainer.innerHTML = `<div style="text-align: center; padding: 2rem 1rem; color: rgba(255,255,255,0.35); font-size: 0.85rem; font-style: italic;">🎉 All caught up! No pending reviews.</div>`;
                return;
            }

            notifItemsContainer.innerHTML = pending.map(a => {
                const dateFormatted = new Date(a.appointment_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                return `
                    <div class="notif-item" onclick="openReviewModal('${a.salon_id}', '${a.id}', '${(a.service_name || '').replace(/'/g, "\\'")}', '${(a.salon_name || 'StylePulse Salon').replace(/'/g, "\\'")}')" style="
                        padding: 12px 18px; cursor: pointer; transition: background 0.2s;
                        border-bottom: 1px solid rgba(255,255,255,0.05);
                        display: flex; align-items: center; gap: 12px;
                    " onmouseover="this.style.background='rgba(255,184,43,0.08)'"
                       onmouseout="this.style.background='transparent'">
                        <div style="
                            width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
                            background: linear-gradient(135deg, rgba(255,184,43,0.2), rgba(255,204,0,0.1));
                            display: flex; align-items: center; justify-content: center; font-size: 1.1rem;
                        ">⭐</div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 0.85rem; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${a.service_name}
                            </div>
                            <div style="font-size: 0.72rem; color: rgba(255,255,255,0.45); margin-top: 2px;">
                                ${a.salon_name || 'StylePulse Salon'} · ${dateFormatted}
                            </div>
                        </div>
                        <div style="font-size: 0.7rem; font-weight: 700; color: #ffcc00; text-transform: uppercase; white-space: nowrap;">
                            Review →
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    function renderAppointments() {
        if (!appointmentsContainer) return;

        const currentTab = (activeFilterStatus || "").toLowerCase();
        const nowMs = Date.now();

        let filtered = customerAppointments.filter(a => {
            const status = (a.booking_status || "").toLowerCase();
            const apptTime = getApptTimestamp(a);
            const isPast = apptTime > 0 && apptTime < nowMs;
            const isCancelled = status === "cancelled";
            const isCompleted = status === "completed" || (!isCancelled && isPast);
            const isRescheduled = (a.is_rescheduled || status === "rescheduled") && !isPast;

            if (currentTab === "rescheduled") {
                return isRescheduled;
            }

            if (currentTab === "upcoming") {
                // If it's rescheduled, completed, past, or cancelled, it does not belong in Upcoming
                if (isRescheduled || isCompleted || isPast || isCancelled) return false;
                return status === "upcoming" || status === "confirmed" || status === "pending";
            }

            if (currentTab === "completed") {
                return isCompleted;
            }

            if (currentTab === "cancelled") {
                return isCancelled;
            }

            return status === currentTab;
        });

        // Sort appointments:
        // For Upcoming/Rescheduled: Closest upcoming date/time first (ascending chronologically)
        // For Completed/Cancelled: Most recent past appointments first (descending chronologically)
        filtered.sort((a, b) => {
            const aTime = getApptTimestamp(a);
            const bTime = getApptTimestamp(b);
            if (currentTab === "upcoming" || currentTab === "rescheduled") {
                return aTime - bTime; // Closest upcoming first
            } else {
                return bTime - aTime; // Newest completed/cancelled first
            }
        });

        if (filtered.length === 0) {
            appointmentsContainer.innerHTML = `
                <div class="empty-state">
                    You have no ${activeFilterStatus.toLowerCase()} appointments.
                </div>
            `;
            return;
        }

        appointmentsContainer.innerHTML = filtered.map(a => {
            const dateFormatted = new Date(a.appointment_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            const status = (a.booking_status || "").toLowerCase();
            const apptTime = getApptTimestamp(a);
            const isPast = apptTime > 0 && apptTime < nowMs;
            const isCancelled = status === "cancelled";
            const isCompleted = status === "completed" || (!isCancelled && isPast);
            const isRescheduled = (a.is_rescheduled || status === "rescheduled") && !isPast;
            const isTrulyUpcoming = !isCancelled && !isCompleted && !isPast;
            
            const reviewButtonHtml = isCompleted 
                ? (a.isReviewed 
                    ? `<span style="margin-top: 8px; font-size: 0.8rem; font-weight: 700; color: #2ecc71;">✓ Reviewed</span>`
                    : `<button onclick="openReviewModal('${a.salon_id}', '${a.id}', '${(a.service_name || 'Salon Service').replace(/'/g, "\\'")}', '${a.salon_name ? a.salon_name.replace(/'/g, "\\'") : 'StylePulse Salon'}')" style="margin-top: 8px; background: linear-gradient(135deg, #ffc845, #e5a93b); border: none; color: #000; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 700;">⭐ Rate &amp; Review</button>`
                  )
                : '';

            const reschedCount = a.reschedule_info ? (Number(a.reschedule_info.reschedule_count || a.reschedule_info.total_reschedules) || 1) : 0;
            const maxReached = reschedCount >= 3;

            const rescheduleButtonHtml = isTrulyUpcoming
                ? (maxReached
                    ? `<span style="margin-top: 8px; margin-left: 8px; font-size: 0.75rem; color: #888; border: 1px solid rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px; display: inline-block;">🔒 Max Reschedules Reached (3/3)</span>`
                    : `<button onclick="window.openRescheduleModal('${a.id}', '${(a.service_name || '').replace(/'/g, "\\'")}', '${a.salon_id}')" style="margin-top: 8px; margin-left: 8px; background: rgba(52,152,219,0.15); border: 1px solid rgba(52,152,219,0.5); color: #3498db; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 700; transition: all 0.3s;" onmouseover="this.style.background='rgba(52,152,219,0.25)'" onmouseout="this.style.background='rgba(52,152,219,0.15)'">🔄 Reschedule (${3 - reschedCount} left)</button>`
                  )
                : '';

            const cancelButtonHtml = isTrulyUpcoming
                ? `<button onclick="window.handleCancelAppointment('${a.id}')" style="margin-top: 8px; margin-left: 8px; background: rgba(231,76,60,0.1); border: 1px solid rgba(231,76,60,0.5); color: #e74c3c; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 700; transition: all 0.3s;" onmouseover="this.style.background='rgba(231,76,60,0.2)'" onmouseout="this.style.background='rgba(231,76,60,0.1)'">❌ Cancel</button>`
                : '';

            const lateButtonHtml = isTrulyUpcoming
                ? `<button onclick="window.openRunningLateModal('${a.id}', '${(a.service_name || '').replace(/'/g, "\\'")}', '${a.appointment_time}', '${a.salon_id}')" style="margin-top: 8px; margin-left: 8px; background: rgba(255,184,43,0.15); border: 1px solid rgba(255,184,43,0.5); color: #ffcc00; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 700; transition: all 0.3s;" onmouseover="this.style.background='rgba(255,184,43,0.25)'" onmouseout="this.style.background='rgba(255,184,43,0.15)'">⏳ I'm Running Late</button>`
                : '';

            let rescheduleTagHtml = '';
            if (isRescheduled && a.reschedule_info) {
                const prevDate = new Date(a.reschedule_info.previous_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                const feeCharged = Number(a.reschedule_info.fee_charged || a.reschedule_info.total_fee_charged) || 0;
                const feeText = feeCharged > 0 
                    ? ` • <span style="color:#e67e22; font-weight:700;">+Rs. ${feeCharged} Reschedule Fee (Pay at Salon)</span>`
                    : ` • <span style="color:#2ecc71; font-weight:700;">Free 1st Reschedule</span>`;

                rescheduleTagHtml = `
                    <div style="margin-top: 6px; font-size: 0.76rem; color: #ffb82b; background: rgba(255,184,43,0.12); border: 1px solid rgba(255,184,43,0.3); border-radius: 6px; padding: 4px 8px; display: inline-block;">
                        🔄 Rescheduled (#${reschedCount}/3) from ${prevDate} (${a.reschedule_info.previous_time}) → <strong>New Time: ${dateFormatted} at ${a.appointment_time}</strong>${feeText}
                    </div>
                `;
            }

            const statusBadgeText = isCancelled ? 'CANCELLED' : (isCompleted ? 'COMPLETED' : (isRescheduled ? 'RESCHEDULED' : (a.booking_status || 'CONFIRMED')));
            const badgeStyle = isCancelled
                ? 'background: rgba(231,76,60,0.15); color: #e74c3c; border: 1px solid rgba(231,76,60,0.3);'
                : (isCompleted
                    ? 'background: rgba(46,204,113,0.15); color: #2ecc71; border: 1px solid rgba(46,204,113,0.3);'
                    : 'background: rgba(255,184,43,0.15); color: #ffcc00; border: 1px solid rgba(255,184,43,0.3);');

            return `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); padding: 1.25rem; border-radius: 12px; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 12px; transition: border-color 0.2s;" onmouseover="this.style.borderColor='rgba(255,204,0,0.2)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.07)'">
                    <!-- Top row: salon info + date/status -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                        <div style="flex: 1; min-width: 200px;">
                            <h4 style="color: #ffcc00; font-family: 'Outfit', sans-serif; font-size: 1.05rem; margin: 0;">🏢 ${a.salon_name || 'StylePulse Salon'}</h4>
                            <p style="margin: 0.2rem 0; font-weight: 500; font-size: 0.92rem; color: #fff;">💇 ${a.service_name || 'Salon Service'}</p>
                            <p style="margin: 0; font-size: 0.8rem; color: rgba(255,255,255,0.5);">📍 ${a.salon_address || 'Address not listed'}</p>
                            <p style="margin: 0.3rem 0 0; font-size: 0.72rem; color: #2ecc71;">🛡️ Includes 30-min buffer window</p>
                            ${rescheduleTagHtml}
                        </div>
                        <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                            <span style="font-size: 0.88rem; font-weight: 600; color: #fff; display: block; white-space: nowrap;">⏱ ${dateFormatted} at ${a.appointment_time}</span>
                            <span style="display: inline-block; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; ${badgeStyle}">${statusBadgeText}</span>
                        </div>
                    </div>
                    <!-- Bottom row: action buttons always visible -->
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
                        ${reviewButtonHtml}
                        ${rescheduleButtonHtml}
                        ${lateButtonHtml}
                        ${cancelButtonHtml}
                        ${!reviewButtonHtml && !rescheduleButtonHtml && !lateButtonHtml && !cancelButtonHtml ? '<span style="font-size:0.8rem; color: rgba(255,255,255,0.3); font-style: italic;">No actions available</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // "I'm Running Late" / Reschedule Modal
    window.openRunningLateModal = function(appointmentId, serviceName, appointmentTime, salonId) {
        const modalId = 'sp-late-modal';
        let oldModal = document.getElementById(modalId);
        if (oldModal) oldModal.remove();

        const modal = document.createElement('div');
        modal.id = modalId;
        Object.assign(modal.style, {
            position: "fixed", inset: "0", background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: "10000", backdropFilter: "blur(10px)"
        });

        modal.innerHTML = `
            <div style="background: #12110e; border: 1px solid rgba(255, 184, 43, 0.45); border-radius: 18px; padding: 2.2rem; width: 90%; max-width: 460px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); color: #fff; font-family: 'Poppins', sans-serif;">
                <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.45rem; color: #ffcc00; margin: 0 0 0.5rem;">⏳ I'm Running Late</h3>
                <p style="font-size: 0.85rem; color: rgba(255,255,255,0.65); margin-bottom: 1.2rem;">Appointment: <strong>${serviceName}</strong> at <strong>${appointmentTime}</strong></p>
                
                <div id="late-info-banner" style="background: rgba(255,184,43,0.08); border: 1px solid rgba(255,184,43,0.25); border-radius: 8px; padding: 10px 12px; margin-bottom: 1.2rem; font-size: 0.82rem; color: #ffcc00; line-height: 1.4;">
                    🛡️ <strong>30-Minute Buffer Protection:</strong> Delays up to 30 minutes are covered by your appointment buffer.
                </div>

                <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
                    <div>
                        <label style="font-size: 0.8rem; color: rgba(255,255,255,0.5); display: block; margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 600;">Estimated Delay</label>
                        <select id="late-delay-select" style="width: 100%; background: #1a1815; border: 1px solid rgba(255,184,43,0.3); border-radius: 8px; color: #fff; padding: 10px; font-family: inherit; font-size: 0.9rem; outline: none; cursor: pointer;">
                            <option value="10">10 Minutes Late (Within Grace Period)</option>
                            <option value="15">15 Minutes Late (Within Grace Period)</option>
                            <option value="20" selected>20 Minutes Late (Covered by 30-min Buffer)</option>
                            <option value="30">30 Minutes Late (Max Buffer Limit)</option>
                            <option value="45">> 30 Minutes Late (Reschedule Required)</option>
                        </select>
                    </div>
                    
                    <div id="late-note-container">
                        <label style="font-size: 0.8rem; color: rgba(255,255,255,0.5); display: block; margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 600;">Note for Stylist (Optional)</label>
                        <input type="text" id="late-note-input" placeholder="e.g. Stuck in heavy traffic" style="width: 100%; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #fff; padding: 10px; font-family: inherit; font-size: 0.88rem; box-sizing: border-box; outline: none;" />
                    </div>

                    <div id="reschedule-prompt-container" style="display: none; background: rgba(231,76,60,0.1); border: 1px solid rgba(231,76,60,0.3); border-radius: 8px; padding: 12px; font-size: 0.82rem; color: #ff8080; line-height: 1.4;">
                        ⚠️ Delays over 30 minutes exceed the reserved buffer and cannot be covered. Please reschedule your slot.
                        <div style="margin-top: 6px; font-weight: 600; color: #fff;">
                            ✨ <strong>1st Reschedule is 100% FREE</strong> (Subsequent reschedules: Rs. 500).
                        </div>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cancel-late-btn" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem;">Cancel</button>
                    <button id="submit-late-btn" style="background: linear-gradient(135deg, #ffc845, #e5a93b); border: none; color: #000; padding: 8px 20px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.9rem;">Notify Salon</button>
                    <button id="goto-reschedule-btn" style="display: none; background: linear-gradient(135deg, #e67e22, #d35400); border: none; color: #fff; padding: 8px 20px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.9rem;">Reschedule Now →</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const delaySelect = modal.querySelector('#late-delay-select');
        const noteContainer = modal.querySelector('#late-note-container');
        const reschedulePrompt = modal.querySelector('#reschedule-prompt-container');
        const notifyBtn = modal.querySelector('#submit-late-btn');
        const rescheduleBtn = modal.querySelector('#goto-reschedule-btn');
        const infoBanner = modal.querySelector('#late-info-banner');

        function updateLateModalUI() {
            const delayVal = parseInt(delaySelect.value, 10);
            if (delayVal > 30) {
                noteContainer.style.display = "none";
                reschedulePrompt.style.display = "block";
                notifyBtn.style.display = "none";
                rescheduleBtn.style.display = "inline-block";
                infoBanner.style.display = "none";
            } else {
                noteContainer.style.display = "block";
                reschedulePrompt.style.display = "none";
                notifyBtn.style.display = "inline-block";
                rescheduleBtn.style.display = "none";
                infoBanner.style.display = "block";
            }
        }

        delaySelect.addEventListener('change', updateLateModalUI);

        modal.querySelector('#cancel-late-btn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        rescheduleBtn.addEventListener('click', () => {
            modal.remove();
            window.openRescheduleModal(appointmentId, serviceName, salonId);
        });

        notifyBtn.addEventListener('click', async () => {
            const delayMinutes = delaySelect.value;
            const note = modal.querySelector('#late-note-input').value.trim();
            notifyBtn.disabled = true;
            notifyBtn.textContent = "Sending...";

            try {
                const res = await fetch(`${API_ROOT}/api/appointments/${appointmentId}/running-late`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ delayMinutes, note })
                });

                const data = await res.json();
                modal.remove();
                if (data.success) {
                    showAlert(data.message, "success", 5000);
                } else {
                    showAlert(data.message || "Failed to submit notice", "error");
                }
            } catch (err) {
                console.error("Running late error:", err);
                modal.remove();
                showAlert("Network error submitting notification.", "error");
            }
        });
    };

    // Reschedule Flow with Free 1st & Rs. 500 Subsequent Policy
    window.openRescheduleModal = async function(appointmentId, serviceName, salonId) {
        const modalId = 'sp-reschedule-modal';
        let oldModal = document.getElementById(modalId);
        if (oldModal) oldModal.remove();

        const modal = document.createElement('div');
        modal.id = modalId;
        Object.assign(modal.style, {
            position: "fixed", inset: "0", background: "rgba(0,0,0,0.88)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: "10000", backdropFilter: "blur(10px)"
        });

        // 1. Fetch Quote & check max 3 limit
        let quote = { isFree: true, fee: 0, pastReschedulesCount: 0, maxLimitReached: false, isAllowed: true, remainingReschedules: 3 };
        try {
            const qRes = await fetch(`${API_ROOT}/api/appointments/${appointmentId}/reschedule-quote`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const qData = await qRes.json();
            if (qData.success) quote = qData;
        } catch (e) {
            console.warn("Could not fetch quote:", e);
        }

        if (quote.maxLimitReached || quote.isAllowed === false) {
            showAlert("⚠️ Maximum limit reached (3 of 3 reschedules used). This appointment cannot be rescheduled further.", "error", 5000);
            return;
        }

        const currentCount = quote.pastReschedulesCount || 0;
        const currentAttempt = currentCount + 1; // 1, 2, or 3
        const remainingAfter = 3 - currentAttempt;

        const feeBadge = quote.isFree 
            ? `<span style="background: #2ecc71; color: #000; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 0.75rem;">1st Reschedule: 100% FREE (Attempt 1/3)</span>`
            : `<span style="background: #e67e22; color: #fff; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 0.75rem;">Reschedule Fee: +Rs. ${quote.fee}.00 (Attempt ${currentAttempt}/3)</span>`;

        const feeNoteHtml = quote.isFree
            ? `<div style="color: #2ecc71; font-weight: 600; margin-top: 6px;">✨ Your first reschedule is 100% free of charge! (${remainingAfter} remaining)</div>`
            : `<div style="color: #ffcc00; font-weight: 600; margin-top: 6px;">💳 Notice: A <strong>Rs. ${quote.fee} Reschedule Fee</strong> will be added to your service fee and collected upon arrival at the salon. (${remainingAfter} remaining)</div>`;

        modal.innerHTML = `
            <div style="background: #13100a; border: 1px solid rgba(255, 184, 43, 0.45); border-radius: 20px; width: 92%; max-width: 480px; overflow: hidden; font-family: 'Poppins', sans-serif; color: #fff; box-shadow: 0 20px 60px rgba(0,0,0,0.8);">
                <div style="background: linear-gradient(135deg, #1a1300, #261900); padding: 20px 24px; border-bottom: 1px solid rgba(255, 184, 43, 0.2); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.3rem; color: #ffcc00;">🔄 Reschedule Appointment</h3>
                        <p style="margin: 4px 0 0; font-size: 0.85rem; color: rgba(255,200,100,0.7);">${serviceName} • Attempt ${currentAttempt} of 3</p>
                    </div>
                    <div>${feeBadge}</div>
                </div>
                
                <div style="padding: 20px 24px; max-height: 65vh; overflow-y: auto;">
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px; font-size: 0.82rem; margin-bottom: 16px; color: #ddd;">
                        ${quote.message}
                        ${feeNoteHtml}
                    </div>

                    <div style="font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em; color: #999; text-transform: uppercase; margin-bottom: 10px;">Select New Date</div>
                    <div id="sp-reschedule-carousel" style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px;"></div>

                    <div id="sp-reschedule-slots-container" style="display: none; margin-top: 16px;">
                        <div style="font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em; color: #999; text-transform: uppercase; margin-bottom: 10px;">Pick Available Slot (with 30m Buffer)</div>
                        <div id="sp-reschedule-slots-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;"></div>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02);">
                    <button id="cancel-resched-btn" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 8px 18px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.88rem;">Cancel</button>
                    <button id="confirm-resched-btn" style="background: linear-gradient(135deg, #ffc845, #e5a93b); border: none; color: #000; padding: 8px 22px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.88rem; opacity: 0.4; pointer-events: none;">Confirm Reschedule</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        let selectedDate = null;
        let selectedSlot = null;

        // Build 14-day carousel
        const carousel = modal.querySelector("#sp-reschedule-carousel");
        const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
        const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const today = new Date();

        for (let i = 0; i < 14; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const isoYear = d.getFullYear();
            const isoMonth = String(d.getMonth() + 1).padStart(2, '0');
            const isoDay = String(d.getDate()).padStart(2, '0');
            const iso = `${isoYear}-${isoMonth}-${isoDay}`;

            const chip = document.createElement("div");
            chip.style.cssText = "min-width: 58px; padding: 10px 6px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); cursor: pointer; text-align: center; flex-shrink: 0; transition: all 0.2s;";
            chip.innerHTML = `
                <div style="font-size: 0.65rem; color: #888; font-weight: 600; text-transform: uppercase;">${DAYS[d.getDay()]}</div>
                <div style="font-size: 1.3rem; font-weight: 700; color: #fff; line-height: 1.1;">${d.getDate()}</div>
                <div style="font-size: 0.65rem; color: #888;">${MONTHS[d.getMonth()]}</div>
            `;

            chip.addEventListener('click', async () => {
                carousel.querySelectorAll('div').forEach(c => {
                    c.style.borderColor = 'rgba(255,255,255,0.1)';
                    c.style.background = 'rgba(255,255,255,0.04)';
                });
                chip.style.borderColor = '#ffcc00';
                chip.style.background = 'rgba(255,184,43,0.15)';

                selectedDate = iso;
                selectedSlot = null;
                modal.querySelector('#confirm-resched-btn').style.opacity = '0.4';
                modal.querySelector('#confirm-resched-btn').style.pointerEvents = 'none';

                const container = modal.querySelector('#sp-reschedule-slots-container');
                const grid = modal.querySelector('#sp-reschedule-slots-grid');
                container.style.display = 'block';
                grid.innerHTML = '<div style="grid-column: 1/-1; color: #888; font-size: 0.85rem;">Loading slots…</div>';

                try {
                    const res = await fetch(`${API_ROOT}/api/appointments/available?date=${iso}&salonId=${salonId || ''}`);
                    const data = await res.json();
                    const available = data.availableSlots || [];
                    const operating = data.operatingSlots || available;

                    grid.innerHTML = '';
                    if (operating.length === 0) {
                        grid.innerHTML = '<div style="grid-column: 1/-1; color: #888; font-size: 0.85rem;">No operating slots available on this date.</div>';
                        return;
                    }

                    operating.forEach(slot => {
                        const isAvail = available.includes(slot);
                        const slotBtn = document.createElement('div');
                        slotBtn.style.cssText = `padding: 10px 4px; border-radius: 8px; border: 1px solid ${isAvail ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)'}; background: ${isAvail ? 'rgba(255,255,255,0.04)' : 'transparent'}; color: ${isAvail ? '#fff' : '#555'}; text-align: center; font-size: 0.85rem; font-weight: 600; cursor: ${isAvail ? 'pointer' : 'not-allowed'}; ${isAvail ? '' : 'text-decoration: line-through;'}`;
                        
                        const [h, m] = slot.split(':').map(Number);
                        const ampm = h < 12 ? 'AM' : 'PM';
                        const h12 = h % 12 || 12;
                        slotBtn.textContent = `${h12}:${String(m).padStart(2,'0')} ${ampm}`;

                        if (isAvail) {
                            slotBtn.addEventListener('click', () => {
                                grid.querySelectorAll('div').forEach(b => {
                                    b.style.borderColor = 'rgba(255,255,255,0.1)';
                                    b.style.color = '#fff';
                                });
                                slotBtn.style.borderColor = '#ffcc00';
                                slotBtn.style.color = '#ffcc00';
                                selectedSlot = slot;
                                modal.querySelector('#confirm-resched-btn').style.opacity = '1';
                                modal.querySelector('#confirm-resched-btn').style.pointerEvents = 'all';
                            });
                        }
                        grid.appendChild(slotBtn);
                    });
                } catch (err) {
                    grid.innerHTML = '<div style="grid-column: 1/-1; color: #e74c3c; font-size: 0.85rem;">Failed to load slots.</div>';
                }
            });

            carousel.appendChild(chip);
        }

        modal.querySelector('#cancel-resched-btn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        modal.querySelector('#confirm-resched-btn').addEventListener('click', async () => {
            if (!selectedDate || !selectedSlot) return;
            const btn = modal.querySelector('#confirm-resched-btn');
            btn.disabled = true;
            btn.textContent = "Rescheduling...";

            try {
                const res = await fetch(`${API_ROOT}/api/appointments/${appointmentId}/reschedule`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ newDate: selectedDate, newTime: selectedSlot })
                });

                const data = await res.json();
                modal.remove();
                if (data.success) {
                    showRescheduleSuccessModal({
                        newDate: selectedDate,
                        newTime: selectedSlot,
                        serviceName,
                        feeCharged: data.feeCharged || 0,
                        totalFee: data.totalRescheduleFee || 0,
                        rescheduleCount: data.rescheduleCount || 1,
                        message: data.message
                    });
                    loadCustomerAppointments();
                } else {
                    showAlert(data.message || "Failed to reschedule.", "error");
                }
            } catch (err) {
                console.error("Reschedule submit error:", err);
                modal.remove();
                showAlert("Network error during reschedule.", "error");
            }
        });
    };

    // Premium Centered Confirmation Popup Modal
    function showRescheduleSuccessModal({ newDate, newTime, serviceName, feeCharged, totalFee, rescheduleCount, message }) {
        const old = document.getElementById("reschedule-success-modal");
        if (old) old.remove();

        const formattedDate = new Date(newDate).toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Format time to 12hr AM/PM
        let formattedTime = newTime;
        try {
            const [h, m] = newTime.split(':').map(Number);
            const ampm = h < 12 ? 'AM' : 'PM';
            const h12 = h % 12 || 12;
            formattedTime = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
        } catch(e) {}

        const isFree = Number(feeCharged) === 0;

        const feeBadgeHtml = isFree ? `
            <div style="background: rgba(46, 204, 113, 0.15); border: 1px solid rgba(46, 204, 113, 0.4); border-radius: 12px; padding: 12px 16px; margin-top: 14px; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 0.88rem; color: #2ecc71; font-weight: 700;">✨ 1st Reschedule Applied</span>
                <span style="background: #2ecc71; color: #000; font-size: 0.75rem; font-weight: 800; padding: 3px 8px; border-radius: 6px;">100% FREE</span>
            </div>
        ` : `
            <div style="background: rgba(255, 184, 43, 0.12); border: 1px solid rgba(255, 184, 43, 0.35); border-radius: 12px; padding: 14px 16px; margin-top: 14px; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.88rem; color: #fff; font-weight: 600;">Reschedule Fee Added</span>
                    <strong style="color: #ffcc00; font-size: 1.05rem;">+Rs. ${feeCharged}.00</strong>
                </div>
                <div style="font-size: 0.76rem; color: rgba(255,255,255,0.7); margin-top: 4px; line-height: 1.3;">
                    💳 This fee has been added to your service bill and will be collected directly upon arrival at the salon.
                </div>
            </div>
        `;

        const modalDiv = document.createElement("div");
        modalDiv.id = "reschedule-success-modal";
        modalDiv.style.cssText = `
            position: fixed; inset: 0; background: rgba(0, 0, 0, 0.85);
            display: flex; align-items: center; justify-content: center;
            z-index: 100000; backdrop-filter: blur(12px);
            animation: fadeInModal 0.3s ease-out;
        `;

        modalDiv.innerHTML = `
            <div style="
                background: linear-gradient(145deg, #151411, #0d0c09);
                border: 1px solid rgba(255, 184, 43, 0.45);
                box-shadow: 0 25px 70px rgba(0,0,0,0.8), 0 0 30px rgba(255, 184, 43, 0.15);
                border-radius: 24px;
                padding: 2.5rem 2rem;
                width: 90%;
                max-width: 480px;
                text-align: center;
                color: #fff;
                font-family: 'Poppins', sans-serif;
                position: relative;
                transform: scale(0.95);
                animation: popUpModal 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            ">
                <!-- Glowing Checkmark Icon -->
                <div style="
                    width: 76px; height: 76px; margin: 0 auto 1.2rem;
                    background: linear-gradient(135deg, #2ecc71, #27ae60);
                    border-radius: 50%; display: flex; align-items: center; justify-content: center;
                    font-size: 2.2rem; color: #fff;
                    box-shadow: 0 0 30px rgba(46, 204, 113, 0.5);
                ">
                    ✓
                </div>

                <h2 style="font-family: 'Outfit', sans-serif; font-size: 1.6rem; color: #fff; margin: 0 0 0.4rem; font-weight: 700;">
                    Reschedule Confirmed!
                </h2>
                <p style="font-size: 0.85rem; color: rgba(255,255,255,0.65); margin: 0 0 1.5rem;">
                    Your booking has been updated and synced with the salon calendar.
                </p>

                <!-- Appointment Details Box -->
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 1.2rem; text-align: left;">
                    <div style="font-size: 0.72rem; text-transform: uppercase; color: #ffcc00; font-weight: 800; letter-spacing: 0.08em; margin-bottom: 4px;">Service</div>
                    <div style="font-size: 1rem; font-weight: 600; color: #fff; margin-bottom: 12px;">💇 ${serviceName}</div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px;">
                        <div>
                            <div style="font-size: 0.7rem; text-transform: uppercase; color: rgba(255,255,255,0.5); font-weight: 600;">New Date</div>
                            <div style="font-size: 0.88rem; font-weight: 600; color: #fff; margin-top: 2px;">📅 ${formattedDate}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.7rem; text-transform: uppercase; color: rgba(255,255,255,0.5); font-weight: 600;">New Slot</div>
                            <div style="font-size: 0.88rem; font-weight: 700; color: #ffcc00; margin-top: 2px;">⏱ ${formattedTime}</div>
                        </div>
                    </div>
                </div>

                ${feeBadgeHtml}

                <div style="margin-top: 1.8rem;">
                    <button id="close-success-modal-btn" style="
                        width: 100%;
                        background: linear-gradient(135deg, #ffc845, #e5a93b);
                        border: none; color: #000;
                        padding: 12px 24px;
                        border-radius: 12px;
                        cursor: pointer;
                        font-size: 0.95rem;
                        font-weight: 700;
                        font-family: inherit;
                        box-shadow: 0 4px 20px rgba(255, 184, 43, 0.4);
                        transition: transform 0.2s, box-shadow 0.2s;
                    " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                        Done &amp; View Appointments
                    </button>
                </div>
            </div>
        `;

        // Inject keyframes animation if not present
        if (!document.getElementById("modal-anim-style")) {
            const style = document.createElement("style");
            style.id = "modal-anim-style";
            style.textContent = `
                @keyframes fadeInModal { from { opacity: 0; } to { opacity: 1; } }
                @keyframes popUpModal { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(modalDiv);

        modalDiv.querySelector('#close-success-modal-btn').addEventListener('click', () => modalDiv.remove());
    }

    // Cancellation logic with automated refund bank details collection
    window.handleCancelAppointment = async function(appointmentId) {
        // Safe client name lookup
        let clientName = '';
        try {
            const u = JSON.parse(localStorage.getItem('stylepulse_user') || '{}');
            clientName = u.full_name || u.name || '';
        } catch (e) {}

        const activeToken = localStorage.getItem('stylepulse_token') || token;

        // Build the modal immediately with loading state
        const existing = document.getElementById('sp-cancel-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'sp-cancel-modal';
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.85);
            display: flex; align-items: center; justify-content: center;
            z-index: 10000; backdrop-filter: blur(8px); padding: 20px;
        `;

        modal.innerHTML = `
            <div style="background: #14120c; border: 1px solid rgba(255, 184, 43, 0.4); border-radius: 18px; width: 100%; max-width: 500px; box-shadow: 0 25px 70px rgba(0,0,0,0.85); font-family: 'Poppins', sans-serif; color: #fff; overflow: hidden;">
                <!-- Modal Header -->
                <div style="padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.3rem;">⚠️</span>
                        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: #ffcc00;">Cancel Appointment</h3>
                    </div>
                    <button id="close-cancel-modal-btn" style="background: transparent; border: none; color: #888; font-size: 1.4rem; cursor: pointer;">&times;</button>
                </div>

                <!-- Modal Body (Dynamic) -->
                <div id="cancel-modal-body" style="padding: 22px; max-height: 72vh; overflow-y: auto;">
                    <div style="text-align: center; padding: 30px 10px; color: #ffcc00;">
                        <div style="font-size: 1.8rem; margin-bottom: 10px;">⏳</div>
                        <div style="font-size: 0.95rem; font-weight: 600;">Checking cancellation policy &amp; refund eligibility...</div>
                    </div>
                </div>

                <!-- Modal Footer -->
                <div id="cancel-modal-footer" style="padding: 14px 22px; border-top: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); display: flex; justify-content: flex-end; gap: 12px;">
                    <button id="cancel-keep-appt-btn" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 9px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.85rem;">Keep Appointment</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('#close-cancel-modal-btn').onclick = () => modal.remove();
        modal.querySelector('#cancel-keep-appt-btn').onclick = () => modal.remove();

        // Fetch cancellation preview to check refund eligibility
        let preview = null;
        try {
            const previewRes = await fetch(`${API_ROOT}/api/appointments/${appointmentId}/cancel-preview`, {
                headers: { 'Authorization': `Bearer ${activeToken}` }
            });
            if (previewRes.ok) {
                const pData = await previewRes.json();
                if (pData.success) preview = pData.data;
            }
        } catch (e) {
            console.warn("Could not fetch cancellation preview:", e);
        }

        const isEligible = preview ? preview.refundPercentage > 0 : true;
        const refundPct = preview ? preview.refundPercentage : 100;
        const refundAmt = preview ? parseFloat(preview.refundAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00';

        const bodyElem = modal.querySelector('#cancel-modal-body');
        const footerElem = modal.querySelector('#cancel-modal-footer');

        if (!bodyElem || !footerElem) return;

        bodyElem.innerHTML = `
            ${isEligible ? `
                <!-- Refund Eligibility Banner -->
                <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.35); border-radius: 12px; padding: 14px 16px; margin-bottom: 18px;">
                    <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #86efac; font-size: 0.95rem;">
                        <span>🎉</span> <span>Eligible for ${refundPct}% Refund!</span>
                    </div>
                    <div style="font-size: 1.45rem; font-weight: 800; color: #4ade80; margin: 4px 0;">
                        Rs. ${refundAmt}
                    </div>
                    <p style="font-size: 0.78rem; color: #bbb; margin: 0; line-height: 1.4;">
                        ${preview ? preview.policyDescription : 'Eligible for direct refund under salon cancellation policy.'}
                    </p>
                </div>

                <!-- Bank Details Request Notice -->
                <div style="background: rgba(255, 184, 43, 0.08); border: 1px dashed rgba(255, 184, 43, 0.4); border-radius: 12px; padding: 12px 14px; margin-bottom: 18px; font-size: 0.8rem; color: #e5a93b; line-height: 1.4;">
                    🏛️ <strong>Refund Bank Details:</strong>
                    Please enter your Sri Lankan bank account details below so StylePulse Administration can process and transfer your refund.
                </div>

                <!-- Bank Details Form -->
                <form id="sp-bank-refund-form" style="display: flex; flex-direction: column; gap: 12px;">
                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: #ccc; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Bank Name *</label>
                        <select id="refund-bank-name" required style="width: 100%; padding: 10px 12px; background: #1c1a14; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #fff; font-size: 0.85rem; outline: none;">
                            <option value="" disabled selected>Select Your Bank</option>
                            <option value="Commercial Bank of Ceylon">Commercial Bank of Ceylon</option>
                            <option value="Bank of Ceylon (BOC)">Bank of Ceylon (BOC)</option>
                            <option value="Sampath Bank">Sampath Bank</option>
                            <option value="Hatton National Bank (HNB)">Hatton National Bank (HNB)</option>
                            <option value="Nations Trust Bank (NTB)">Nations Trust Bank (NTB)</option>
                            <option value="People's Bank">People's Bank</option>
                            <option value="Seylan Bank">Seylan Bank</option>
                            <option value="DFCC Bank">DFCC Bank</option>
                            <option value="National Development Bank (NDB)">National Development Bank (NDB)</option>
                            <option value="Pan Asia Bank">Pan Asia Bank</option>
                            <option value="Other Bank">Other Bank</option>
                        </select>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: #ccc; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Branch Name / Code *</label>
                            <input type="text" id="refund-branch-name" placeholder="e.g. Colombo 03" required style="width: 100%; padding: 10px 12px; background: #1c1a14; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #fff; font-size: 0.85rem; outline: none; box-sizing: border-box;" />
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: #ccc; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Account Number *</label>
                            <input type="text" id="refund-account-num" placeholder="e.g. 1000234567" required style="width: 100%; padding: 10px 12px; background: #1c1a14; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #fff; font-size: 0.85rem; outline: none; box-sizing: border-box;" />
                        </div>
                    </div>

                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: #ccc; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Account Holder Name *</label>
                        <input type="text" id="refund-holder-name" value="${clientName}" placeholder="Full name as shown on passbook" required style="width: 100%; padding: 10px 12px; background: #1c1a14; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #fff; font-size: 0.85rem; outline: none; box-sizing: border-box;" />
                    </div>
                </form>
            ` : `
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 12px; padding: 16px; margin-bottom: 18px;">
                    <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #f87171; font-size: 0.95rem;">
                        <span>⚠️</span> <span>Late Cancellation (0% Refund)</span>
                    </div>
                    <p style="font-size: 0.82rem; color: #ccc; margin: 6px 0 0 0; line-height: 1.45;">
                        ${preview ? preview.policyDescription : 'This booking is inside the late cancellation window and is non-refundable.'}
                    </p>
                </div>
                <p style="font-size: 0.85rem; color: #aaa; margin: 0 0 16px 0;">
                    Are you sure you want to cancel this booking? This action cannot be undone.
                </p>
            `}
        `;

        footerElem.innerHTML = `
            <button id="cancel-keep-appt-btn-2" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 9px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.85rem;">Keep Appointment</button>
            <button id="confirm-cancel-submit-btn" style="background: ${isEligible ? 'linear-gradient(135deg, #ffcc00, #ff9900)' : '#e74c3c'}; border: none; color: ${isEligible ? '#000' : '#fff'}; padding: 9px 20px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.85rem;">
                ${isEligible ? 'Confirm & Request Refund' : 'Cancel Appointment'}
            </button>
        `;

        modal.querySelector('#cancel-keep-appt-btn-2').onclick = () => modal.remove();

        modal.querySelector('#confirm-cancel-submit-btn').onclick = async () => {
            let bankDetails = null;

            if (isEligible) {
                const bankNameElem = modal.querySelector('#refund-bank-name');
                const branchNameElem = modal.querySelector('#refund-branch-name');
                const accountNumElem = modal.querySelector('#refund-account-num');
                const holderNameElem = modal.querySelector('#refund-holder-name');

                const bankName = bankNameElem ? bankNameElem.value : '';
                const branchName = branchNameElem ? branchNameElem.value.trim() : '';
                const accountNumber = accountNumElem ? accountNumElem.value.trim() : '';
                const accountHolderName = holderNameElem ? holderNameElem.value.trim() : '';

                if (!bankName || !branchName || !accountNumber || !accountHolderName) {
                    alert("Please fill in all bank details so we can transfer your refund.");
                    return;
                }

                bankDetails = { bankName, branchName, accountNumber, accountHolderName };
            }

            const btn = modal.querySelector('#confirm-cancel-submit-btn');
            btn.disabled = true;
            btn.textContent = "Processing...";

            try {
                const res = await fetch(`${API_ROOT}/api/appointments/${appointmentId}/cancel`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${activeToken}`
                    },
                    body: JSON.stringify({ bankDetails })
                });

                const data = await res.json();
                modal.remove();

                if (data.success) {
                    showAlert(data.message, "success", 7000);
                    loadCustomerAppointments();
                } else {
                    showAlert(data.message || "Failed to cancel appointment", "error");
                }
            } catch (err) {
                btn.disabled = false;
                btn.textContent = isEligible ? 'Confirm & Request Refund' : 'Cancel Appointment';
                showAlert("Server error while cancelling appointment.", "error");
            }
        };
    };

    // ── NLP REVIEW MODAL LOGIC ────────────────────────────────────────────────
    window.openReviewModal = function(salonId, appointmentId, salonName) {
        const existing = document.getElementById('sp-review-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'sp-review-modal';
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.85);
            display: flex; align-items: center; justify-content: center;
            z-index: 10000; backdrop-filter: blur(8px);
        `;

        modal.innerHTML = `
            <div style="background: #111116; border: 1px solid rgba(255,204,0,0.3); border-radius: 16px; width: 90%; max-width: 460px; padding: 2rem; color: #fff; box-shadow: 0 20px 60px rgba(0,0,0,0.8);">
                <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.3rem; color: #ffcc00;">Rate Your Experience</h3>
                <p style="color: #aaa; font-size: 0.85rem; margin-bottom: 1.2rem;">How was your visit at <strong>${salonName || 'the salon'}</strong>?</p>

                <!-- Star Rating -->
                <div id="sp-star-container" style="display: flex; gap: 8px; font-size: 1.8rem; cursor: pointer; margin-bottom: 1.2rem; justify-content: center;">
                    <span data-v="1" style="color: #444; transition: color 0.15s;">★</span>
                    <span data-v="2" style="color: #444; transition: color 0.15s;">★</span>
                    <span data-v="3" style="color: #444; transition: color 0.15s;">★</span>
                    <span data-v="4" style="color: #444; transition: color 0.15s;">★</span>
                    <span data-v="5" style="color: #444; transition: color 0.15s;">★</span>
                </div>

                <!-- Review Textarea -->
                <textarea id="sp-review-text" placeholder="Share your experience (e.g., 'Loved the haircut, very clean salon and friendly staff!')..." style="width: 100%; height: 90px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #fff; padding: 10px; font-size: 0.85rem; resize: none; box-sizing: border-box; margin-bottom: 1.2rem;"></textarea>

                <!-- Action Buttons -->
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cancel-review-btn" style="padding: 10px 18px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #aaa; font-size: 0.85rem; cursor: pointer;">Skip</button>
                    <button id="submit-review-btn" style="padding: 10px 22px; background: linear-gradient(135deg, #ffcc00, #ff9900); border: none; border-radius: 8px; color: #000; font-weight: 700; font-size: 0.85rem; cursor: pointer;">Submit Review</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        let selectedRating = 5;
        const stars = modal.querySelectorAll('#sp-star-container span');
        const textarea = modal.querySelector('#sp-review-text');
        const submitBtn = modal.querySelector('#submit-review-btn');

        function updateStars(val) {
            stars.forEach(s => {
                s.style.color = parseInt(s.getAttribute('data-v')) <= val ? '#ffcc00' : '#444';
            });
        }
        updateStars(selectedRating);

        stars.forEach(s => {
            s.addEventListener('click', () => {
                selectedRating = parseInt(s.getAttribute('data-v'));
                updateStars(selectedRating);
            });
        });

        modal.querySelector('#cancel-review-btn').addEventListener('click', () => modal.remove());

        submitBtn.addEventListener('click', async () => {
            submitBtn.textContent = 'Analyzing feedback…';
            submitBtn.disabled = true;

            try {
                const res = await fetch(`${API_ROOT}/api/reviews`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        salonId,
                        appointmentId,
                        rating: selectedRating,
                        reviewText: textarea.value.trim()
                    })
                });

                const data = await res.json();
                if (data.success) {
                    modal.remove();
                    showAlert('✓ Review analyzed and submitted successfully!', 'success');
                    loadCustomerAppointments();
                } else {
                    alert(data.message || 'Failed to submit review.');
                    submitBtn.textContent = 'Submit Feedback';
                    submitBtn.disabled = false;
                }
            } catch (err) {
                console.error(err);
                alert('Connection error submitting review.');
                submitBtn.textContent = 'Submit Feedback';
                submitBtn.disabled = false;
            }
        });
    };

    // Global tab switcher
    window.switchTab = function(status) {
        activeFilterStatus = status;
        const btns = document.querySelectorAll(".tab-btn");
        btns.forEach(b => {
            if ((b.getAttribute("data-status") || "").toLowerCase() === status.toLowerCase()) {
                b.classList.add("active");
                b.style.color = "#ffcc00";
            } else {
                b.classList.remove("active");
                b.style.color = "rgba(255,255,255,0.6)";
            }
        });
        renderAppointments();
    };

    // Set up tab button listeners
    const btns = document.querySelectorAll(".tab-btn");
    btns.forEach(btn => {
        btn.addEventListener("click", () => {
            const status = btn.getAttribute("data-status") || "Upcoming";
            window.switchTab(status);
        });
    });

    // Load on init
    loadCustomerAppointments();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}

// Helper for showing alerts (reused from auth scripts)
function showAlert(message, type = 'success', duration = 3000) {
    const alertBox = document.getElementById('alert-box');
    const alertMsg = document.getElementById('alert-message');
    const alertIcon = document.getElementById('alert-icon');

    if (!alertBox || !alertMsg || !alertIcon) return;

    alertBox.className = 'alert-box';
    
    if (type === 'success') {
        alertBox.classList.add('success');
        alertIcon.innerHTML = '✅';
    } else {
        alertBox.classList.add('error');
        alertIcon.innerHTML = '⚠️';
    }

    alertMsg.textContent = message;
    alertBox.classList.add('show');

    setTimeout(() => {
        alertBox.classList.remove('show');
    }, duration);
}
