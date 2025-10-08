document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'http://localhost:3000';

  // --- Element Selections ---
  const feedbackDialog = document.getElementById('feedbackDialog');
  const openFeedbackBtn = document.querySelector('.feedbackBTN');
  const closeFeedbackBtn = document.querySelector('.feedbackCloseBtn');

  const optionsView = document.getElementById('feedbackOptionsView');
  const generalView = document.getElementById('generalFeedbackView');
  const bugView = document.getElementById('bugReportView');

  const showGeneralBtn = document.querySelector('.feedback-general-btn');
  const showBugBtn = document.querySelector('.feedback-bug-btn');

  const gfBackBtn = document.getElementById('gfBackBtn');
  const bugBackBtn = document.getElementById('bugBackBtn');

  const gfSubmitBtn = document.getElementById('gfSubmitBtn');
  const bugSubmitBtn = document.getElementById('bugSubmitBtn');

  // --- State & Helper Functions ---

  // Function to switch between views in the dialog
  const switchView = viewToShow => {
    optionsView.style.display = 'none';
    generalView.style.display = 'none';
    bugView.style.display = 'none';
    viewToShow.style.display = 'block';
    viewToShow.setAttribute('aria-hidden', 'false');
  };

  // Function to show a temporary message on the submit button
  const showButtonMessage = (button, message, isSuccess) => {
    const originalText = button.textContent;
    button.textContent = message;
    button.disabled = true;
    button.style.backgroundColor = isSuccess ? '#28a745' : '#dc3545';

    setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
      button.style.backgroundColor = '';
    }, 3000);
  };

  // --- Event Listeners ---

  // Open and Close Dialog
  if (openFeedbackBtn) {
    openFeedbackBtn.addEventListener('click', () => {
      if (feedbackDialog) {
        switchView(optionsView); // Reset to main options view
        feedbackDialog.showModal();
      }
    });
  }

  if (closeFeedbackBtn) {
    closeFeedbackBtn.addEventListener('click', () => {
      if (feedbackDialog) feedbackDialog.close();
    });
  }

  // View Switching
  if (showGeneralBtn) {
    showGeneralBtn.addEventListener('click', () => switchView(generalView));
  }

  if (showBugBtn) {
    showBugBtn.addEventListener('click', () => {
      // Pre-fill date/time for convenience
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      document.getElementById('bugDatetime').value = now
        .toISOString()
        .slice(0, 16);
      switchView(bugView);
    });
  }

  if (gfBackBtn) {
    gfBackBtn.addEventListener('click', () => switchView(optionsView));
  }

  if (bugBackBtn) {
    bugBackBtn.addEventListener('click', () => switchView(optionsView));
  }

  // --- Form Submission Logic ---

  // General Feedback Submission
  if (gfSubmitBtn) {
    gfSubmitBtn.addEventListener('click', async () => {
      const parcel = {
        type: 'general',
        userType: 'student',
        category: document.getElementById('gfCategory').value,
        details: document.getElementById('gfDetails').value.trim(),
      };

      if (!parcel.details) {
        alert('Please provide some details for your feedback.');
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/submit-feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parcel }),
        });

        const result = await response.json();
        if (result.success) {
          showButtonMessage(gfSubmitBtn, '✅ Submitted!', true);
          setTimeout(() => feedbackDialog.close(), 1500);
        } else {
          throw new Error(result.message || 'Submission failed.');
        }
      } catch (error) {
        console.error('Error submitting general feedback:', error);
        showButtonMessage(gfSubmitBtn, '❌ Error', false);
      }
    });
  }

  // Bug Report Submission
  if (bugSubmitBtn) {
    bugSubmitBtn.addEventListener('click', async () => {
      const parcel = {
        type: 'bug',
        userType: 'student',
        device: document.getElementById('bugDevice').value.trim(),
        datetime: document.getElementById('bugDatetime').value,
        school: document.getElementById('bugSchool').value.trim(),
        features: document.getElementById('bugFeatures').value,
        details: document.getElementById('bugDetails').value.trim(),
      };

      if (!parcel.details || !parcel.datetime) {
        alert('Please describe the issue and specify the date and time.');
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/submit-feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parcel }),
        });

        const result = await response.json();
        if (result.success) {
          showButtonMessage(bugSubmitBtn, '✅ Submitted!', true);
          setTimeout(() => feedbackDialog.close(), 1500);
        } else {
          throw new Error(result.message || 'Submission failed.');
        }
      } catch (error) {
        console.error('Error submitting bug report:', error);
        showButtonMessage(bugSubmitBtn, '❌ Error', false);
      }
    });
  }
});
