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

        const filtered = customerAppointments.filter(a => {
            const status = (a.booking_status || "").toLowerCase();
            if (activeFilterStatus.toLowerCase() === "upcoming") {
                return status === "upcoming" || status === "confirmed" || status === "pending";
            }
            return status === activeFilterStatus.toLowerCase();
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
            const isUpcoming = (a.booking_status || "").toLowerCase() === "upcoming" || (a.booking_status || "").toLowerCase() === "confirmed";
            
            const reviewButtonHtml = isCompleted 
                ? (a.isReviewed 
                    ? `<span style="margin-top: 8px; font-size: 0.8rem; font-weight: 700; color: #2ecc71;">✓ Reviewed</span>`
                    : `<button onclick="openReviewModal('${a.salon_id}', '${a.id}', '${a.service_name.replace(/'/g, "\\'")}', '${a.salon_name ? a.salon_name.replace(/'/g, "\\'") : 'StylePulse Salon'}')" style="margin-top: 8px; background: linear-gradient(135deg, #ffc845, #e5a93b); border: none; color: #000; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 700;">⭐ Rate &amp; Review</button>`
                  )
                : '';

            const cancelButtonHtml = isUpcoming
                ? `<button onclick="window.handleCancelAppointment('${a.id}')" style="margin-top: 8px; margin-left: 8px; background: rgba(231,76,60,0.1); border: 1px solid rgba(231,76,60,0.5); color: #e74c3c; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 700; transition: all 0.3s;" onmouseover="this.style.background='rgba(231,76,60,0.2)'" onmouseout="this.style.background='rgba(231,76,60,0.1)'">❌ Cancel</button>`
                : '';

            return `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 1.25rem; border-radius: 12px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <h4 style="color: #ffcc00; font-family: 'Outfit', sans-serif; font-size: 1.1rem; margin: 0;">🏢 ${a.salon_name || 'StylePulse Salon'}</h4>
                        <p style="margin: 0.2rem 0; font-weight: 500; font-size: 0.95rem; color: #fff;">💇 ${a.service_name}</p>
                        <p style="margin: 0; font-size: 0.82rem; color: rgba(255,255,255,0.5);">📍 ${a.salon_address || 'Address not listed'}</p>
                    </div>
                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                        <span style="font-size: 0.9rem; font-weight: 600; color: #fff; display: block;">⏱ ${dateFormatted} at ${a.appointment_time}</span>
                        <span style="display: inline-block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; margin-top: 6px; background: rgba(255,184,43,0.15); color: #ffcc00; border: 1px solid rgba(255,184,43,0.3);">${a.booking_status}</span>
                        <div>
                            ${reviewButtonHtml}
                            ${cancelButtonHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
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
