/**
 * =================================================================
 * TRINITY CAPITAL - CHECK PAYEE MANAGER
 * =================================================================
 * Manages the "Pay to the order of" dropdown for check deposits
 * Populates with bill vendors and classmates only
 * =================================================================
 */

import { currentProfile } from './script.js';

class CheckPayeeManager {
  constructor() {
    this.payeeDropdown = document.getElementById('name-payto');
    this.billVendorsGroup = document.getElementById('bill-vendors-group');
    this.classmatesGroup = document.getElementById('classmates-group');

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  /**
   * Initialize the payee manager
   */
  async init() {
    console.log('🧾 Initializing Check Payee Manager...');

    if (!this.payeeDropdown) {
      console.warn('Check payee dropdown not found');
      return;
    }

    // Ensure dropdown is interactive by removing any conflicting styles
    this.makeDropdownInteractive();

    // Wait for user profile to be available with better retry logic
    let retryCount = 0;
    const maxRetries = 10;

    while (!currentProfile && retryCount < maxRetries) {
      console.log(
        `Waiting for user profile... (${retryCount + 1}/${maxRetries})`,
      );
      await new Promise(resolve => setTimeout(resolve, 1000));
      retryCount++;
    }

    if (!currentProfile) {
      console.error('❌ User profile not available after waiting');
      // Add some test data for debugging
      this.addTestData();
      return;
    }

    console.log('✅ User profile loaded:', currentProfile.memberName);
    await this.populatePayeeOptions();
    console.log('✅ Check Payee Manager initialized');
  }

  /**
   * Ensure the dropdown is fully interactive
   */
  makeDropdownInteractive() {
    if (!this.payeeDropdown) return;

    // Remove any style properties that might interfere with selection
    this.payeeDropdown.style.pointerEvents = 'auto';
    this.payeeDropdown.style.userSelect = 'auto';
    this.payeeDropdown.style.webkitUserSelect = 'auto';
    this.payeeDropdown.style.mozUserSelect = 'auto';
    this.payeeDropdown.style.msUserSelect = 'auto';

    // Ensure it's not disabled
    this.payeeDropdown.disabled = false;
    this.payeeDropdown.readonly = false;

    // Add a test click handler to verify interactivity
    this.payeeDropdown.addEventListener('click', e => {
      console.log('✅ Dropdown clicked successfully');
    });

    this.payeeDropdown.addEventListener('change', e => {
      console.log('✅ Dropdown selection changed to:', e.target.value);
    });

    console.log('✅ Dropdown made interactive');
  }

  /**
   * Add test data for debugging when profile is not available
   */
  addTestData() {
    console.log('🧪 Adding test data for debugging...');

    // Add test bill vendors
    const testBillOption = document.createElement('option');
    testBillOption.value = 'bill:Electric Company';
    testBillOption.textContent = 'Electric Company';
    testBillOption.dataset.type = 'bill';
    this.billVendorsGroup.appendChild(testBillOption);

    const testBillOption2 = document.createElement('option');
    testBillOption2.value = 'bill:Water Utility';
    testBillOption2.textContent = 'Water Utility';
    testBillOption2.dataset.type = 'bill';
    this.billVendorsGroup.appendChild(testBillOption2);

    // Add test classmates
    const testClassmateOption = document.createElement('option');
    testClassmateOption.value = 'classmate:John Doe';
    testClassmateOption.textContent = 'John Doe';
    testClassmateOption.dataset.type = 'classmate';
    this.classmatesGroup.appendChild(testClassmateOption);

    const testClassmateOption2 = document.createElement('option');
    testClassmateOption2.value = 'classmate:Jane Smith';
    testClassmateOption2.textContent = 'Jane Smith';
    testClassmateOption2.dataset.type = 'classmate';
    this.classmatesGroup.appendChild(testClassmateOption2);

    console.log('🧪 Test data added');
  }

  /**
   * Populate the dropdown with bill vendors and classmates
   */
  async populatePayeeOptions() {
    try {
      // Clear existing options (except default)
      this.clearOptionGroups();

      // Load bill vendors
      await this.loadBillVendors();

      // Load classmates
      await this.loadClassmates();
    } catch (error) {
      console.error('❌ Error populating payee options:', error);
    }
  }

  /**
   * Clear the option groups
   */
  clearOptionGroups() {
    if (this.billVendorsGroup) {
      this.billVendorsGroup.innerHTML = '';
    }
    if (this.classmatesGroup) {
      this.classmatesGroup.innerHTML = '';
    }
  }

  /**
   * Load bill vendors from user's bills
   */
  async loadBillVendors() {
    try {
      if (!currentProfile?.memberName) {
        console.warn('No user profile available for loading bills');
        return;
      }

      // Encode the member name to handle spaces and special characters
      const encodedMemberName = encodeURIComponent(currentProfile.memberName);
      const response = await fetch(
        `http://localhost:3000/getBillInfo/${encodedMemberName}`,
      );

      if (!response.ok) {
        console.warn('Could not fetch bill information');
        return;
      }

      const billData = await response.json();

      if (!billData || !Array.isArray(billData)) {
        console.warn('Invalid bill data format');
        return;
      }

      // Extract unique bill vendors
      const vendors = new Set();
      billData.forEach(bill => {
        if (bill?.Name && bill.Name.trim() !== '') {
          vendors.add(bill.Name.trim());
        }
      });

      // Add vendors to dropdown
      vendors.forEach(vendor => {
        const option = document.createElement('option');
        option.value = `bill:${vendor}`;
        option.textContent = vendor;
        option.dataset.type = 'bill';
        this.billVendorsGroup.appendChild(option);
      });

      console.log(`📋 Loaded ${vendors.size} bill vendors`);
    } catch (error) {
      console.error('❌ Error loading bill vendors:', error);
    }
  }

  /**
   * Load classmates from the server
   */
  async loadClassmates() {
    try {
      if (!currentProfile?.memberName) {
        console.warn('No user profile available for loading classmates');
        return;
      }

      // Encode the member name to handle spaces and special characters
      const encodedMemberName = encodeURIComponent(currentProfile.memberName);
      const response = await fetch(
        `http://localhost:3000/classmates/${encodedMemberName}`,
      );

      if (!response.ok) {
        console.warn('Could not fetch classmates');
        return;
      }

      const classmates = await response.json();

      if (
        !classmates ||
        !Array.isArray(classmates) ||
        classmates.length === 0
      ) {
        console.warn('No classmates found');
        return;
      }

      // Add classmates to dropdown
      classmates.forEach(classmate => {
        if (classmate && classmate.trim() !== '') {
          const option = document.createElement('option');
          option.value = `classmate:${classmate}`;
          option.textContent = classmate;
          option.dataset.type = 'classmate';
          this.classmatesGroup.appendChild(option);
        }
      });

      console.log(`👥 Loaded ${classmates.length} classmates`);
    } catch (error) {
      console.error('❌ Error loading classmates:', error);
    }
  }

  /**
   * Get the selected payee information
   */
  getSelectedPayee() {
    if (!this.payeeDropdown || this.payeeDropdown.value === 'default') {
      return null;
    }

    const selectedOption = this.payeeDropdown.selectedOptions[0];
    const [type, name] = this.payeeDropdown.value.split(':');

    return {
      type: type, // 'bill' or 'classmate'
      name: name,
      displayName: selectedOption.textContent,
    };
  }

  /**
   * Validate that a payee is selected
   */
  validateSelection() {
    const payee = this.getSelectedPayee();

    if (!payee) {
      return {
        isValid: false,
        error: 'Please select a recipient from the dropdown',
      };
    }

    return {
      isValid: true,
      payee: payee,
    };
  }

  /**
   * Refresh the payee options (useful after bills or classmates change)
   */
  async refresh() {
    console.log('🔄 Refreshing payee options...');
    await this.populatePayeeOptions();
  }

  /**
   * Reset the dropdown to default selection
   */
  reset() {
    if (this.payeeDropdown) {
      this.payeeDropdown.value = 'default';
    }
  }

  /**
   * Add a custom recipient (for special cases)
   */
  addCustomRecipient(name, type = 'custom') {
    const option = document.createElement('option');
    option.value = `${type}:${name}`;
    option.textContent = name;
    option.dataset.type = type;

    // Add to appropriate group or create new group
    if (type === 'bill' && this.billVendorsGroup) {
      this.billVendorsGroup.appendChild(option);
    } else if (type === 'classmate' && this.classmatesGroup) {
      this.classmatesGroup.appendChild(option);
    } else {
      // Add to the main dropdown if no specific group
      this.payeeDropdown.appendChild(option);
    }
  }

  /**
   * Force initialize with test data (for debugging)
   */
  forceInitialize() {
    console.log('🔧 Force initializing with test data...');
    this.clearOptionGroups();
    this.addTestData();
    console.log('✅ Force initialization complete');
  }

  /**
   * Debug function to test the payee manager
   */
  debug() {
    console.log('🔍 Check Payee Manager Debug Info:');
    console.log('- Dropdown element:', this.payeeDropdown);
    console.log('- Current profile:', currentProfile);
    console.log('- Bill vendors group:', this.billVendorsGroup);
    console.log('- Classmates group:', this.classmatesGroup);

    const selectedPayee = this.getSelectedPayee();
    console.log('- Selected payee:', selectedPayee);

    const validation = this.validateSelection();
    console.log('- Validation result:', validation);

    return {
      dropdown: !!this.payeeDropdown,
      profile: !!currentProfile,
      billGroup: !!this.billVendorsGroup,
      classmateGroup: !!this.classmatesGroup,
      selectedPayee,
      validation,
    };
  }
}

// Create global instance
let checkPayeeManager;

// Initialize when script loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔧 DOM loaded, creating CheckPayeeManager...');
  checkPayeeManager = new CheckPayeeManager();
  window.checkPayeeManager = checkPayeeManager;
});

// Also try immediate initialization if DOM is already ready
if (document.readyState !== 'loading') {
  console.log('🔧 DOM already ready, creating CheckPayeeManager...');
  checkPayeeManager = new CheckPayeeManager();
  window.checkPayeeManager = checkPayeeManager;
} else {
  // Add test data immediately for dropdown testing
  setTimeout(() => {
    if (window.checkPayeeManager) {
      console.log('🧪 Adding test data for immediate dropdown testing...');
      window.checkPayeeManager.addTestData();
    }
  }, 1000);
}

// Export for use in other modules
export { CheckPayeeManager };
export default checkPayeeManager;

/**
 * =================================================================
 * USAGE INSTRUCTIONS:
 * =================================================================
 *
 * 1. Automatic initialization:
 *    - Loads when DOM is ready
 *    - Populates dropdown with bills and classmates
 *
 * 2. Usage in deposit.js:
 *    const payee = window.checkPayeeManager.getSelectedPayee();
 *    const validation = window.checkPayeeManager.validateSelection();
 *
 * 3. Manual refresh:
 *    window.checkPayeeManager.refresh();
 *
 * 4. Reset selection:
 *    window.checkPayeeManager.reset();
 *
 * =================================================================
 */
