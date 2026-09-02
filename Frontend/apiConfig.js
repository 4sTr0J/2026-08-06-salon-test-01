/**
 * StylePulse Global API Configuration
 * Supports Localhost (port 5001) and Railway Production (backend-production-8cd3.up.railway.app)
 */
(function() {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Check if custom backend URL is saved in localStorage, or fallback dynamically
    const PROD_BACKEND_URL = 'https://backend-production-8cd3.up.railway.app';

    window.STYLEPULSE_API_BASE = localStorage.getItem('stylepulse_api_base') || 
        (isLocal ? 'http://localhost:5001' : PROD_BACKEND_URL);

    window.getApiUrl = function(endpoint) {
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
        return window.STYLEPULSE_API_BASE + cleanEndpoint;
    };
})();
