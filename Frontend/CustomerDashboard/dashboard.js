document.addEventListener('DOMContentLoaded', () => {
    // 1. Check Authentication Status (Auth Guard)
    const token = localStorage.getItem('stylepulse_token');
    const userStr = localStorage.getItem('stylepulse_user');

    if (!token || !userStr) {
        // Not logged in, redirect to login page
        window.location.href = '../login.html';
        return;
    }

    let user;
    try {
        user = JSON.parse(userStr);
    } catch (e) {
        // Invalid user data
        localStorage.removeItem('stylepulse_token');
        localStorage.removeItem('stylepulse_user');
        window.location.href = '../login.html';
        return;
    }

    // 2. Populate User Data in UI
    const nameDisplay = document.getElementById('user-name-display');
    const emailDisplay = document.getElementById('user-email-display');
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const profileRole = document.getElementById('profile-role');

    // Extract first name for the greeting
    const fullName = user.fullName || user.name || user.email.split('@')[0];
    const firstName = fullName.split(' ')[0];

    if (nameDisplay) nameDisplay.textContent = firstName;
    if (emailDisplay) emailDisplay.textContent = user.email;
    
    if (profileName) profileName.textContent = fullName;
    if (profileEmail) profileEmail.textContent = user.email;
    if (profileRole) profileRole.textContent = user.role || 'Customer';

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

    async function loadCustomerAppointments() {
        try {
            const res = await fetch("http://localhost:5001/api/auth/appointments", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && data.appointments) {
                customerAppointments = data.appointments;
                renderAppointments();
                populateNotifications();
                
                // Automatically prompt for review if a completed appointment has not been reviewed
                const pendingReview = customerAppointments.find(a => 
                    (a.booking_status || "").toLowerCase() === "completed" && !a.isReviewed
                );
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
        const pending = customerAppointments.filter(a =>
            (a.booking_status || "").toLowerCase() === "completed" && !a.isReviewed
        );

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

        let filtered = customerAppointments.filter(a => {
            const status = (a.booking_status || "").toLowerCase();
            const isRescheduled = a.is_rescheduled || status === "rescheduled";

            if (currentTab === "rescheduled") {
                return isRescheduled;
            }

            if (currentTab === "upcoming") {
                // If it's rescheduled, it moves to the Rescheduled tab
                if (isRescheduled) return false;
                return status === "upcoming" || status === "confirmed" || status === "pending";
            }

            if (currentTab === "completed") {
                return status === "completed";
            }

            if (currentTab === "cancelled") {
                return status === "cancelled";
            }

            return status === currentTab;
        });

        // Sort appointments:
        // For Upcoming/Rescheduled: Closest upcoming date/time first (ascending chronologically)
        // For Completed/Cancelled: Most recent past appointments first (descending chronologically)
        const getApptTimestamp = (a) => {
            if (!a.appointment_date) return 0;
            const timeStr = a.appointment_time && a.appointment_time !== 'N/A' ? a.appointment_time : '00:00';
            return new Date(`${a.appointment_date}T${timeStr}:00`).getTime();
        };

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
            const isCompleted = (a.booking_status || "").toLowerCase() === "completed";
            const isCancelled = (a.booking_status || "").toLowerCase() === "cancelled";
            const isRescheduled = a.is_rescheduled || (a.booking_status || "").toLowerCase() === "rescheduled";
            const isUpcoming = ((a.booking_status || "").toLowerCase() === "upcoming" || (a.booking_status || "").toLowerCase() === "confirmed") && !isCancelled;
            
            const reviewButtonHtml = isCompleted 
                ? (a.isReviewed 
                    ? `<span style="margin-top: 8px; font-size: 0.8rem; font-weight: 700; color: #2ecc71;">✓ Reviewed</span>`
                    : `<button onclick="openReviewModal('${a.salon_id}', '${a.id}', '${a.service_name.replace(/'/g, "\\'")}', '${a.salon_name ? a.salon_name.replace(/'/g, "\\'") : 'StylePulse Salon'}')" style="margin-top: 8px; background: linear-gradient(135deg, #ffc845, #e5a93b); border: none; color: #000; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 700;">⭐ Rate &amp; Review</button>`
                  )
                : '';

            const reschedCount = a.reschedule_info ? (Number(a.reschedule_info.reschedule_count || a.reschedule_info.total_reschedules) || 1) : 0;
            const maxReached = reschedCount >= 3;

            const rescheduleButtonHtml = isUpcoming
                ? (maxReached
                    ? `<span style="margin-top: 8px; margin-left: 8px; font-size: 0.75rem; color: #888; border: 1px solid rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px; display: inline-block;">🔒 Max Reschedules Reached (3/3)</span>`
                    : `<button onclick="window.openRescheduleModal('${a.id}', '${(a.service_name || '').replace(/'/g, "\\'")}', '${a.salon_id}')" style="margin-top: 8px; margin-left: 8px; background: rgba(52,152,219,0.15); border: 1px solid rgba(52,152,219,0.5); color: #3498db; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 700; transition: all 0.3s;" onmouseover="this.style.background='rgba(52,152,219,0.25)'" onmouseout="this.style.background='rgba(52,152,219,0.15)'">🔄 Reschedule (${3 - reschedCount} left)</button>`
                  )
                : '';

            const cancelButtonHtml = isUpcoming
                ? `<button onclick="window.handleCancelAppointment('${a.id}')" style="margin-top: 8px; margin-left: 8px; background: rgba(231,76,60,0.1); border: 1px solid rgba(231,76,60,0.5); color: #e74c3c; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 700; transition: all 0.3s;" onmouseover="this.style.background='rgba(231,76,60,0.2)'" onmouseout="this.style.background='rgba(231,76,60,0.1)'">❌ Cancel</button>`
                : '';

            const lateButtonHtml = isUpcoming
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

            const statusBadgeText = isRescheduled ? 'RESCHEDULED' : (a.booking_status || 'CONFIRMED');
            const statusBadgeClass = isRescheduled ? 'rescheduled' : (a.booking_status || 'confirmed').toLowerCase();

            return `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 1.25rem; border-radius: 12px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <h4 style="color: #ffcc00; font-family: 'Outfit', sans-serif; font-size: 1.1rem; margin: 0;">🏢 ${a.salon_name || 'StylePulse Salon'}</h4>
                        <p style="margin: 0.2rem 0; font-weight: 500; font-size: 0.95rem; color: #fff;">💇 ${a.service_name}</p>
                        <p style="margin: 0; font-size: 0.82rem; color: rgba(255,255,255,0.5);">📍 ${a.salon_address || 'Address not listed'}</p>
                        <p style="margin: 0.3rem 0 0; font-size: 0.75rem; color: #2ecc71;">🛡️ Includes 30-min buffer window</p>
                        ${rescheduleTagHtml}
                    </div>
                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                        <span style="font-size: 0.9rem; font-weight: 600; color: #fff; display: block;">⏱ ${dateFormatted} at ${a.appointment_time}</span>
                        <span style="display: inline-block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; margin-top: 6px; background: rgba(255,184,43,0.15); color: #ffcc00; border: 1px solid rgba(255,184,43,0.3);">${statusBadgeText}</span>
                        <div style="display: flex; flex-wrap: wrap; justify-content: flex-end;">
                            ${reviewButtonHtml}
                            ${rescheduleButtonHtml}
                            ${lateButtonHtml}
                            ${cancelButtonHtml}
                        </div>
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
                const res = await fetch(`http://localhost:5001/api/appointments/${appointmentId}/running-late`, {
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
            const qRes = await fetch(`http://localhost:5001/api/appointments/${appointmentId}/reschedule-quote`, {
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
            const iso = d.toISOString().split("T")[0];

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
                    const res = await fetch(`http://localhost:5001/api/appointments/available?date=${iso}&salonId=${salonId || ''}`);
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
                const res = await fetch(`http://localhost:5001/api/appointments/${appointmentId}/reschedule`, {
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
                        serviceName: serviceName,
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
        modalDiv.addEventListener('click', (e) => { if (e.target === modalDiv) modalDiv.remove(); });
    }

    // Cancellation logic
    window.handleCancelAppointment = async function(appointmentId) {
        if (!confirm("Are you sure you want to cancel this appointment?")) {
            return;
        }
        
        try {
            const res = await fetch(`http://localhost:5001/api/appointments/${appointmentId}/cancel`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });
            const data = await res.json();
            
            if (data.success) {
                const refund = data.data.refundPercentage;
                const hours = data.data.hoursUntilAppointment;
                
                let message = `Appointment cancelled successfully.`;
                if (refund > 0) {
                    message += ` You will receive a ${refund}% refund since you cancelled ${hours} hours in advance.`;
                } else {
                    message += ` Unfortunately, no refund is applicable due to the salon's cancellation policy.`;
                }
                
                showAlert(message, "success", 4000);
                loadCustomerAppointments(); // reload the appointments to update UI
            } else {
                showAlert(data.message || "Failed to cancel appointment", "error");
            }
        } catch (err) {
            console.error("Cancel Error:", err);
            showAlert("An error occurred while cancelling.", "error");
        }
    };

    // Floating Review Modal script injection helper
    window.openReviewModal = function(salonId, appointmentId, serviceName, salonName) {
        // Close notification dropdown if open
        const notifDrop = document.getElementById("notif-dropdown");
        if (notifDrop) notifDrop.style.display = "none";

        const modalId = 'sp-review-modal';
        let oldModal = document.getElementById(modalId);
        if (oldModal) oldModal.remove();

        const modal = document.createElement('div');
        modal.id = modalId;
        Object.assign(modal.style, {
            position: "fixed", inset: "0", background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifycontent: "center",
            zIndex: "10000", backdropFilter: "blur(10px)", display: "flex",
            justifyContent: "center", alignItems: "center"
        });

        modal.innerHTML = `
            <div style="background: #12110e; border: 1px solid rgba(255, 184, 43, 0.45); border-radius: 18px; padding: 2.2rem; width: 90%; max-width: 440px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); color: #fff; font-family: 'Poppins', sans-serif;">
                <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.5rem; color: #ffcc00; margin: 0 0 0.5rem;">⭐ Write a Review</h3>
                <p style="font-size: 0.88rem; color: rgba(255,255,255,0.6); margin-bottom: 1.5rem;">For ${serviceName} at ${salonName}</p>
                
                <div style="display: flex; flex-direction: column; gap: 1.2rem; text-align: left; margin-bottom: 1.8rem;">
                    <div>
                        <label style="font-size: 0.8rem; color: rgba(255,255,255,0.5); display: block; margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 600;">Rating</label>
                        <div style="display: flex; gap: 8px;" id="review-stars-container">
                            ${[1,2,3,4,5].map(num => `<span class="review-star" data-value="${num}" style="font-size: 1.8rem; cursor: pointer; color: rgba(255,255,255,0.25); transition: color 0.2s;">★</span>`).join('')}
                        </div>
                    </div>
                    <div>
                        <label style="font-size: 0.8rem; color: rgba(255,255,255,0.5); display: block; margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 600;">Your Review &amp; Feedback</label>
                        <textarea id="review-textarea" placeholder="Tell us about your experience..." style="width: 100%; height: 90px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #fff; padding: 10px; font-family: inherit; font-size: 0.9rem; resize: none; box-sizing: border-box; outline: none;"></textarea>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cancel-review-btn" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem;">Cancel</button>
                    <button id="submit-review-btn" style="background: linear-gradient(135deg, #ffc845, #e5a93b); border: none; color: #000; padding: 8px 24px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.9rem; opacity: 0.5; pointer-events: none;">Submit Feedback</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        let selectedRating = 0;
        const stars = modal.querySelectorAll('.review-star');
        const textarea = modal.querySelector('#review-textarea');
        const submitBtn = modal.querySelector('#submit-review-btn');

        stars.forEach(star => {
            star.addEventListener('mouseover', () => {
                const val = parseInt(star.dataset.value);
                stars.forEach((s, idx) => { s.style.color = idx < val ? '#ffcc00' : 'rgba(255,255,255,0.25)'; });
            });
            star.addEventListener('mouseout', () => {
                stars.forEach((s, idx) => { s.style.color = idx < selectedRating ? '#ffcc00' : 'rgba(255,255,255,0.25)'; });
            });
            star.addEventListener('click', () => {
                selectedRating = parseInt(star.dataset.value);
                validate();
            });
        });

        textarea.addEventListener('input', validate);

        function validate() {
            if (selectedRating > 0 && textarea.value.trim().length > 3) {
                submitBtn.style.opacity = '1';
                submitBtn.style.pointerEvents = 'all';
            } else {
                submitBtn.style.opacity = '0.5';
                submitBtn.style.pointerEvents = 'none';
            }
        }

        modal.querySelector('#cancel-review-btn').addEventListener('click', () => modal.remove());

        submitBtn.addEventListener('click', async () => {
            submitBtn.textContent = 'Analyzing feedback…';
            submitBtn.disabled = true;

            try {
                const res = await fetch('http://localhost:5001/api/reviews', {
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

    // Set up tab button listeners
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => {
                b.classList.remove("active");
                b.style.color = "rgba(255,255,255,0.6)";
            });
            btn.classList.add("active");
            btn.style.color = "#ffcc00";
            activeFilterStatus = btn.getAttribute("data-status");
            renderAppointments();
        });
    });

    // Load on init
    loadCustomerAppointments();
});

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
