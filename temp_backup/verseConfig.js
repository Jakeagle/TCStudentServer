/**
 * =================================================================
 * TRINITY CAPITAL - VERSE MANAGER CONFIGURATION
 * =================================================================
 * Configuration for the Verse Manager
 * Now uses free Bible APIs that allow commercial use
 * =================================================================
 */

// Bible API Configuration (Commercial use allowed)
const VERSE_CONFIG = {
  // Update schedule (6:30 AM CST)
  UPDATE_TIME: {
    hour: 6,
    minute: 30,
    timezone: 'CST', // Central Standard Time
  },

  // Cache settings
  CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours in milliseconds

  // API settings
  API_TIMEOUT: 10000, // 10 seconds
  RETRY_ATTEMPTS: 3,

  // Feature flags
  ENABLE_FALLBACK: true,
  ENABLE_CACHING: true,
  ENABLE_LOGGING: true,
};

/**
 * =================================================================
 * SETUP INSTRUCTIONS:
 * =================================================================
 *
 * ✅ NO API KEY REQUIRED!
 * This system now uses free Bible APIs that allow commercial use:
 *
 * 1. Primary API: bible-api.com
 *    - Completely free
 *    - No registration required
 *    - Commercial use allowed
 *    - KJV and other translations
 *
 * 2. Backup API: labs.bible.org
 *    - Free Bible API
 *    - No authentication needed
 *    - Reliable fallback option
 *
 * 3. Built-in Fallback:
 *    - 15+ verses stored locally
 *    - Public domain KJV text
 *    - Works offline
 *
 * 4. Commercial Use:
 *    ✅ Fully compliant for commercial banking apps
 *    ✅ No licensing restrictions
 *    ✅ Public domain Bible text (KJV)
 *
 * =================================================================
 */

// Export configuration
if (typeof window !== 'undefined') {
  window.VERSE_CONFIG = VERSE_CONFIG;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VERSE_CONFIG;
}
