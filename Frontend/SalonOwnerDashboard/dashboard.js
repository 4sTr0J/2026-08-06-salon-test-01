/*
 * StylePulse - Salon Owner Dashboard Core Logic
 */

document.addEventListener("DOMContentLoaded", () => {
    // Auth Guard
    const token = localStorage.getItem("stylepulse_token");
    const userString = localStorage.getItem("stylepulse_user");
    let user = null;

    if (userString) {
        try {
            user = JSON.parse(userString);
        } catch (e) {
            user = null;
        }
    }

    if (!token || !user || user.role !== "owner") {
        window.location.href = "../login.html";
        return;
    }

    // API Base URL
    const API_BASE = "http://localhost:5001/api/owner";

    // DOM Elements
    const ownerNameDisplay = document.getElementById("owner-name-display");
    const ownerEmailDisplay = document.getElementById("owner-email-display");
    const salonNameTitle = document.getElementById("salon-name-title");
    const logoutBtn = document.getElementById("logout-btn");
    const alertBox = document.getElementById("alert-box");
    const alertIcon = document.getElementById("alert-icon");
    const alertMessage = document.getElementById("alert-message");

    // Form inputs
    const settingsForm = document.getElementById("salon-settings-form");
    const settingSalonName = document.getElementById("setting-salon-name");
    const settingSalonRegId = document.getElementById("setting-salon-reg-id");
    const settingSalonAddress = document.getElementById("setting-salon-address");
    const settingSalonWebsite = document.getElementById("setting-salon-website");
    const settingOperatingStart = document.getElementById("setting-operating-start");
    const settingOperatingEnd = document.getElementById("setting-operating-end");

    // Drag & Drop DOM Elements
    const dragDropZone = document.getElementById("image-drag-drop-zone");
    const fileInput = document.getElementById("salon-image-file");
    const previewContainer = document.getElementById("drag-drop-preview-container");
    const previewImg = document.getElementById("drag-drop-preview");
    const placeholder = document.getElementById("drag-drop-placeholder");

    // Add Service Form
    const addServiceForm = document.getElementById("add-service-form");

    // Set Owner Profile info in headers
    ownerNameDisplay.textContent = user.fullName || "Owner";
    ownerEmailDisplay.textContent = user.email || "";

    // Drag & Drop state and listeners
    let salonImageBase64 = "";

    if (dragDropZone && fileInput) {
        dragDropZone.addEventListener("click", () => fileInput.click());

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dragDropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dragDropZone.addEventListener(eventName, () => dragDropZone.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dragDropZone.addEventListener(eventName, () => dragDropZone.classList.remove('dragover'), false);
        });

        dragDropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files[0]) {
                handleFile(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (fileInput.files && fileInput.files[0]) {
                handleFile(fileInput.files[0]);
            }
        });

        function handleFile(file) {
            if (!file.type.startsWith('image/')) {
                showAlert("Please select a valid image file.", "error");
                return;
            }

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = () => {
                const base64data = reader.result;
                salonImageBase64 = base64data;
                
                previewImg.src = base64data;
                previewContainer.style.display = "flex";
                placeholder.style.display = "none";
            };
        }
    }

    // 1. Sidebar Tab Switching Logic
    const menuItems = document.querySelectorAll(".menu-item");
    const tabSections = document.querySelectorAll(".tab-section");

    menuItems.forEach((item) => {
        item.addEventListener("click", () => {
            const targetTab = item.getAttribute("data-tab");
            
            menuItems.forEach((i) => i.classList.remove("active"));
            item.classList.add("active");

            tabSections.forEach((section) => {
                section.classList.remove("active");
                if (section.id === `tab-${targetTab}`) {
                    section.classList.add("active");
                }
            });
        });
    });

    // 2.5 Fetch Cancellation Policy
    async function loadCancellationPolicy() {
        try {
            const res = await fetch(`http://localhost:5001/api/cancellation-policy/active?salon_id=${user.id}`);
            const data = await res.json();
            if (data.policy) {
                document.getElementById('setting-cancellation-policy').value = data.policy.policy_type;
            } else {
                document.getElementById('setting-cancellation-policy').value = 'flexible';
            }
        } catch (err) {
            console.error("Failed to load policy:", err);
            document.getElementById('setting-cancellation-policy').value = 'flexible';
        }
    }

    // 2. Fetch Salon Info
    async function loadSalonDetails() {
        try {
            const res = await fetch(`${API_BASE}/salon`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && data.salon) {
                const s = data.salon;
                salonNameTitle.textContent = s.salon_name || "Premium Luxury Salon";
                
                // Populate Settings Form
                settingSalonName.value = s.salon_name || "";
                settingSalonRegId.value = s.salon_reg_id || "";
                settingSalonAddress.value = s.salon_address || "";
                settingSalonWebsite.value = s.salon_website || "";
                
                if (s.salon_image) {
                    salonImageBase64 = s.salon_image;
                    previewImg.src = s.salon_image;
                    document.getElementById("owner-profile-preview").src = s.salon_image;
                    previewContainer.style.display = "flex";
                    placeholder.style.display = "none";
                } else {
                    salonImageBase64 = "";
                    document.getElementById("owner-profile-preview").src = "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=50&q=80";
                    previewContainer.style.display = "none";
                    placeholder.style.display = "block";
                }
                
                loadCancellationPolicy();
            }
        } catch (err) {
            console.error("Failed to load salon details:", err);
            showAlert("Failed to retrieve salon profile.", "error");
        }
    }

    // 3. Update Salon Info
    if (settingsForm) {
        settingsForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            try {
                const res = await fetch(`${API_BASE}/salon`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        salonName: settingSalonName.value,
                        salonAddress: settingSalonAddress.value,
                        salonWebsite: settingSalonWebsite.value,
                        salonRegId: settingSalonRegId.value,
                        salonImage: salonImageBase64
                    })
                });

                const data = await res.json();
                if (data.success) {
                    // Update cancellation policy as well
                    const selectedPolicy = document.getElementById('setting-cancellation-policy').value;
                    await fetch("http://localhost:5001/api/cancellation-policy", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            salon_id: user.id,
                            policy_type: selectedPolicy
                        })
                    });
                    
                    showAlert("✓ Success: Settings updated successfully", "success");
                    loadSalonDetails();
                } else {
                    showAlert(data.message || "Failed to update salon profile.", "error");
                }
            } catch (err) {
                console.error("Update salon error:", err);
                showAlert("Server error during update.", "error");
            }
        });
    }

    // 4. Services Logic
    const servicesTableBody = document.getElementById("services-table-body");
    const statActiveServices = document.getElementById("stat-active-services");

    async function loadServices() {
        try {
            const res = await fetch(`${API_BASE}/services`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && data.services) {
                renderServicesTable(data.services);
                statActiveServices.textContent = data.services.length;
            }
        } catch (err) {
            console.error("Failed to load services:", err);
            showAlert("Failed to retrieve service menu.", "error");
        }
    }

    function renderServicesTable(services) {
        if (!servicesTableBody) return;
        if (services.length === 0) {
            servicesTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-table-cell">No services offered yet. Click '+ Add New Service' to build your menu.</td>
                </tr>
            `;
            return;
        }

        servicesTableBody.innerHTML = services.map(s => `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td>⏱ ${s.duration} Mins</td>
                <td><strong>Rs. ${parseFloat(s.price).toLocaleString()}</strong></td>
                <td>
                    <button class="btn-delete" data-id="${s.id}">Delete</button>
                </td>
            </tr>
        `).join('');

        // Attach Delete Listeners
        const deleteBtns = servicesTableBody.querySelectorAll(".btn-delete");
        deleteBtns.forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                if (confirm("Are you sure you want to delete this service?")) {
                    await deleteService(id);
                }
            });
        });
    }

    async function deleteService(id) {
        try {
            const res = await fetch(`${API_BASE}/services/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                showAlert("Service deleted successfully.", "success");
                loadServices();
            } else {
                showAlert(data.message || "Failed to delete service.", "error");
            }
        } catch (err) {
            console.error("Delete service error:", err);
            showAlert("Connection error.", "error");
        }
    }

    if (addServiceForm) {
        console.log("Add Service form found and listener binding active.");
        
        const submitService = async () => {
            const nameEl = document.getElementById("service-name");
            const durationEl = document.getElementById("service-duration");
            const priceEl = document.getElementById("service-price");

            if (!nameEl || !durationEl || !priceEl) {
                console.error("Form input elements not found!");
                return;
            }

            const name = nameEl.value.trim();
            const duration = durationEl.value;
            const price = priceEl.value;

            console.log("Submitting service details:", { name, duration, price });

            if (!name || !duration || !price) {
                showAlert("Please fill in all fields.", "error");
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/services`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ name, duration, price })
                });

                const data = await res.json();
                console.log("Response from add service API:", data);

                if (data.success) {
                    showAlert("Service created successfully", "success");
                    closeModal("add-service-modal");
                    addServiceForm.reset();
                    loadServices();
                } else {
                    showAlert(data.message || "Failed to add service.", "error");
                }
            } catch (err) {
                console.error("Add service error:", err);
                showAlert("Server connection failed.", "error");
            }
        };

        addServiceForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            console.log("Form submit event captured.");
            await submitService();
        });

        // Backup click listener directly on the action button
        const submitBtn = addServiceForm.querySelector(".action-btn");
        if (submitBtn) {
            submitBtn.addEventListener("click", async (e) => {
                console.log("Submit button click captured.");
                // Let form submission handle it if browser supports it,
                // but if not, trigger manually.
                if (!addServiceForm.checkValidity()) {
                    addServiceForm.reportValidity();
                    return;
                }
                e.preventDefault();
                await submitService();
            });
        }
    } else {
        console.error("Add Service form NOT found in DOM!");
    }

    // 5. Appointments & Dashboard Stats
    const appointmentsTableBody = document.getElementById("appointments-table-body");
    const todayBookingsList = document.getElementById("today-bookings-list");
    const statTodayAppointments = document.getElementById("stat-today-appointments");
    const statTotalClients = document.getElementById("stat-total-clients");
    const statRevenue = document.getElementById("stat-revenue");

    let appointmentsList = [];

    async function loadAppointments() {
        try {
            const res = await fetch(`${API_BASE}/appointments`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && data.appointments) {
                appointmentsList = data.appointments;
                calculateStats(appointmentsList);
                renderAppointmentsTable(appointmentsList);
                renderTodayBookings(appointmentsList);
                renderAnalyticsChart(appointmentsList);
            }
        } catch (err) {
            console.error("Failed to load appointments:", err);
            showAlert("Failed to retrieve booking calendar.", "error");
        }
    }

    function calculateStats(appointments) {
        const todayStr = new Date().toDateString();
        
        // Today's appointments count
        const todayAppointments = appointments.filter(a => new Date(a.date).toDateString() === todayStr);
        statTodayAppointments.textContent = todayAppointments.length;

        // Unique clients
        const uniqueClients = new Set(appointments.map(a => a.user_id));
        statTotalClients.textContent = uniqueClients.size;

        // Estimated revenue from all confirmed/completed appointments
        const revenue = appointments
            .filter(a => a.status === 'Confirmed' || a.status === 'completed')
            .reduce((sum, a) => sum + parseFloat(a.price || 0), 0);
        statRevenue.textContent = `Rs. ${revenue.toLocaleString()}`;
    }

    function renderAppointmentsTable(appointments) {
        if (!appointmentsTableBody) return;
        if (appointments.length === 0) {
            appointmentsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-table-cell">No appointments have been booked at your salon yet.</td>
                </tr>
            `;
            return;
        }

        appointmentsTableBody.innerHTML = appointments.map(a => {
            const dateFormatted = new Date(a.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            const isPending = a.status === 'Confirmed' || a.status === 'Upcoming' || a.status === 'Pending';
            const actionBtnHtml = isPending
                ? `<button class="btn-complete-order" data-id="${a.id}" style="background: linear-gradient(135deg, #2ecc71, #27ae60); border: none; color: #fff; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 700; transition: transform 0.2s;">Order completed</button>`
                : `<span style="font-size: 0.8rem; color: rgba(255,255,255,0.4); font-weight: 600;">—</span>`;

            return `
                <tr>
                    <td>
                        <div class="contact-cell">
                            <strong>👤 ${a.client_name}</strong>
                            <span style="font-size:0.75rem; color:rgba(255,255,255,0.5);">📞 ${a.client_phone}</span>
                        </div>
                    </td>
                    <td>${a.service}</td>
                    <td>💇 ${a.stylist}</td>
                    <td>📅 ${dateFormatted} at <strong>${a.time}</strong></td>
                    <td><strong>Rs. ${parseFloat(a.price || 0).toLocaleString()}</strong></td>
                    <td>
                        <span class="status-badge ${a.status.toLowerCase()}">${a.status}</span>
                    </td>
                    <td>
                        ${actionBtnHtml}
                    </td>
                </tr>
            `;
        }).join('');

        // Wire click listeners for Complete buttons
        const completeBtns = appointmentsTableBody.querySelectorAll(".btn-complete-order");
        completeBtns.forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                btn.disabled = true;
                btn.textContent = "Updating...";

                try {
                    const res = await fetch(`${API_BASE}/appointments/${id}/status`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({ status: "Completed" })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showAlert("✓ Order marked as Completed!", "success");
                        loadAppointments(); // reload stats & list
                    } else {
                        showAlert(data.message || "Failed to update appointment status.", "error");
                        btn.disabled = false;
                        btn.textContent = "Order completed";
                    }
                } catch (err) {
                    console.error("Complete status update error:", err);
                    showAlert("Server communication error.", "error");
                    btn.disabled = false;
                    btn.textContent = "Order completed";
                }
            });
        });
    }

    function renderTodayBookings(appointments) {
        if (!todayBookingsList) return;
        const todayStr = new Date().toDateString();
        const todayApps = appointments.filter(a => new Date(a.date).toDateString() === todayStr);

        if (todayApps.length === 0) {
            todayBookingsList.innerHTML = `
                <div class="empty-list-message">No appointments scheduled for today.</div>
            `;
            return;
        }

        todayBookingsList.innerHTML = todayApps.map(a => `
            <div class="booking-item-mini">
                <div class="booking-client-info">
                    <h4>👤 ${a.client_name}</h4>
                    <p>💇 Service: ${a.service} (with ${a.stylist})</p>
                </div>
                <div class="booking-time-status">
                    <span class="booking-time-tag">⏱ ${a.time}</span>
                    <div style="font-size:0.7rem; margin-top:0.2rem;" class="status-badge ${a.status.toLowerCase()}">${a.status}</div>
                </div>
            </div>
        `).join('');
    }

    // 6. Analytics Chart (Chart.js)
    let myChart = null;

    function renderAnalyticsChart(appointments) {
        const ctx = document.getElementById('analyticsChart');
        if (!ctx) return;

        // Group revenue by date for the last 7 days
        const labels = [];
        const revenueData = [];
        const bookingCountData = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toDateString();
            const dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            
            labels.push(dateLabel);

            const dayApps = appointments.filter(a => new Date(a.date).toDateString() === dateStr);
            const dayRevenue = dayApps
                .filter(a => a.status === 'Confirmed' || a.status === 'completed')
                .reduce((sum, a) => sum + parseFloat(a.price || 0), 0);

            revenueData.push(dayRevenue);
            bookingCountData.push(dayApps.length);
        }

        if (myChart) {
            myChart.destroy();
        }

        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Estimated Revenue ($)',
                        data: revenueData,
                        backgroundColor: 'rgba(255, 184, 43, 0.65)',
                        borderColor: '#ffcc00',
                        borderWidth: 1.5,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Total Bookings',
                        data: bookingCountData,
                        type: 'line',
                        fill: false,
                        borderColor: '#a78bfa',
                        tension: 0.2,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#ffffff', font: { family: 'Poppins' } }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#ffcc00' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { color: '#a78bfa' }
                    }
                }
            }
        });
    }

    // 10. Customer Reviews & NLP Summaries
    const reviewsFeed = document.getElementById("reviews-feed-container");
    const serviceFilter = document.getElementById("review-service-filter");
    const nlpRating = document.getElementById("nlp-avg-rating");
    const nlpReviewCount = document.getElementById("nlp-review-count");
    const nlpPros = document.getElementById("nlp-top-pros");
    const nlpCons = document.getElementById("nlp-top-cons");

    let allReviews = [];

    async function loadReviews() {
        if (!reviewsFeed) return;
        try {
            // Fetch reviews
            const res = await fetch(`http://localhost:5001/api/reviews/salon/${user.id}`);
            const data = await res.json();
            if (data.success && data.reviews) {
                allReviews = data.reviews;
                populateServiceFilter(allReviews);
                renderReviewsFeed();
            }
        } catch (err) {
            console.error("Failed to load reviews:", err);
        }
    }

    async function loadReviewSummary() {
        if (!nlpRating) return;
        try {
            const res = await fetch(`http://localhost:5001/api/reviews/salon/${user.id}/summary`);
            const data = await res.json();
            if (data.success) {
                nlpRating.textContent = data.averageRating > 0 ? data.averageRating.toFixed(1) : "0.0";
                nlpReviewCount.textContent = `${data.reviewCount || 0} reviews`;

                // Render pros
                if (data.pros && data.pros.length > 0) {
                    nlpPros.innerHTML = data.pros.map(p => `
                        <span style="font-size:0.75rem; background:rgba(46,204,113,0.15); color:#2ecc71; border:1px solid rgba(46,204,113,0.3); padding:4px 10px; border-radius:20px; text-transform:capitalize; font-weight:600;">✓ ${p}</span>
                    `).join('');
                } else {
                    nlpPros.innerHTML = `<span style="font-size:0.75rem; color:#888;">No positive highlights yet</span>`;
                }

                // Render cons
                if (data.cons && data.cons.length > 0) {
                    nlpCons.innerHTML = data.cons.map(c => `
                        <span style="font-size:0.75rem; background:rgba(231,76,60,0.15); color:#e74c3c; border:1px solid rgba(231,76,60,0.3); padding:4px 10px; border-radius:20px; text-transform:capitalize; font-weight:600;">⚠️ ${c}</span>
                    `).join('');
                } else {
                    nlpCons.innerHTML = `<span style="font-size:0.75rem; color:#888;">No negative highlights yet</span>`;
                }
            }
        } catch (err) {
            console.error("Failed to load reviews summary:", err);
        }
    }

    function populateServiceFilter(reviews) {
        if (!serviceFilter) return;
        // Keep "all" option
        const currentVal = serviceFilter.value;
        serviceFilter.innerHTML = `<option value="all">All Services</option>`;
        
        // Find unique service names from appointments/reviews (retrieve appointment service names)
        const services = [...new Set(reviews.map(r => r.review_text.includes("dragon Tatto") ? "dragon Tatto" : "General").filter(Boolean))];
        
        // Let's also fetch from the active service list to populate options
        const uniqueServices = new Set();
        reviews.forEach(r => {
            // Find if there is an appointment linked or search review text / match with known services
            // Standard approach: we can look up unique service_name from reviews if stored or extract
            // For now, let's extract unique service_name from active appointments list as dropdown options
            appointmentsList.forEach(a => {
                if (a.service) uniqueServices.add(a.service);
            });
        });

        Array.from(uniqueServices).sort().forEach(s => {
            const opt = document.createElement("option");
            opt.value = s.toLowerCase().trim();
            opt.textContent = s;
            serviceFilter.appendChild(opt);
        });

        if (currentVal && serviceFilter.querySelector(`option[value="${currentVal}"]`)) {
            serviceFilter.value = currentVal;
        }
    }

    function renderReviewsFeed() {
        if (!reviewsFeed) return;
        const filterVal = serviceFilter.value;

        let filtered = [...allReviews];
        if (filterVal !== "all") {
            // Map review text or linked appointments
            filtered = filtered.filter(r => {
                // Check if appointment service matches
                const apt = appointmentsList.find(a => a.id === r.appointment_id);
                return apt && apt.service.toLowerCase().trim() === filterVal;
            });
        }

        if (filtered.length === 0) {
            reviewsFeed.innerHTML = `
                <div style="text-align:center; padding:40px; color:#888; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:12px;">
                    No customer reviews match this service category.
                </div>
            `;
            return;
        }

        reviewsFeed.innerHTML = filtered.map(r => {
            const dateFormatted = new Date(r.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            
            // Find service name
            const apt = appointmentsList.find(a => a.id === r.appointment_id);
            const serviceName = apt ? apt.service : "General Service";

            const sentimentEmoji = r.sentiment === 'Positive' ? '😊' : r.sentiment === 'Negative' ? '😞' : '😐';
            const sentimentColor = r.sentiment === 'Positive' ? '#2ecc71' : r.sentiment === 'Negative' ? '#e74c3c' : '#9ca3af';

            const starsHtml = Array.from({ length: 5 }, (_, idx) => 
                `<span style="color:${idx < r.rating ? '#ffcc00' : 'rgba(255,255,255,0.15)'}; font-size:1.1rem;">★</span>`
            ).join('');

            const prosHtml = (r.pros && r.pros.length > 0)
                ? r.pros.map(p => `<span style="font-size:0.7rem; background:rgba(46,204,113,0.1); color:#2ecc71; border:1px solid rgba(46,204,113,0.2); padding:3px 8px; border-radius:12px; text-transform:capitalize;">${p}</span>`).join('')
                : '';

            const consHtml = (r.cons && r.cons.length > 0)
                ? r.cons.map(c => `<span style="font-size:0.7rem; background:rgba(231,76,60,0.1); color:#e74c3c; border:1px solid rgba(231,76,60,0.2); padding:3px 8px; border-radius:12px; text-transform:capitalize;">${c}</span>`).join('')
                : '';

            return `
                <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:12px; padding:1.5rem; display:flex; flex-direction:column; gap:12px; transition:transform 0.2s;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                        <div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <strong style="color:#fff;">👤 ${r.customer_name}</strong>
                                <span style="font-size:0.78rem; background:rgba(255,184,43,0.12); color:#ffcc00; border:1px solid rgba(255,184,43,0.2); padding:2px 8px; border-radius:10px;">💇 ${serviceName}</span>
                            </div>
                            <div style="margin-top:4px;">${starsHtml}</div>
                        </div>
                        <div style="text-align:right; font-size:0.8rem; color:rgba(255,255,255,0.4);">
                            <span>⏱ ${dateFormatted}</span>
                            <div style="font-size:0.75rem; color:${sentimentColor}; font-weight:600; margin-top:2px;">Sentiment: ${sentimentEmoji} ${r.sentiment}</div>
                        </div>
                    </div>
                    
                    <p style="margin:0; font-size:0.9rem; color:rgba(255,255,255,0.85); line-height:1.4;">"${r.review_text}"</p>

                    ${(prosHtml || consHtml) ? `
                    <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:4px; border-top:1px solid rgba(255,255,255,0.03); padding-top:10px;">
                        ${prosHtml}
                        ${consHtml}
                    </div>` : ''}
                </div>
            `;
        }).join('');
    }

    if (serviceFilter) {
        serviceFilter.addEventListener("change", renderReviewsFeed);
    }

    // 7. Global Modal Helper Functions
    window.openModal = function (id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add("show");
    };

    window.closeModal = function (id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove("show");
    };

    window.selectPresetImage = function (url) {
        if (settingSalonImage) {
            settingSalonImage.value = url;
            showAlert("✓ Template image selected. Click 'Save Changes' to apply!", "success");
        }
    };

    // 8. Alerts
    let alertTimeout = null;
    function showAlert(message, type = "error") {
        if (!alertBox) return;
        if (alertTimeout) clearTimeout(alertTimeout);
        alertMessage.textContent = message;
        alertBox.className = `alert-box show ${type}`;
        alertTimeout = setTimeout(() => {
            alertBox.className = "alert-box";
        }, 4000);
    }

    // 9. Log Out
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("stylepulse_token");
            localStorage.removeItem("stylepulse_user");
            window.location.href = "../login.html";
        });
    }

    // Init Calls
    loadSalonDetails();
    loadServices();
    loadAppointments();
    loadReviews();
    loadReviewSummary();

    // Auto poll updates every 10 seconds
    setInterval(() => {
        loadAppointments();
        loadReviews();
        loadReviewSummary();
    }, 10000);
});
