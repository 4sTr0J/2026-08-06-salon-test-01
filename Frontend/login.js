/* ==========================================================================
   StylePulse — Standalone Login JavaScript (login.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('toggle-password-btn');
    const submitBtn = document.getElementById('submit-btn');
    const alertBox = document.getElementById('auth-alert');
    const roleTabs = document.querySelectorAll('.role-tab');
    const forgotPasswordLink = document.getElementById('forgot-password-link');

    const salonOwnerNotice = document.getElementById('salon-owner-reg-notice');
    let currentRole = 'client';

    // Ensure Salon Owner registration prompt is strictly hidden for Client tab on load
    if (salonOwnerNotice) {
        salonOwnerNotice.classList.add('hidden');
    }

    // 1. Role Selector Tabs
    roleTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            roleTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentRole = tab.getAttribute('data-role');

            if (salonOwnerNotice) {
                if (currentRole === 'owner') {
                    salonOwnerNotice.classList.remove('hidden');
                } else {
                    salonOwnerNotice.classList.add('hidden');
                }
            }

            showAlert(`Switched login role to: ${currentRole === 'client' ? 'Client' : 'Salon Owner'}`, 'success', 2500);
        });
    });

    // 2. Toggle Password Visibility
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            togglePasswordBtn.textContent = isPassword ? '🔒' : '👁️';
        });
    }

    // 3. Forgot Password Link
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            showAlert('Password reset instructions will be sent to your registered email address.', 'success', 4000);
        });
    }

    // Check for pending notification in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('pending') === 'true') {
        showAlert('NOTICE: Registration request sent to Super Admin (annyafernando915@gmail.com). Please wait for approval before logging in.', 'success', 7000);
    }

    // 4. Form Submit Handler
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            if (!email) {
                showAlert('Please enter your email or phone number.', 'error');
                emailInput.focus();
                return;
            }

            if (!password) {
                showAlert('Please enter your password.', 'error');
                passwordInput.focus();
                return;
            }

            // Set loading state on button
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="btn-text">VERIFYING CREDENTIALS...</span>`;



            try {
                // Attempt Express Backend Auth API
                const response = await fetch('http://localhost:5000/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, role: currentRole })
                }).catch(() => null); // Network fallback if server is offline

                if (response && response.ok) {
                    const data = await response.json();
                    localStorage.setItem('stylepulse_token', data.token || 'mock_jwt_token');
                    localStorage.setItem('stylepulse_user', JSON.stringify(data.user || { email, role: currentRole }));
                    const userRole = data.user?.role || currentRole;
                    showAlert('Login successful! Redirecting to dashboard...', 'success', 1500);
                    setTimeout(() => {
                        if (userRole === 'owner') {
                            window.location.href = 'SalonOwnerDashboard/dashboard.html';
                        } else {
                            window.location.href = 'salons.html';
                        }
                    }, 1500);
                } else {
                    const errorData = response ? await response.json() : null;
                    const errorMessage = errorData?.message || 'Invalid email or password. Please try again.';
                    showAlert(errorMessage, 'error', 4000);
                }
            } catch (err) {
                console.error('Login error:', err);
                showAlert('An unexpected error occurred. Please try again.', 'error');
            } finally {
                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<span class="btn-text">LOG IN TO DASHBOARD</span><span class="btn-arrow">→</span>`;
                }, 1500);
            }
        });
    }

    // Helper: Alert Display
    let alertTimeout = null;
    function showAlert(message, type = 'error', duration = 4000) {
        if (!alertBox) return;

        if (alertTimeout) clearTimeout(alertTimeout);

        alertBox.textContent = message;
        alertBox.className = `auth-alert ${type}`;
        
        if (duration > 0) {
            alertTimeout = setTimeout(() => {
                alertBox.className = 'auth-alert hidden';
            }, duration);
        }
    }
});
