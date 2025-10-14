/**
 * =================================================================
 * TRINITY CAPITAL - VERSE MANAGER TEST SUITE
 * =================================================================
 * Test file to verify verse manager functionality
 * Run this in browser console to test the verse system
 * =================================================================
 */

// Test suite for verse manager
const VerseManagerTests = {
  // Test 1: Check if verse manager is loaded
  testManagerLoaded() {
    console.log('🧪 Test 1: Checking if Verse Manager is loaded...');
    if (window.verseManager) {
      console.log('✅ Verse Manager is loaded successfully');
      return true;
    } else {
      console.log('❌ Verse Manager is not loaded');
      return false;
    }
  },

  // Test 2: Check configuration
  testConfiguration() {
    console.log('🧪 Test 2: Checking configuration...');
    if (window.VERSE_CONFIG) {
      console.log('✅ Configuration loaded:', window.VERSE_CONFIG);
      return true;
    } else {
      console.log('❌ Configuration not found');
      return false;
    }
  },

  // Test 3: Test fallback verses
  testFallbackVerses() {
    console.log('🧪 Test 3: Testing fallback verses...');
    if (window.verseManager && window.verseManager.fallbackVerses) {
      console.log(
        '✅ Fallback verses available:',
        window.verseManager.fallbackVerses.length,
        'verses',
      );
      return true;
    } else {
      console.log('❌ Fallback verses not available');
      return false;
    }
  },

  // Test 4: Test manual verse update
  async testManualUpdate() {
    console.log('🧪 Test 4: Testing manual verse update...');
    if (window.verseManager) {
      try {
        await window.verseManager.manualUpdate();
        console.log('✅ Manual update completed');
        return true;
      } catch (error) {
        console.log('❌ Manual update failed:', error);
        return false;
      }
    } else {
      console.log('❌ Verse Manager not available');
      return false;
    }
  },

  // Test 5: Check current verse
  testCurrentVerse() {
    console.log('🧪 Test 5: Checking current verse...');
    if (window.verseManager) {
      const verse = window.verseManager.getCurrentVerse();
      if (verse) {
        console.log('✅ Current verse available:');
        console.log('   Reference:', verse.reference);
        console.log('   Source:', verse.source);
        console.log('   Date:', verse.date);
        return true;
      } else {
        console.log('❌ No current verse available');
        return false;
      }
    } else {
      console.log('❌ Verse Manager not available');
      return false;
    }
  },

  // Test 6: Check verse display element
  testVerseDisplay() {
    console.log('🧪 Test 6: Checking verse display element...');
    const verseElement = document.querySelector('.verseofTheDay');
    if (verseElement) {
      console.log('✅ Verse display element found');
      console.log('   Content:', verseElement.innerHTML ? 'Present' : 'Empty');
      return true;
    } else {
      console.log('❌ Verse display element not found');
      console.log(
        '   Make sure you have an element with class "verseofTheDay" in your HTML',
      );
      return false;
    }
  },

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting Verse Manager Test Suite...');
    console.log('==================================================');

    const results = {
      passed: 0,
      failed: 0,
      total: 6,
    };

    // Run tests
    if (this.testManagerLoaded()) results.passed++;
    else results.failed++;
    if (this.testConfiguration()) results.passed++;
    else results.failed++;
    if (this.testFallbackVerses()) results.passed++;
    else results.failed++;
    if (await this.testManualUpdate()) results.passed++;
    else results.failed++;
    if (this.testCurrentVerse()) results.passed++;
    else results.failed++;
    if (this.testVerseDisplay()) results.passed++;
    else results.failed++;

    // Results
    console.log('==================================================');
    console.log('📊 Test Results:');
    console.log(`   ✅ Passed: ${results.passed}/${results.total}`);
    console.log(`   ❌ Failed: ${results.failed}/${results.total}`);

    if (results.failed === 0) {
      console.log('🎉 All tests passed! Verse Manager is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Check the logs above for details.');
    }

    return results;
  },

  // Quick setup check
  quickCheck() {
    console.log('⚡ Quick Setup Check:');
    console.log('1. Verse Manager loaded:', !!window.verseManager);
    console.log('2. Configuration loaded:', !!window.VERSE_CONFIG);
    console.log(
      '3. API Key set:',
      window.VERSE_CONFIG?.ESV_API_KEY !== 'YOUR_ESV_API_KEY_HERE',
    );
    console.log(
      '4. Display element exists:',
      !!document.querySelector('.verseofTheDay'),
    );
  },
};

// Make available globally for console testing
if (typeof window !== 'undefined') {
  window.VerseManagerTests = VerseManagerTests;
}

// Auto-run quick check when loaded
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    console.log('📖 Trinity Capital Verse Manager - Test Suite Ready');
    console.log(
      '💡 Run VerseManagerTests.runAllTests() in console to test everything',
    );
    console.log(
      '⚡ Run VerseManagerTests.quickCheck() for a quick status check',
    );

    // Auto quick check
    VerseManagerTests.quickCheck();
  }, 2000);
});

/**
 * =================================================================
 * USAGE INSTRUCTIONS FOR TESTING:
 * =================================================================
 *
 * 1. Open browser developer console (F12)
 *
 * 2. Run quick check:
 *    VerseManagerTests.quickCheck()
 *
 * 3. Run full test suite:
 *    VerseManagerTests.runAllTests()
 *
 * 4. Test individual components:
 *    VerseManagerTests.testManagerLoaded()
 *    VerseManagerTests.testCurrentVerse()
 *
 * 5. Force manual verse update:
 *    window.verseManager.manualUpdate()
 *
 * 6. Get current verse:
 *    window.verseManager.getCurrentVerse()
 *
 * =================================================================
 */
