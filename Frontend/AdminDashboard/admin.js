/* ==========================================================================
   StylePulse — Super Admin Control Portal JavaScript (admin.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const adminLoginContainer = document.getElementById('admin-login-container');
    const adminDashboardContainer = document.getElementById('admin-dashboard-container');
    const adminLoginForm = document.getElementById('admin-login-form');
    const adminPasswordInput = document.getElementById('admin-password');
    const adminAlert = document.getElementById('admin-alert');
    const logoutBtn = document.getElementById('admin-logout-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const searchInput = document.getElementById('search-input');
    const filterTabs = document.querySelectorAll('.filter-tab');
    const ownersTableBody = document.getElementById('owners-table-body');

    // Stats Elements
    const statPendingCount = document.getElementById('stat-pending-count');
    const statApprovedCount = document.getElementById('stat-approved-count');
    const statTotalCount = document.getElementById('stat-total-count');

    let currentFilter = 'all';
    let searchQuery = '';
    let autoPollInterval = null;

    // Initial Auth Check
    checkAdminAuthStatus();

    // 1. Admin Login Submission
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const pwd = adminPasswordInput.value.trim();

            if (!pwd) {
                showAdminAlert('Please enter the Master Security Password.', 'error');
                return;
            }

            if (pwd === 'admin123' || pwd.length >= 6) {
                sessionStorage.setItem('stylepulse_admin_session', 'true');
                showAdminAlert('Authenticated successfully! Loading Master Control Center...', 'success');
                setTimeout(() => {
                    checkAdminAuthStatus();
                }, 600);
            } else {
                showAdminAlert('Invalid Master Password. Access Denied.', 'error');
            }
        });
    }

    // 2. Admin Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('stylepulse_admin_session');
            if (autoPollInterval) clearInterval(autoPollInterval);
            checkAdminAuthStatus();
        });
    }

    // 3. Manual Refresh
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadAndRenderDashboard();
            showAdminAlert('Dashboard refreshed successfully!', 'success');
        });
    }

    // 4. Search Filter
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            renderTable();
        });
    }

    // 5. Filter Tabs
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.getAttribute('data-filter') || 'all';
            renderTable();
        });
    });

    // 6. Registration Date Sort Change
    const sortRegistered = document.getElementById('sort-registered');
    if (sortRegistered) {
        sortRegistered.addEventListener('change', () => {
            renderTable();
        });
    }

    // Real-time synchronization across browser tabs
    window.addEventListener('storage', (e) => {
        if (e.key === 'stylepulse_pending_owners') {
            updateStats();
            renderTable();
        }
    });

    // Event Delegation for Table Action Buttons
    if (ownersTableBody) {
        ownersTableBody.addEventListener('click', (e) => {
            const btn = e.target.closest('.action-btn');
            if (!btn) return;

            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');
            
            if (!id) return;

            if (action === 'approve') {
                handleApproveOwner(id);
            } else if (action === 'reject' || action === 'revoke') {
                handleRejectOwner(id);
            }
        });
    }

    let ownersList = [];

    // Check Auth State
    function checkAdminAuthStatus() {
        const isLoggedIn = sessionStorage.getItem('stylepulse_admin_session') === 'true';
        if (isLoggedIn) {
            adminLoginContainer.classList.add('hidden');
            adminDashboardContainer.classList.remove('hidden');
            loadAndRenderDashboard();
            
            if (!autoPollInterval) {
                autoPollInterval = setInterval(() => {
                    loadAndRenderDashboard();
                }, 3000);
            }
        } else {
            if (autoPollInterval) clearInterval(autoPollInterval);
            autoPollInterval = null;
            adminDashboardContainer.classList.add('hidden');
            adminLoginContainer.classList.remove('hidden');
        }
    }

    // Load & Render Dashboard Data
    async function loadAndRenderDashboard() {
        try {
            const response = await fetch('http://localhost:5001/api/admin/owners');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    ownersList = data.owners || [];
                    updateStats();
                    renderTable();
                }
            }
        } catch (err) {
            console.error("Failed to load owners:", err);
        }
    }

    function updateStats() {
        const pending = ownersList.filter(o => o.is_approved === false).length;
        const approved = ownersList.filter(o => o.is_approved === true).length;

        if (statPendingCount) statPendingCount.textContent = pending;
        if (statApprovedCount) statApprovedCount.textContent = approved;
        if (statTotalCount) statTotalCount.textContent = ownersList.length;
    }

    function renderTable() {
        if (!ownersTableBody) return;
        let owners = [...ownersList];

        // Apply Filter Tab
        if (currentFilter === 'pending') {
            owners = owners.filter(o => o.is_approved === false);
        } else if (currentFilter === 'approved') {
            owners = owners.filter(o => o.is_approved === true);
        }

        // Apply Search Query
        if (searchQuery) {
            owners = owners.filter(o => 
                (o.full_name && o.full_name.toLowerCase().includes(searchQuery)) ||
                (o.email && o.email.toLowerCase().includes(searchQuery)) ||
                (o.phone && o.phone.toLowerCase().includes(searchQuery))
            );
        }

        // Apply Sorting by Registration Date
        const sortSelect = document.getElementById('sort-registered');
        if (sortSelect) {
            const sortVal = sortSelect.value;
            owners.sort((a, b) => {
                const dateA = new Date(a.created_at || 0);
                const dateB = new Date(b.created_at || 0);
                return sortVal === 'oldest' ? dateA - dateB : dateB - dateA;
            });
        }

        if (owners.length === 0) {
            ownersTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-table-cell">
                        ✨ No Salon Owner registration requests found matching your filter.
                    </td>
                </tr>
            `;
            return;
        }

        ownersTableBody.innerHTML = owners.map(o => `
            <tr>
                <td>
                    <div class="contact-cell">
                        <span class="owner-name-cell">🏢 ${o.salon_name || 'Luxury Salon'}</span>
                        <span style="font-size:0.8rem; color:var(--text-muted);">👤 Owner: ${o.full_name || 'N/A'}</span>
                    </div>
                </td>
                <td>
                    <span style="font-family:monospace; font-weight:bold; color:var(--gold-bright); font-size:0.85rem;">
                        📜 ${o.salon_reg_id || `SLN-${o.id.substring(0,6).toUpperCase()}`}
                    </span>
                </td>
                <td>
                    <span style="font-size:0.82rem; color:rgba(255,255,255,0.85);">
                        📍 ${o.salon_address || 'Pending Address...'}
                    </span>
                </td>
                <td>
                    <div class="contact-cell">
                        <span class="contact-email">📧 ${o.email}</span>
                        <span class="contact-phone">📱 ${o.phone || 'N/A'}</span>
                        ${o.salon_website ? `<a href="${o.salon_website}" target="_blank" style="font-size:0.75rem; color:var(--gold-bright); text-decoration:none; margin-top:0.2rem; display:inline-block;">🌐 ${o.salon_website}</a>` : ''}
                    </div>
                </td>
                <td>
                    <span class="status-badge ${o.is_approved ? 'approved' : 'pending'}">
                        ${o.is_approved ? '✓ VERIFIED & APPROVED' : '⏳ PENDING VERIFICATION'}
                    </span>
                </td>
                <td>
                    <div class="table-actions">
            ${!o.is_approved ? `
                <button type="button" class="action-btn approve" data-action="approve" data-id="${o.id}">✓ APPROVE OWNER</button>
                <button type="button" class="action-btn reject" data-action="reject" data-id="${o.id}">✕ REJECT</button>
            ` : `
                <button type="button" class="action-btn reject" data-action="revoke" data-id="${o.id}">✕ REMOVE SALON</button>
            `}
                                </div>
                </td>
            </tr>
        `).join('');
    }

    // Action Handler: Approve Owner
    async function handleApproveOwner(id) {
        try {
            const res = await fetch(`http://localhost:5001/api/admin/owners/${id}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                loadAndRenderDashboard();
                showAdminAlert(`✓ SUCCESS: Approved Salon Owner account! Direct login is now enabled.`, 'success');
            } else {
                showAdminAlert(`✕ FAILED: Could not approve owner.`, 'error');
            }
        } catch(e) {
            showAdminAlert(`✕ ERROR: Could not connect to backend.`, 'error');
        }
    }

    // Action Handler: Reject or Revoke Owner
    async function handleRejectOwner(id) {
        if (!confirm("Are you sure you want to completely remove this salon owner registration and revoke their access?")) {
            return;
        }

        try {
            const res = await fetch(`http://localhost:5001/api/admin/owners/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                loadAndRenderDashboard();
                showAdminAlert(`✕ REMOVED: Salon Owner account and profile deleted successfully.`, 'error');
            } else {
                showAdminAlert(`✕ FAILED: Could not remove owner.`, 'error');
            }
        } catch(e) {
            showAdminAlert(`✕ ERROR: Could not connect to backend.`, 'error');
        }
    }

    // Global Expose for Inline Fallbacks
    window.adminApproveOwner = handleApproveOwner;
    window.adminRejectOwner = handleRejectOwner;

    function showAdminAlert(msg, type = 'error') {
        if (!adminAlert) return;
        adminAlert.textContent = msg;
        adminAlert.className = `admin-alert ${type}`;
        setTimeout(() => {
            if (adminAlert) adminAlert.className = 'admin-alert hidden';
        }, 5000);
    }
});
