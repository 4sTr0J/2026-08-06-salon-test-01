/**
 * StylePulse Centralized API Resolver (api.js)
 * Provides automatic resolution between local development and cloud production.
 */
(function() {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Automatically detect backend or allow custom override via localStorage
    const savedApi = localStorage.getItem('stylepulse_api_base');
    
    // Default fallback:
    // If local -> http://localhost:5001
    // If cloud -> Use relative or configured backend
    const defaultApi = isLocal 
        ? 'http://localhost:5001' 
        : (window.STYLEPULSE_PROD_API || window.location.origin);

    window.STYLEPULSE_API_BASE = (savedApi || defaultApi).replace(/\/$/, '');

    /**
     * Helper to get full API URL
     * @param {string} endpoint e.g. '/api/auth/login' or 'api/auth/login'
     */
    window.getApiUrl = function(endpoint) {
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
        return window.STYLEPULSE_API_BASE + cleanEndpoint;
    };
})();
