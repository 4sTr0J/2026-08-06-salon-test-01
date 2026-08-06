document.addEventListener('DOMContentLoaded', () => {
    // 1. Check Authentication Status (Auth Guard)
    const token = localStorage.getItem('stylepulse_token');
    const userStr = localStorage.getItem('stylepulse_user');

    if (!token || !userStr) {
        // Not logged in, redirect to login page
        window.location.href = 'login.html';
        return;
    }

    let user;
    try {
        user = JSON.parse(userStr);
    } catch (e) {
        // Invalid user data
        localStorage.removeItem('stylepulse_token');
        localStorage.removeItem('stylepulse_user');
        window.location.href = 'login.html';
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
                window.location.href = 'index.html';
            }, 1000);
        });
    }
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
