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
    const LOYALTY_API = 'http://localhost:5001/api/loyalty';
    const customerId = user.id;

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

            // Vouchers
            const vouchersList = document.getElementById('vouchers-list');
            if (data.vouchers && data.vouchers.length > 0) {
                vouchersList.innerHTML = data.vouchers.map(v => `
                    <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; color: #fff;">Code: ${v.voucher_code}</div>
                            <div style="font-size: 0.85rem; color: #aaa;">Redeemed on: ${new Date(v.redeemed_at).toLocaleDateString()}</div>
                        </div>
                        <span style="background: ${v.status === 'ACTIVE' ? '#2ecc71' : '#e74c3c'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">
                            ${v.status}
                        </span>
                    </div>
                `).join('');
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

    async function loadRewards() {
        try {
            const res = await fetch(`${LOYALTY_API}/rewards`);
            if (!res.ok) throw new Error("Failed to load rewards");
            const data = await res.json();
            
            const rewardsCatalog = document.getElementById('rewards-catalog');
            if (data.rewards && data.rewards.length > 0) {
                rewardsCatalog.innerHTML = data.rewards.map(r => `
                    <div style="background: rgba(255,204,0,0.1); border: 1px solid rgba(255,204,0,0.3); padding: 20px; border-radius: 12px; display: flex; flex-direction: column;">
                        <h3 style="color: #ffcc00; margin-bottom: 8px;">${r.title}</h3>
                        <p style="color: #ddd; font-size: 0.9rem; flex-grow: 1;">${r.description}</p>
                        <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: bold; color: #fff;">${r.points_cost} Style Points</span>
                            <button onclick="redeemReward('${r.id}')" style="background: #ffcc00; color: #000; border: none; padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer;">Redeem</button>
                        </div>
                    </div>
                `).join('');
            } else {
                rewardsCatalog.innerHTML = `<div class="empty-state">No rewards available.</div>`;
            }
        } catch (err) {
            console.error("Error loading rewards:", err);
        }
    }

    window.redeemReward = async (rewardId) => {
        if (!confirm("Are you sure you want to redeem this reward?")) return;
        
        try {
            const res = await fetch(`${LOYALTY_API}/redeem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId, rewardId })
            });
            const data = await res.json();
            
            if (data.success) {
                showAlert(`Success! Your voucher code is: ${data.voucherCode}`, 'success', 5000);
                loadAccountData(); // Reload UI
            } else {
                showAlert(`Error: ${data.error || 'Could not redeem'}`, 'error');
            }
        } catch (err) {
            showAlert('Failed to redeem reward.', 'error');
        }
    };

    // Initial load
    loadAccountData();
    loadRewards();
});
