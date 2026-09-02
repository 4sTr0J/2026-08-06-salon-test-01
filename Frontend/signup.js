/* ==========================================================================
   StylePulse — Standalone Signup JavaScript (signup.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const signupForm = document.getElementById('signup-form');
    const fullNameInput = document.getElementById('fullname');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const togglePasswordBtn = document.getElementById('toggle-password-btn');
    const termsCheckbox = document.getElementById('terms-agree');
    const submitBtn = document.getElementById('submit-btn');
    const alertBox = document.getElementById('auth-alert');
    const roleTabs = document.querySelectorAll('.role-tab');

    // Strength Meter DOM Elements
    const strengthBarFill = document.getElementById('strength-bar-fill');
    const strengthLabel = document.getElementById('strength-label');

    // Dynamic Container for Salon Owner Fields
    const salonFieldsContainer = document.getElementById('salon-fields-container');

    let currentAccountType = 'client';

    const SALON_OWNER_FIELDS_HTML = `
        <div id="salon-owner-fields" class="salon-owner-fields" style="margin-top: 1rem; margin-bottom: 1.5rem; padding: 1.2rem; background: rgba(255, 170, 0, 0.05); border: 1px dashed rgba(255, 204, 102, 0.35); border-radius: 12px;">
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--gold-bright); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.4rem;">
                <span>👑</span> SALON BUSINESS VERIFICATION DETAILS
            </div>
            <div class="form-group">
                <label for="salon-name" class="form-label">Salon Business Name</label>
                <div class="input-wrapper">
                    <span class="input-icon">🏢</span>
                    <input type="text" id="salon-name" name="salon-name" class="form-input" placeholder="Aura Luxury Lounge & Spa">
                </div>
            </div>
            <div class="form-group">
                <label for="salon-reg-id" class="form-label">Business License / Registration ID</label>
                <div class="input-wrapper">
                    <span class="input-icon">📜</span>
                    <input type="text" id="salon-reg-id" name="salon-reg-id" class="form-input" placeholder="SLN-98421-2026">
                </div>
            </div>
            <div class="form-group">
                <label for="salon-address" class="form-label">Salon Physical Address</label>
                <div class="input-wrapper">
                    <span class="input-icon">📍</span>
                    <input type="text" id="salon-address" name="salon-address" class="form-input" placeholder="742 Fifth Avenue, Suite 100">
                </div>
            </div>
            <div class="form-group">
                <label for="salon-website" class="form-label">Website / Portfolio Link</label>
                <div class="input-wrapper">
                    <span class="input-icon">🌐</span>
                    <input type="url" id="salon-website" name="salon-website" class="form-input" placeholder="https://aurasalon.com">
                </div>
            </div>
        </div>
    `;

    // Function to render or remove Salon Owner Fields
    function updateFormFieldsForRole(role) {
        if (!salonFieldsContainer) return;
        if (role === 'owner' || role === 'partner' || role === 'salon_owner') {
            salonFieldsContainer.innerHTML = SALON_OWNER_FIELDS_HTML;
        } else {
            salonFieldsContainer.innerHTML = ''; // Completely empty for Client Registration!
        }
    }

    // Initialize with Client mode (empty salon container)
    updateFormFieldsForRole('client');

    // Pre-select tab if URL contains ?type=owner
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('type') === 'owner') {
        roleTabs.forEach(t => t.classList.remove('active'));
        const ownerTab = document.querySelector('.role-tab[data-type="owner"]');
        if (ownerTab) ownerTab.classList.add('active');
        currentAccountType = 'owner';
        updateFormFieldsForRole('owner');
    }

    // 1. Account Type Selector Tabs
    roleTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            roleTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentAccountType = tab.getAttribute('data-type') || 'client';

            updateFormFieldsForRole(currentAccountType);

            showAlert(`Selected Account Type: ${currentAccountType === 'client' ? 'Client Account' : 'Salon Owner (Requires Verification)'}`, 'success', 2500);
        });
    });

    // 2. Toggle Password Visibility
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            if (confirmPasswordInput) {
                confirmPasswordInput.setAttribute('type', isPassword ? 'text' : 'password');
            }
            togglePasswordBtn.textContent = isPassword ? '🔒' : '👁️';
        });
    }

    // 3. Real-Time Password Strength Evaluator
    if (passwordInput && strengthBarFill && strengthLabel) {
        passwordInput.addEventListener('input', () => {
            const val = passwordInput.value;
            const score = evaluatePasswordStrength(val);

            if (val.length === 0) {
                strengthBarFill.style.width = '0%';
                strengthBarFill.style.backgroundColor = '#ef4444';
                strengthLabel.textContent = 'Password strength: Too short';
                return;
            }

            if (score <= 2) {
                strengthBarFill.style.width = '33%';
                strengthBarFill.style.backgroundColor = '#ef4444';
                strengthLabel.textContent = 'Password strength: Weak';
            } else if (score <= 4) {
                strengthBarFill.style.width = '66%';
                strengthBarFill.style.backgroundColor = '#eab308';
                strengthLabel.textContent = 'Password strength: Medium';
            } else {
                strengthBarFill.style.width = '100%';
                strengthBarFill.style.backgroundColor = '#22c55e';
                strengthLabel.textContent = 'Password strength: Strong & Secure';
            }
        });
    }

    function evaluatePasswordStrength(pwd) {
        let score = 0;
        if (pwd.length >= 8) score += 2;
        if (/[A-Z]/.test(pwd)) score += 1;
        if (/[0-9]/.test(pwd)) score += 1;
        if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
        return score;
    }

    // 4. Form Submission Handler
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const fullName = fullNameInput.value.trim();
            const email = emailInput.value.trim();
            const phone = phoneInput ? phoneInput.value.trim() : '';
            const password = passwordInput.value.trim();
            const confirmPassword = confirmPasswordInput.value.trim();

            if (!fullName) {
                showAlert('Please enter your full name.', 'error');
                fullNameInput.focus();
                return;
            }

            if (!email || !email.includes('@')) {
                showAlert('Please enter a valid email address.', 'error');
                emailInput.focus();
                return;
            }

            if (password.length < 8) {
                showAlert('Password must be at least 8 characters long.', 'error');
                passwordInput.focus();
                return;
            }

            if (password !== confirmPassword) {
                showAlert('Passwords do not match. Please re-enter.', 'error');
                confirmPasswordInput.focus();
                return;
            }

            if (termsCheckbox && !termsCheckbox.checked) {
                showAlert('You must agree to the Terms of Service & Privacy Policy to continue.', 'error');
                return;
            }

            // Prepare Registration Payload
            let salonData = {};
            if (currentAccountType === 'owner' || currentAccountType === 'partner' || currentAccountType === 'salon_owner') {
                const salonNameInput = document.getElementById('salon-name');
                const salonRegIdInput = document.getElementById('salon-reg-id');
                const salonAddressInput = document.getElementById('salon-address');
                const salonWebsiteInput = document.getElementById('salon-website');

                const salonName = salonNameInput ? salonNameInput.value.trim() : '';
                const salonRegId = salonRegIdInput ? salonRegIdInput.value.trim() : '';
                const salonAddress = salonAddressInput ? salonAddressInput.value.trim() : '';
                const salonWebsite = salonWebsiteInput ? salonWebsiteInput.value.trim() : '';

                if (!salonName) {
                    showAlert('Please enter your Salon Business Name for verification.', 'error');
                    if (salonNameInput) salonNameInput.focus();
                    return;
                }

                if (!salonRegId) {
                    showAlert('Please enter your Salon Business License or Registration ID.', 'error');
                    if (salonRegIdInput) salonRegIdInput.focus();
                    return;
                }

                if (!salonAddress) {
                    showAlert('Please enter your Salon Physical Address.', 'error');
                    if (salonAddressInput) salonAddressInput.focus();
                    return;
                }

                salonData = {
                    salonName,
                    salonRegId,
                    salonAddress,
                    salonWebsite
                };
            }

            // Unified Registration Workflow
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="btn-text">CREATING ACCOUNT...</span>`;

            try {
                const apiBase = (window.STYLEPULSE_API_BASE || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://backend-production-8cd3.up.railway.app')).replace(/\/$/, '');
                const response = await fetch(`${apiBase}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        name: fullName, 
                        email, 
                        phone, 
                        password, 
                        role: currentAccountType,
                        ...salonData
                    })
                }).catch(() => null);

                if (response && response.ok) {
                    const data = await response.json();
                    
                    if (currentAccountType === 'owner' || currentAccountType === 'partner' || currentAccountType === 'salon_owner') {
                        showAlert(`VERIFICATION REQUEST SENT! Salon registration for ${salonData.salonName} (${email}) has been requested. You will be enabled to log in once approved by the Admin.`, 'success', 6000);
                        setTimeout(() => {
                            window.location.href = 'login.html?pending=true';
                        }, 3500);
                    } else {
                        localStorage.setItem('stylepulse_token', data.token || 'mock_jwt_token');
                        localStorage.setItem('stylepulse_user', JSON.stringify(data.user || { name: fullName, email, role: 'client' }));
                        showAlert('Client Account created successfully! Redirecting to Dashboard...', 'success', 1500);
                        setTimeout(() => {
                            window.location.href = 'CustomerDashboard/dashboard.html';
                        }, 1500);
                    }
                } else {
                    const errorData = response ? await response.json() : null;
                    const errorMessage = errorData?.message || 'Registration failed. Please try again.';
                    showAlert(errorMessage, 'error', 4000);
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<span class="btn-text">CREATE YOUR ACCOUNT</span><span class="btn-arrow">→</span>`;
                }
            } catch (err) {
                console.error('Registration error:', err);
                showAlert('Failed to create account. Please try again.', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<span class="btn-text">CREATE YOUR ACCOUNT</span><span class="btn-arrow">→</span>`;
            }
        });
    }

    // Helper Alert
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
