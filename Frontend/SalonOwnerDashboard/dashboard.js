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
    const API_BASE = "http://localhost:5000/api/owner";

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

    // Add Service Form
    const addServiceForm = document.getElementById("add-service-form");

    // Set Owner Profile info in headers
    ownerNameDisplay.textContent = user.fullName || "Owner";
    ownerEmailDisplay.textContent = user.email || "";

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
                        salonRegId: settingSalonRegId.value
                    })
                });

                const data = await res.json();
                if (data.success) {
                    showAlert("✓ Success: Salon details updated!", "success");
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
                    <td colspan="6" class="empty-table-cell">No appointments have been booked at your salon yet.</td>
                </tr>
            `;
            return;
        }

        appointmentsTableBody.innerHTML = appointments.map(a => {
            const dateFormatted = new Date(a.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
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
                </tr>
            `;
        }).join('');
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

    // 7. Global Modal Helper Functions
    window.openModal = function (id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add("show");
    };

    window.closeModal = function (id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove("show");
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

    // Auto poll updates every 10 seconds
    setInterval(() => {
        loadAppointments();
    }, 10000);
});
