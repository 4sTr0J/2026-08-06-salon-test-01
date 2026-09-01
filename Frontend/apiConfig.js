/**
 * StylePulse Global API Configuration
 * Automatically detects whether running locally or on cloud/production.
 */
(function() {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Check if custom backend URL is saved in localStorage, or fallback dynamically
    window.STYLEPULSE_API_BASE = localStorage.getItem('stylepulse_api_base') || 
        (isLocal ? 'http://localhost:5001' : window.location.origin.replace(':3000', ':5001'));
})();
