/**
 * Scheduler Status Display Component
 * Adds a status display for the persistent scheduler system
 */

class SchedulerStatusDisplay {
  constructor() {
    this.statusElement = null;
    this.updateInterval = null;
    this.init();
  }

  init() {
    this.createStatusElement();
    this.startPeriodicUpdates();
  }

  createStatusElement() {
    // Create status container
    const statusContainer = document.createElement('div');
    statusContainer.id = 'scheduler-status-container';
    statusContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 9999;
      min-width: 200px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      transition: opacity 0.3s ease;
    `;

    // Create title
    const title = document.createElement('div');
    title.textContent = 'Scheduler Status';
    title.style.cssText = `
      font-weight: bold;
      margin-bottom: 5px;
      color: #4CAF50;
      border-bottom: 1px solid #333;
      padding-bottom: 5px;
    `;

    // Create status display
    this.statusElement = document.createElement('div');
    this.statusElement.id = 'scheduler-status';
    this.statusElement.textContent = 'Loading...';

    // Create detailed info element
    this.detailElement = document.createElement('div');
    this.detailElement.id = 'scheduler-details';
    this.detailElement.style.cssText = `
      margin-top: 8px;
      font-size: 10px;
      color: #ccc;
    `;

    // Add click handler to toggle details
    statusContainer.addEventListener('click', () => {
      this.toggleDetails();
    });

    statusContainer.appendChild(title);
    statusContainer.appendChild(this.statusElement);
    statusContainer.appendChild(this.detailElement);

    // Add to page
    document.body.appendChild(statusContainer);
  }

  async updateStatus() {
    try {
      const response = await fetch('https://tcstudentserver-production.up.railway.app/scheduler/status');
      if (response.ok) {
        const status = await response.json();
        this.displayStatus(status);
      } else {
        this.statusElement.textContent = 'Scheduler: Error';
        this.statusElement.style.color = '#f44336';
      }
    } catch (error) {
      console.error('Error fetching scheduler status:', error);
      this.statusElement.textContent = 'Scheduler: Offline';
      this.statusElement.style.color = '#f44336';
    }
  }

  displayStatus(status) {
    const activeJobs = status.totalScheduledJobs || 0;
    this.statusElement.textContent = `Active Jobs: ${activeJobs}`;
    this.statusElement.style.color = activeJobs > 0 ? '#4CAF50' : '#ff9800';

    // Update details
    if (status.jobs && status.jobs.length > 0) {
      const jobDetails = status.jobs
        .map(job => {
          const [user, type, id] = job.key.split('-');
          return `${user}: ${type}`;
        })
        .join('\n');

      this.detailElement.textContent = `Jobs:\n${jobDetails}`;
    } else {
      this.detailElement.textContent = 'No active jobs';
    }
  }

  toggleDetails() {
    const isVisible = this.detailElement.style.display !== 'none';
    this.detailElement.style.display = isVisible ? 'none' : 'block';
  }

  startPeriodicUpdates() {
    // Initial update
    this.updateStatus();

    // Update every 30 seconds
    this.updateInterval = setInterval(() => {
      this.updateStatus();
    }, 30000);
  }

  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    const container = document.getElementById('scheduler-status-container');
    if (container) {
      container.remove();
    }
  }
}

// Auto-initialize when script loads (if in appropriate environment)
if (typeof window !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on pages that have bills/payments functionality
    if (
      document.querySelector('.form__btn--bills') ||
      document.querySelector('.form__btn--payments')
    ) {
      new SchedulerStatusDisplay();
    }
  });
} else if (
  typeof window !== 'undefined' &&
  document.readyState === 'complete'
) {
  // Page already loaded
  if (
    document.querySelector('.form__btn--bills') ||
    document.querySelector('.form__btn--payments')
  ) {
    new SchedulerStatusDisplay();
  }
}

// Export for manual initialization
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SchedulerStatusDisplay;
}
