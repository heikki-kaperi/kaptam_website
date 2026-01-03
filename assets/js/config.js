/**
 * API Configuration
 * Manages API endpoints for development and production
 */

(function() {
  'use strict';

  // Detect environment
  const hostname = window.location.hostname;
  const isDevelopment = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');

  // API Base URLs
  const API_URLS = {
    development: 'http://localhost:3000',
    production: 'https://kaptam.fi:3000' // Or use a subdomain like 'https://api.kaptam.fi'
  };

  // Get current API URL based on environment
  const API_BASE_URL = isDevelopment ? API_URLS.development : API_URLS.production;

  // Export configuration
  window.KaptamConfig = {
    API_BASE_URL: API_BASE_URL,
    isDevelopment: isDevelopment,

    // API Endpoints
    endpoints: {
      health: `${API_BASE_URL}/api/health`,
      dateAvailability: `${API_BASE_URL}/api/dates/availability`,
      submitCart: `${API_BASE_URL}/api/cart/submit`,
      getCart: (code) => `${API_BASE_URL}/api/cart/${code}`,
      updateCart: (code) => `${API_BASE_URL}/api/cart/${code}`,

      // Admin endpoints
      adminLogin: `${API_BASE_URL}/api/admin/login`,
      adminVerify: `${API_BASE_URL}/api/admin/verify`,
      adminReservations: `${API_BASE_URL}/api/admin/reservations`,
      adminReservation: (code) => `${API_BASE_URL}/api/admin/reservations/${code}`,
      adminStatistics: `${API_BASE_URL}/api/admin/statistics`
    }
  };

  // Log environment on page load
  console.log(`[Kaptam] Environment: ${isDevelopment ? 'Development' : 'Production'}`);
  console.log(`[Kaptam] API Base URL: ${API_BASE_URL}`);

})();
