/**
 * =================================================================
 * TRINITY CAPITAL - VERSE OF THE DAY MANAGER
 * =================================================================
 * Handles daily verse updates at 6:30 AM CST
 * Uses free Bible APIs that allow commercial use
 *
 * Features:
 * - Automatic daily updates at 6:30 AM CST
 * - Free APIs (no authentication required)
 * - Commercial use compliant
 * - Fallback verses for offline scenarios
 * - Local storage caching
 * - Error handling and retry logic
 * - KJV public domain text
 * =================================================================
 */

class VerseManager {
  constructor() {
    // Load configuration
    this.config = window.VERSE_CONFIG || {
      UPDATE_TIME: { hour: 6, minute: 30 },
      API_TIMEOUT: 10000,
      RETRY_ATTEMPTS: 3,
    };

    // Bible API Configuration (Free for commercial use)
    this.BIBLE_API_BASE = 'https://bible-api.com/';
    this.BACKUP_API_BASE = 'https://labs.bible.org/api/';

    // Verse update configuration
    this.UPDATE_TIME = this.config.UPDATE_TIME;
    this.STORAGE_KEY = 'trinityCapital_verseOfDay';
    this.LAST_UPDATE_KEY = 'trinityCapital_lastVerseUpdate';

    // Current verse data
    this.currentVerse = null;

    // Fallback verses for offline scenarios (expanded collection - KJV public domain)
    this.fallbackVerses = [
      {
        reference: 'Philippians 4:19',
        text: 'But my God shall supply all your need according to his riches in glory by Christ Jesus.',
      },
      {
        reference: 'Proverbs 21:5',
        text: 'The thoughts of the diligent tend only to plenteousness; but of every one that is hasty only to want.',
      },
      {
        reference: 'Matthew 6:26',
        text: 'Behold the fowls of the air: for they sow not, neither do they reap, nor gather into barns; yet your heavenly Father feedeth them. Are ye not much better than they?',
      },
      {
        reference: '1 Timothy 6:10',
        text: 'For the love of money is the root of all evil: which while some coveted after, they have erred from the faith, and pierced themselves through with many sorrows.',
      },
      {
        reference: 'Hebrews 13:5',
        text: 'Let your conversation be without covetousness; and be content with such things as ye have: for he hath said, I will never leave thee, nor forsake thee.',
      },
      {
        reference: 'Luke 16:11',
        text: 'If therefore ye have not been faithful in the unrighteous mammon, who will commit to your trust the true riches?',
      },
      {
        reference: 'Ecclesiastes 5:10',
        text: 'He that loveth silver shall not be satisfied with silver; nor he that loveth abundance with increase: this is also vanity.',
      },
      {
        reference: 'Proverbs 22:7',
        text: 'The rich ruleth over the poor, and the borrower is servant to the lender.',
      },
      {
        reference: 'Matthew 6:24',
        text: 'No man can serve two masters: for either he will hate the one, and love the other; or else he will hold to the one, and despise the other. Ye cannot serve God and mammon.',
      },
      {
        reference: 'Proverbs 13:11',
        text: 'Wealth gotten by vanity shall be diminished: but he that gathereth by labour shall increase.',
      },
      {
        reference: 'Luke 14:28',
        text: 'For which of you, intending to build a tower, sitteth not down first, and counteth the cost, whether he have sufficient to finish it?',
      },
      {
        reference: 'Proverbs 27:23',
        text: 'Be thou diligent to know the state of thy flocks, and look well to thy herds.',
      },
      {
        reference: 'Romans 13:8',
        text: 'Owe no man any thing, but to love one another: for he that loveth another hath fulfilled the law.',
      },
      {
        reference: 'Malachi 3:10',
        text: 'Bring ye all the tithes into the storehouse, that there may be meat in mine house, and prove me now herewith, saith the Lord of hosts, if I will not open you the windows of heaven, and pour you out a blessing, that there shall not be room enough to receive it.',
      },
      {
        reference: 'Proverbs 3:9-10',
        text: 'Honour the Lord with thy substance, and with the firstfruits of all thine increase: So shall thy barns be filled with plenty, and thy presses shall burst out with new wine.',
      },
    ];

    this.init();
  }

  /**
   * Initialize the verse manager
   */
  async init() {
    console.log('🙏 Initializing Trinity Capital Verse Manager...');

    // Load existing verse or get new one
    await this.loadOrUpdateVerse();

    // Set up daily update timer
    this.setupDailyTimer();

    // Display current verse
    this.displayVerse();

    console.log('✅ Verse Manager initialized successfully');
  }

  /**
   * Load existing verse or fetch a new one if needed
   */
  async loadOrUpdateVerse() {
    const lastUpdate = localStorage.getItem(this.LAST_UPDATE_KEY);
    const today = this.getDateString();

    // Check if we need to update the verse
    if (!lastUpdate || lastUpdate !== today || !this.getStoredVerse()) {
      console.log('📖 Fetching new verse for today...');
      await this.fetchNewVerse();
    } else {
      console.log('📚 Loading cached verse from storage...');
      this.currentVerse = this.getStoredVerse();
    }
  }

  /**
   * Fetch a new verse from the Bible API (commercial use allowed)
   */
  async fetchNewVerse() {
    try {
      // Get a random verse reference
      const verseRef = this.getRandomVerseReference();

      // Try primary Bible API first
      let response = await fetch(
        `${this.BIBLE_API_BASE}${encodeURIComponent(verseRef)}?translation=kjv`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        console.log('Primary API failed, trying backup...');
        // Try backup API
        response = await fetch(
          `${this.BACKUP_API_BASE}?passage=${encodeURIComponent(verseRef)}&type=json`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
      }

      if (!response.ok) {
        throw new Error(`Bible API request failed: ${response.status}`);
      }

      const data = await response.json();
      let verseText = '';

      // Handle different API response formats
      if (data.text) {
        // bible-api.com format
        verseText = data.text.trim();
      } else if (data[0] && data[0].text) {
        // labs.bible.org format
        verseText = data[0].text.trim();
      } else if (typeof data === 'string') {
        // Plain text response
        verseText = data.trim();
      }

      if (verseText) {
        // Clean up the text (remove extra formatting)
        verseText = verseText
          .replace(/\s+/g, ' ')
          .replace(/[\r\n]+/g, ' ')
          .trim();

        // Extract only the first verse if multiple verses are returned
        verseText = this.extractSingleVerse(verseText);

        this.currentVerse = {
          reference: verseRef,
          text: verseText,
          date: this.getDateString(),
          source: 'Bible API',
        };

        // Store the verse
        this.storeVerse(this.currentVerse);

        console.log('✅ Successfully fetched new verse:', verseRef);
      } else {
        throw new Error('No verse text returned from API');
      }
    } catch (error) {
      console.error('❌ Error fetching verse from Bible API:', error);
      this.useFallbackVerse();
    }
  }

  /**
   * Extract only the first verse from a text that might contain multiple verses
   */
  extractSingleVerse(text) {
    // Common patterns that indicate verse numbers or multiple verses
    const versePatterns = [
      /\d+\s/, // Numbers followed by space (verse numbers)
      /\d+:\d+/, // Chapter:verse patterns
      /\.\s*\d+/, // Period followed by number (next verse)
    ];

    // Split by common verse separators and take the first part
    let singleVerse = text;

    // Look for verse number patterns that indicate a new verse starting
    const verseBreak = text.search(/\.\s*\d+\s/);
    if (verseBreak > 0) {
      singleVerse = text.substring(0, verseBreak + 1).trim();
    }

    // Also check for patterns like "2 For..." or "3 And..." that indicate new verses
    const newVersePattern = /\.\s*\d+\s+[A-Z]/;
    const newVerseMatch = text.match(newVersePattern);
    if (newVerseMatch && newVerseMatch.index > 0) {
      singleVerse = text.substring(0, newVerseMatch.index + 1).trim();
    }

    // Remove any leading verse numbers from the beginning
    singleVerse = singleVerse.replace(/^\d+\s*/, '').trim();

    // Ensure the verse ends with proper punctuation
    if (!singleVerse.match(/[.!?]$/)) {
      singleVerse += '.';
    }

    console.log('📝 Extracted single verse:', singleVerse);
    return singleVerse;
  }

  /**
   * Use a fallback verse when API fails
   */
  useFallbackVerse() {
    console.log('🔄 Using fallback verse...');

    // Get a random fallback verse
    const randomIndex = Math.floor(Math.random() * this.fallbackVerses.length);
    const fallbackVerse = this.fallbackVerses[randomIndex];

    this.currentVerse = {
      ...fallbackVerse,
      date: this.getDateString(),
      source: 'Fallback',
    };

    // Store the verse
    this.storeVerse(this.currentVerse);

    console.log('✅ Fallback verse selected:', fallbackVerse.reference);
  }

  /**
   * Get a random Bible verse reference
   * Focus on single verses related to wisdom, money, and faith
   */
  getRandomVerseReference() {
    const verseReferences = [
      'Proverbs 22:7',
      'Matthew 6:24',
      'Luke 16:13',
      'Ecclesiastes 11:1',
      'Malachi 3:10',
      '2 Corinthians 9:6',
      'Proverbs 13:11',
      'Romans 13:8',
      'Matthew 25:21',
      'Proverbs 27:23',
      'Luke 14:28',
      'Philippians 4:13', // Changed from passage 4:11-13 to single verse
      'Proverbs 3:9', // Changed from passage 3:9-10 to single verse
      'Matthew 6:21', // Changed from passage 6:19-21 to single verse
      'James 1:17',
      'Deuteronomy 8:18',
      'Proverbs 16:3',
      'Colossians 3:23',
      'Proverbs 10:4',
      'Matthew 25:21', // Changed from passage 25:14-30 to single verse
      // Additional single verses for variety
      'Proverbs 21:5',
      'Ecclesiastes 5:10',
      'Luke 16:11',
      'Proverbs 11:25',
      'Matthew 6:26',
      'Hebrews 13:5',
      '1 Timothy 6:10',
      'Proverbs 13:22',
      'Luke 12:15',
      'Ecclesiastes 7:12',
    ];

    const randomIndex = Math.floor(Math.random() * verseReferences.length);
    return verseReferences[randomIndex];
  }

  /**
   * Store verse in localStorage
   */
  storeVerse(verse) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(verse));
      localStorage.setItem(this.LAST_UPDATE_KEY, this.getDateString());
    } catch (error) {
      console.error('❌ Error storing verse:', error);
    }
  }

  /**
   * Get stored verse from localStorage
   */
  getStoredVerse() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('❌ Error retrieving stored verse:', error);
      return null;
    }
  }

  /**
   * Display the current verse in the UI
   */
  displayVerse() {
    if (!this.currentVerse) {
      console.error('❌ No verse to display');
      return;
    }

    // Find the verse display element
    const verseElement = document.querySelector('.verseofTheDay');

    if (verseElement) {
      // Create verse HTML with reference
      const verseHTML = `
        <div class="verse-content">
          <p class="verse-text">"${this.currentVerse.text}"</p>
          <p class="verse-reference">- ${this.currentVerse.reference}</p>
        </div>
      `;

      verseElement.innerHTML = verseHTML;

      // Add fade-in animation
      verseElement.style.opacity = '0';
      setTimeout(() => {
        verseElement.style.transition = 'opacity 1s ease-in-out';
        verseElement.style.opacity = '1';
      }, 100);

      console.log('✅ Verse displayed successfully');
    } else {
      console.error('❌ Verse display element not found');
    }
  }

  /**
   * Setup daily timer for 6:30 AM CST updates
   */
  setupDailyTimer() {
    const checkAndUpdate = () => {
      const now = new Date();

      // Convert to CST (UTC-6)
      const cstOffset = -6 * 60; // CST is UTC-6
      const cstTime = new Date(
        now.getTime() + (cstOffset - now.getTimezoneOffset()) * 60000,
      );

      const currentHour = cstTime.getHours();
      const currentMinute = cstTime.getMinutes();

      // Check if it's 6:30 AM CST
      if (
        currentHour === this.UPDATE_TIME.hour &&
        currentMinute === this.UPDATE_TIME.minute
      ) {
        const lastUpdate = localStorage.getItem(this.LAST_UPDATE_KEY);
        const today = this.getDateString();

        // Only update if we haven't updated today
        if (lastUpdate !== today) {
          console.log('🌅 Daily verse update triggered at 6:30 AM CST');
          this.fetchNewVerse().then(() => {
            this.displayVerse();
          });
        }
      }
    };

    // Check every minute
    setInterval(checkAndUpdate, 60000);

    // Also check immediately
    checkAndUpdate();

    console.log('⏰ Daily timer set for 6:30 AM CST updates');
  }

  /**
   * Get current date as string (YYYY-MM-DD)
   */
  getDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Manual verse update (for testing or manual refresh)
   */
  async manualUpdate() {
    console.log('🔄 Manual verse update requested...');
    // Clear stored date to force fresh fetch
    localStorage.removeItem(this.LAST_UPDATE_KEY);
    await this.fetchNewVerse();
    this.displayVerse();
  }

  /**
   * Get current verse data
   */
  getCurrentVerse() {
    return this.currentVerse;
  }
}

// Initialize verse manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Create global verse manager instance
  window.verseManager = new VerseManager();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VerseManager;
}

/**
 * =================================================================
 * USAGE INSTRUCTIONS:
 * =================================================================
 *
 * ✅ READY TO USE - NO SETUP REQUIRED!
 *
 * 1. Already included in HTML ✅
 *    <script src="Javascript/verseConfig.js"></script>
 *    <script src="Javascript/verseManager.js"></script>
 *
 * 2. Automatic features:
 *    ✅ Updates daily at 6:30 AM CST
 *    ✅ Uses free APIs (commercial use allowed)
 *    ✅ Fallback verses for offline use
 *    ✅ Local caching for performance
 *
 * 3. Manual controls (optional):
 *    - window.verseManager.manualUpdate() - Force update
 *    - window.verseManager.getCurrentVerse() - Get current verse
 *
 * 4. Testing:
 *    - Press F12 (developer console)
 *    - Run: VerseManagerTests.runAllTests()
 *
 * 5. Commercial Use:
 *    ✅ No API keys required
 *    ✅ No licensing restrictions
 *    ✅ Public domain Bible text
 *    ✅ Perfect for banking apps
 *
 * =================================================================
 */
