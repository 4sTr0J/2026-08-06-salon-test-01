document.addEventListener('DOMContentLoaded', () => {
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

    const emailDisplay = document.getElementById('user-email-display');
    if (emailDisplay) emailDisplay.textContent = user.email;

    // Logout Logic
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('stylepulse_token');
            localStorage.removeItem('stylepulse_user');
            showAlert('Logging out...', 'success', 1000);
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 1000);
        });
    }

    // Alert helper
    function showAlert(message, type = 'success', duration = 3000) {
        const alertBox = document.getElementById('alert-box');
        const alertMessage = document.getElementById('alert-message');
        const alertIcon = document.getElementById('alert-icon');
        
        if (!alertBox || !alertMessage || !alertIcon) return;

        alertMessage.textContent = message;
        
        alertBox.classList.remove('success', 'error');
        alertBox.classList.add(type);
        
        if (type === 'success') {
            alertIcon.innerHTML = '✅';
        } else {
            alertIcon.innerHTML = '⚠️';
        }

        alertBox.classList.add('show');
        
        setTimeout(() => {
            alertBox.classList.remove('show');
        }, duration);
    }

    // Loyalty API Base URL
    const API_ROOT = (window.STYLEPULSE_API_BASE || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://backend-production-8cd3.up.railway.app')).replace(/\/$/, '');
    const LOYALTY_API = `${API_ROOT}/api/loyalty`;
    const customerId = user.id || user.email;
    const userEmail = user.email || '';

    async function loadAccountData() {
        try {
            const res = await fetch(`${LOYALTY_API}/account/${customerId}`);
            if (!res.ok) {
                console.error("Account not found. It will be created upon first earning.");
                return;
            }
            const data = await res.json();
            
            if (data.account) {
                document.getElementById('points-balance').textContent = data.account.available_points;
                document.getElementById('current-tier').textContent = data.account.current_tier;
                document.getElementById('lifetime-points').textContent = data.account.lifetime_points;
            }

            // History
            const historyList = document.getElementById('history-list');
            if (data.history && data.history.length > 0) {
                historyList.innerHTML = data.history.map(h => `
                    <div style="border-bottom: 1px solid rgba(255,255,255,0.1); padding: 12px 0; display: flex; justify-content: space-between;">
                        <div>
                            <div style="color: #fff; font-weight: 500;">${h.description}</div>
                            <div style="font-size: 0.8rem; color: #888;">${new Date(h.created_at).toLocaleDateString()}</div>
                        </div>
                        <div style="font-weight: bold; color: ${h.points > 0 ? '#2ecc71' : '#e74c3c'}">
                            ${h.points > 0 ? '+' : ''}${h.points} Style Points
                        </div>
                    </div>
                `).join('');
            }
        } catch (err) {
            console.error("Error loading account:", err);
        }
    }

    // Initial load
    loadAccountData();
});
