/**
 * Trinity Capital - Lesson Engine
 *
 * This is the core lesson engine that manages student lesson progression,
 * condition evaluation, and scoring according to the architecture plan.
 *
 * Key Features:
 * - Single function call activation after any financial action
 * - Dynamic condition evaluation based on lesson data
 * - Template-driven instruction generation
 * - Modular grading system
 * - Non-invasive integration
 */

// Import existing notification system (with fallback)
let showNotification;
try {
  const validationModule = await import('./validation.js');
  showNotification = validationModule.showNotification;
} catch (error) {
  console.log('📝 Using fallback notification system for lesson engine');
  showNotification = function (message, type) {
    console.log(`🔔 [${type?.toUpperCase() || 'INFO'}] ${message}`);
  };
}

class LessonEngine {
  constructor() {
    this.currentStudent = null;
    this.currentLesson = null;
    this.lessonTracker = new LessonTracker();
    this.instructionTemplates = new InstructionTemplates();
    this.initialized = false;

    console.log('🎓 Trinity Capital Lesson Engine initialized');
  }

  /**
   * Initialize the lesson engine for a specific student
   * @param {string} studentId - The student's ID
   */
  async initialize(studentId) {
    try {
      this.currentStudent = studentId;
      await this.loadCurrentLesson();
      this.setupPeriodicChecks();
      this.initialized = true;

      console.log(`🎯 Lesson Engine initialized for student: ${studentId}`);
    } catch (error) {
      console.error('❌ Failed to initialize lesson engine:', error);
    }
  }

  /**
   * Main function called after any financial action in the app
   * This is the single entry point mentioned in the architecture
   *
   * @param {string} actionType - Type of action performed (e.g., 'deposit', 'transfer', 'bill_created')
   * @param {Object} payload - Action data and context
   */
  async onAppAction(actionType, payload = {}) {
    if (!this.initialized) {
      console.warn('⚠️ Lesson Engine not initialized');
      return;
    }

    try {
      console.log(`🔄 Processing action: ${actionType}`, payload);

      // 1. Action Type Identification
      const normalizedActionType = this.normalizeActionType(actionType);

      // 2. Active Lesson Tracking
      await this.refreshCurrentLesson();

      if (!this.currentLesson) {
        console.log('📝 No active lesson found');
        return;
      }

      // Safety check for lesson conditions
      if (
        !this.currentLesson.lesson_conditions ||
        !Array.isArray(this.currentLesson.lesson_conditions)
      ) {
        console.log(
          '📝 Current lesson has no valid conditions, skipping evaluation',
        );
        return;
      }

      // 3. Condition Evaluation
      const matchedConditions = await this.evaluateConditions(
        normalizedActionType,
        payload,
      );

      // 4. Instruction & Challenge Generation
      await this.processMatchedConditions(matchedConditions, payload);

      // 5. Completion Validation
      await this.checkLessonCompletion();
    } catch (error) {
      console.error('❌ Error processing app action:', error);
    }
  }

  /**
   * Load the current active lesson for the student
   */
  async loadCurrentLesson() {
    try {
      // Encode the student ID to handle spaces and special characters
      const encodedStudentId = encodeURIComponent(this.currentStudent);
      const response = await fetch(
        `http://localhost:3000/api/student-current-lesson/${encodedStudentId}`,
      );

      if (response.ok) {
        this.currentLesson = await response.json();
        console.log(
          '📚 Current lesson loaded:',
          this.currentLesson?.lesson_title,
        );
      } else if (response.status === 404) {
        console.log('📝 No current lesson found for student');
        this.currentLesson = null;
      } else {
        console.warn(
          '⚠️ Error loading lesson:',
          response.status,
          response.statusText,
        );
        this.currentLesson = null;
      }
    } catch (error) {
      console.error('❌ Error loading current lesson:', error);
      this.currentLesson = null;
    }
  }

  /**
   * Refresh current lesson data
   */
  async refreshCurrentLesson() {
    await this.loadCurrentLesson();
  }

  /**
   * Activate lesson tracking for a specific lesson
   * This method is called when a student starts a lesson from the lesson modal
   * @param {Object} lesson - The lesson object to activate
   */
  async activateLesson(lesson) {
    try {
      console.log(`🎯 Activating lesson: ${lesson.lesson_title}`);

      // Set the current lesson
      this.currentLesson = lesson;

      // Reset lesson tracker for the new lesson
      this.lessonTracker = new LessonTracker();

      // Show activation notification
      this.showLessonNotification(
        `📚 ${lesson.lesson_title} is now active! Complete the activities to progress.`,
        'info',
      );

      // Start periodic checks for passive conditions
      this.setupPeriodicChecks();

      // Record lesson start event
      this.lessonTracker.recordConditionMet({
        type: 'lesson_started',
        timestamp: new Date().toISOString(),
        lesson_id: lesson._id || lesson.id,
        lesson_title: lesson.lesson_title,
      });

      console.log(`✅ Lesson activated successfully: ${lesson.lesson_title}`);

      return true;
    } catch (error) {
      console.error('❌ Error activating lesson:', error);

      this.showLessonNotification(
        `❌ Error activating lesson: ${error.message}`,
        'error',
      );

      return false;
    }
  }

  /**
   * Normalize action types to match condition schemas
   */
  normalizeActionType(actionType) {
    const actionMap = {
      transfer: 'transfer_completed',
      deposit: 'deposit_completed',
      bill_created: 'bill_created',
      payment_created: 'payment_created',
      money_sent: 'money_sent',
      money_received: 'money_received',
      account_switch: 'account_switched',
      goal_set: 'goal_set_specific',
      message_sent: 'message_sent',
      loan_taken: 'loan_taken',
    };

    return actionMap[actionType] || actionType;
  }

  /**
   * Evaluate lesson conditions against the current action - Enhanced for new schema
   */
  async evaluateConditions(actionType, payload) {
    if (!this.currentLesson?.lesson_conditions) {
      return [];
    }

    const matchedConditions = [];
    const studentData = await this.getStudentFinancialData();

    for (const condition of this.currentLesson.lesson_conditions) {
      if (this.conditionMatches(condition, actionType, payload, studentData)) {
        matchedConditions.push(condition);
        console.log(
          '✅ Condition matched:',
          condition.condition_type,
          condition.condition_value,
        );
      }
    }

    return matchedConditions;
  }

  /**
   * Check if a specific condition matches - Enhanced for new schema
   */
  conditionMatches(condition, actionType, payload, studentData) {
    // Add safety checks for condition object
    if (!condition || typeof condition !== 'object') {
      console.warn('⚠️ Invalid condition object:', condition);
      return false;
    }

    const conditionType = condition.condition_type || condition.type;
    const conditionValue = condition.condition_value || condition.value; // Support both schemas

    // Add safety check for conditionType
    if (!conditionType || typeof conditionType !== 'string') {
      console.warn(
        '⚠️ Invalid condition type:',
        conditionType,
        'in condition:',
        condition,
      );
      return false;
    }

    // New schema condition types
    switch (conditionType) {
      case 'lesson_content_viewed':
        return this.evaluateLessonContentViewed(conditionValue, studentData);
      case 'account_checked':
        return this.evaluateAccountChecked(conditionValue, payload, actionType);
      case 'spending_analyzed':
        return this.evaluateSpendingAnalyzed(
          conditionValue,
          payload,
          studentData,
        );
      case 'personality_insight':
        return this.evaluatePersonalityInsight(
          conditionValue,
          payload,
          studentData,
        );
    }

    // Legacy direct action matches
    if (conditionType === actionType) {
      return this.validateConditionValue(condition, payload, studentData);
    }

    // Balance-based conditions
    if (conditionType.includes('balance')) {
      return this.evaluateBalanceCondition(condition, studentData);
    }

    // Amount-based conditions
    if (conditionType.includes('amount')) {
      return this.evaluateAmountCondition(condition, payload, studentData);
    }

    // Goal-based conditions
    if (conditionType.includes('goal')) {
      return this.evaluateGoalCondition(condition, payload, studentData);
    }

    // Time-based conditions
    if (conditionType === 'elapsed_time') {
      return this.evaluateTimeCondition(condition, studentData);
    }

    return false;
  } /**
   * Validate condition value against action payload
   */
  validateConditionValue(condition, payload, studentData) {
    if (!condition.value) return true;

    const conditionValue = parseFloat(condition.value);
    const payloadValue = parseFloat(payload.amount || payload.value || 0);

    switch (condition.condition_type) {
      case 'transfer_amount_above':
      case 'deposit_amount_above':
        return payloadValue > conditionValue;
      case 'transfer_amount_below':
      case 'deposit_amount_below':
        return payloadValue < conditionValue;
      default:
        return true;
    }
  }

  /**
   * Evaluate balance-based conditions
   */
  evaluateBalanceCondition(condition, studentData) {
    const conditionValue = parseFloat(condition.value || 0);

    switch (condition.condition_type) {
      case 'bank_balance_above':
        return studentData.totalBalance > conditionValue;
      case 'bank_balance_below':
        return studentData.totalBalance < conditionValue;
      case 'checking_balance_above':
        return studentData.checkingBalance > conditionValue;
      case 'checking_balance_below':
        return studentData.checkingBalance < conditionValue;
      case 'savings_balance_above':
        return studentData.savingsBalance > conditionValue;
      case 'savings_balance_below':
        return studentData.savingsBalance < conditionValue;
      default:
        return false;
    }
  }

  /**
   * Evaluate amount-based conditions
   */
  evaluateAmountCondition(condition, payload, studentData) {
    const conditionValue = parseFloat(condition.value || 0);

    switch (condition.condition_type) {
      case 'total_bills_above':
        return studentData.totalBills > conditionValue;
      case 'total_income_above':
        return studentData.totalIncome > conditionValue;
      case 'total_transactions_above':
        return studentData.transactionCount > conditionValue;
      default:
        return false;
    }
  }

  /**
   * Evaluate goal-based conditions
   */
  evaluateGoalCondition(condition, payload, studentData) {
    if (!payload.goal) return false;

    const goal = payload.goal;

    switch (condition.condition_type) {
      case 'goal_set_specific':
        return goal.description && goal.description.length > 10;
      case 'goal_set_measurable':
        return goal.amount && !isNaN(parseFloat(goal.amount));
      case 'goal_has_deadline':
        return goal.deadline && new Date(goal.deadline) > new Date();
      case 'smart_goal_completed':
        return goal.status === 'completed';
      default:
        return false;
    }
  }

  /**
   * Evaluate time-based conditions
   */
  evaluateTimeCondition(condition, studentData) {
    const requiredMinutes = parseInt(condition.value || 0);
    const currentTime = Date.now();
    const lessonStartTime = studentData.lessonStartTime || currentTime;
    const elapsedMinutes = (currentTime - lessonStartTime) / (1000 * 60);

    return elapsedMinutes >= requiredMinutes;
  }

  /**
   * NEW SCHEMA: Evaluate lesson content viewed condition
   */
  evaluateLessonContentViewed(conditionValue, studentData) {
    if (!conditionValue) return false;

    const slidesViewed = studentData.slidesViewed || 0;
    const totalSlides = conditionValue.totalSlides || 1;
    const requiredSlides = conditionValue.slidesViewed || totalSlides;

    return slidesViewed >= requiredSlides;
  }

  /**
   * NEW SCHEMA: Evaluate account checked condition
   */
  evaluateAccountChecked(conditionValue, payload, actionType) {
    if (!conditionValue) return actionType === 'account_checked';

    // Check if account type matches
    if (
      conditionValue.accountType &&
      payload.accountType !== conditionValue.accountType
    ) {
      return false;
    }

    // Check if transactions were reviewed
    if (conditionValue.transactions_reviewed && !payload.transactionsReviewed) {
      return false;
    }

    return actionType === 'account_checked' || actionType === 'account_switch';
  }

  /**
   * NEW SCHEMA: Evaluate spending analyzed condition
   */
  evaluateSpendingAnalyzed(conditionValue, payload, studentData) {
    if (!conditionValue) return false;

    const categoriesIdentified =
      payload.categoriesIdentified || studentData.categoriesIdentified || 0;
    const requiredCategories = conditionValue.categories_identified || 1;

    return categoriesIdentified >= requiredCategories;
  }

  /**
   * NEW SCHEMA: Evaluate personality insight condition
   */
  evaluatePersonalityInsight(conditionValue, payload, studentData) {
    if (!conditionValue) return false;

    // Check if personality assessment was completed
    return (
      payload.personalityAssessed || studentData.personalityAssessed || false
    );
  } /**
   * Process matched conditions and execute their actions
   */
  async processMatchedConditions(matchedConditions, payload) {
    for (const condition of matchedConditions) {
      await this.executeConditionAction(condition, payload);
      this.lessonTracker.recordConditionMet(condition);
    }
  }

  /**
   * Execute the action associated with a matched condition
   */
  async executeConditionAction(condition, payload) {
    const action = condition.action;
    if (!action) return;

    // Handle both old and new schema formats
    const actionType = action.action_type || action.type;
    const actionDetails = action.action_details || {};

    console.log(`🎯 Executing action: ${actionType}`);

    try {
      switch (actionType) {
        case 'send_message':
        case 'show_instruction':
          // CRITICAL FIX: Only send congratulatory/follow-up messages AFTER action is confirmed complete
          await this.sendDelayedMessage(
            action.message || action.value,
            actionDetails,
          );
          break;
        case 'challenge_save_amount':
          await this.createSavingsChallenge(
            action.value,
            action.description,
            actionDetails,
          );
          break;
        case 'challenge_transfer':
          await this.createTransferChallenge(
            action.value,
            action.description,
            actionDetails,
          );
          break;
        case 'show_tip':
          await this.showTip(action.message || action.value, actionDetails);
          break;
        case 'highlight_feature':
          await this.highlightFeature(
            action.feature || action.value,
            actionDetails,
          );
          break;
        case 'unlock_content':
          await this.unlockContent(action, actionDetails);
          break;
        case 'grade_lesson':
          await this.gradeLesson(action, actionDetails, payload);
          break;
        case 'notify_teacher':
          await this.notifyTeacher(action, actionDetails, payload);
          break;
        case 'complete_lesson':
          await this.completeLesson(actionDetails);
          break;
        case 'praise_good_habit':
          await this.praiseStudent(
            action.message || action.value,
            actionDetails,
          );
          break;
        case 'warn_poor_choice':
          await this.warnStudent(action.message || action.value, actionDetails);
          break;
        default:
          console.log(`⚠️ Unknown action type: ${action.action_type}`);
      }
    } catch (error) {
      console.error(`❌ Error executing action ${action.action_type}:`, error);
    }
  }

  /**
   * Check if all lesson conditions have been met for completion
   */
  async checkLessonCompletion() {
    if (!this.currentLesson) return;

    const completionConditions = this.currentLesson.lesson_conditions.filter(
      condition => condition.action?.action_type === 'complete_lesson',
    );

    if (completionConditions.length === 0) {
      // Auto-complete if no specific completion conditions
      if (
        this.lessonTracker.getAllConditionsMet(
          this.currentLesson.lesson_conditions,
        )
      ) {
        await this.completeLesson();
      }
    } else {
      // Check specific completion conditions
      for (const condition of completionConditions) {
        const studentData = await this.getStudentFinancialData();
        if (
          this.conditionMatches(condition, 'completion_check', {}, studentData)
        ) {
          await this.completeLesson();
          break;
        }
      }
    }
  }

  /**
   * Complete the current lesson and calculate final score
   */
  async completeLesson(actionDetails = {}) {
    if (!this.currentLesson) return;

    try {
      console.log('🏆 Completing lesson:', this.currentLesson.lesson_title);

      // Calculate final grade
      const grade = await this.calculateLessonGrade();

      // Lock current lesson and unlock next
      await this.lockLesson();
      await this.unlockNextLesson();

      // Sync with teacher dashboard
      await this.syncWithTeacherDashboard(grade);

      // Show completion message with enhanced features
      await this.showCompletionMessage(grade, actionDetails);

      // Handle completion data if provided
      if (actionDetails.completion_data) {
        try {
          await fetch('http://localhost:3000/api/student-lesson/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentId: this.currentStudentData?.studentId,
              lessonId: this.currentLesson._id,
              completion_data: actionDetails.completion_data,
            }),
          });
        } catch (error) {
          console.error('Error saving completion data:', error);
        }
      }
    } catch (error) {
      console.error('❌ Error completing lesson:', error);
    }
  }

  /**
   * Calculate lesson grade based on conditions met and penalties
   */
  async calculateLessonGrade() {
    const baseScore = 70; // Starting score
    const conditionBonus = 5; // Points per positive condition
    const conditionPenalty = 3; // Points deducted per negative condition

    const positiveConditions = this.lessonTracker.getPositiveConditionsCount();
    const negativeConditions = this.lessonTracker.getNegativeConditionsCount();

    let activityScore =
      baseScore +
      positiveConditions * conditionBonus -
      negativeConditions * conditionPenalty;
    activityScore = Math.max(0, Math.min(100, activityScore)); // Clamp between 0-100

    // If lesson has quiz component, integrate it
    const quizScore = this.lessonTracker.getQuizScore();
    let finalScore = activityScore;

    if (quizScore !== null) {
      const activityWeight = 0.7; // 70% activity, 30% quiz
      const quizWeight = 0.3;
      finalScore = activityScore * activityWeight + quizScore * quizWeight;
    }

    return Math.round(finalScore);
  }

  /**
   * Get current student financial data for condition evaluation
   */
  async getStudentFinancialData() {
    try {
      const encodedStudentId = encodeURIComponent(this.currentStudent);
      const response = await fetch(
        `http://localhost:3000/api/student-financial-data/${encodedStudentId}`,
      );
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('❌ Error fetching student financial data:', error);
    }

    // Return default data structure
    return {
      checkingBalance: 0,
      savingsBalance: 0,
      totalBalance: 0,
      totalBills: 0,
      totalIncome: 0,
      transactionCount: 0,
      lessonStartTime: Date.now(),
    };
  }

  /**
   * Setup periodic checks for passive conditions
   */
  setupPeriodicChecks() {
    // Check passive conditions every 5 minutes
    setInterval(
      async () => {
        if (this.currentLesson) {
          await this.evaluatePassiveConditions();
        }
      },
      5 * 60 * 1000,
    ); // 5 minutes
  }

  /**
   * Evaluate conditions that don't require specific actions (passive checks)
   */
  async evaluatePassiveConditions() {
    const passiveConditionTypes = [
      'elapsed_time',
      'bank_balance_above',
      'bank_balance_below',
      'budget_negative',
      'budget_positive_above',
    ];

    const studentData = await this.getStudentFinancialData();

    for (const condition of this.currentLesson.lesson_conditions) {
      if (passiveConditionTypes.includes(condition.condition_type)) {
        if (
          this.conditionMatches(condition, 'passive_check', {}, studentData)
        ) {
          await this.executeConditionAction(condition, {});
          this.lessonTracker.recordConditionMet(condition);
        }
      }
    }
  }

  // Action execution methods with enhanced schema support
  async sendMessage(message, actionDetails = {}) {
    const duration = actionDetails.duration || 3000;
    const priority = actionDetails.priority || 'info';

    // Enhanced notification with difficulty adjustment
    if (actionDetails.difficulty_adjusted && this.currentStudentData) {
      const adjustedMessage = this.adjustMessageForDifficulty(
        message,
        this.currentStudentData,
      );
      this.showLessonNotification(adjustedMessage, priority);
    } else {
      this.showLessonNotification(message, priority);
    }

    // Auto-trigger follow-up actions
    if (actionDetails.auto_trigger && actionDetails.follow_up_actions) {
      setTimeout(() => {
        actionDetails.follow_up_actions.forEach(followUpAction => {
          this.executeConditionAction({ action: followUpAction }, {});
        });
      }, duration);
    }
  }

  /**
   * CRITICAL FIX: Send delayed messages only after confirming action completion
   * This prevents showing "Great! You've added income..." before the action is actually done
   */
  async sendDelayedMessage(message, actionDetails = {}) {
    const delay = actionDetails.delay || 1000; // 1 second delay to ensure action processes
    const messageType = actionDetails.message_type || 'follow_up';

    // Only send follow-up/congratulatory messages after a delay
    if (messageType === 'follow_up' || messageType === 'congratulations') {
      setTimeout(async () => {
        // Double-check that the condition is still valid before sending message
        await this.refreshCurrentLesson();
        const isStillValid = await this.validateConditionStillMet(
          actionDetails.condition_id,
        );

        if (isStillValid) {
          await this.sendMessage(message, actionDetails);
        }
      }, delay);
    } else {
      // Send immediate messages (like warnings or tips) right away
      await this.sendMessage(message, actionDetails);
    }
  }

  /**
   * Validate that a condition is still met after an action completes
   */
  async validateConditionStillMet(conditionId) {
    if (!conditionId || !this.currentLesson) return true; // Default to true if no validation needed

    // Check if the specific condition is still satisfied
    const condition = this.currentLesson.lesson_conditions.find(
      c => c.id === conditionId,
    );
    if (!condition) return true;

    const studentData = await this.getStudentFinancialData();
    return this.conditionMatches(
      condition,
      condition.condition_type,
      {},
      studentData,
    );
  }

  async createSavingsChallenge(amount, description, actionDetails = {}) {
    const baseMessage = `💰 Challenge: Save $${amount} into your savings account. ${description || ''}`;
    const message = actionDetails.difficulty_adjusted
      ? this.adjustMessageForDifficulty(baseMessage, this.currentStudentData)
      : baseMessage;

    this.showLessonNotification(message, 'challenge');

    // Create challenge in backend if enabled
    if (actionDetails.create_backend_challenge) {
      try {
        await fetch('http://localhost:3000/api/student-challenge/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'savings',
            targetAmount: amount,
            description: description || `Save $${amount}`,
            difficulty: actionDetails.difficulty_adjusted
              ? this.currentStudentData?.difficulty_level
              : 'medium',
          }),
        });
      } catch (error) {
        console.error('Error creating savings challenge:', error);
      }
    }
  }

  async createTransferChallenge(amount, description, actionDetails = {}) {
    const baseMessage = `💸 Challenge: Transfer $${amount} between accounts. ${description || ''}`;
    const message = actionDetails.difficulty_adjusted
      ? this.adjustMessageForDifficulty(baseMessage, this.currentStudentData)
      : baseMessage;

    this.showLessonNotification(message, 'challenge');
  }

  async showTip(tip, actionDetails = {}) {
    const baseMessage = `💡 Tip: ${tip}`;
    const message = actionDetails.difficulty_adjusted
      ? this.adjustMessageForDifficulty(baseMessage, this.currentStudentData)
      : baseMessage;

    this.showLessonNotification(message, 'tip');
  }

  async highlightFeature(feature, actionDetails = {}) {
    // This would integrate with UI highlighting system
    console.log(`🎯 Highlighting feature: ${feature}`);

    if (actionDetails.feedback_enabled !== false) {
      this.showLessonNotification(`� Focus on: ${feature}`, 'highlight');
    }
  }

  async praiseStudent(message, actionDetails = {}) {
    const baseMessage = `�🎉 Great job! ${message}`;
    const finalMessage = actionDetails.difficulty_adjusted
      ? this.adjustMessageForDifficulty(baseMessage, this.currentStudentData)
      : baseMessage;

    this.showLessonNotification(finalMessage, 'praise');
  }

  async warnStudent(message, actionDetails = {}) {
    const baseMessage = `⚠️ Warning: ${message}`;
    const finalMessage = actionDetails.difficulty_adjusted
      ? this.adjustMessageForDifficulty(baseMessage, this.currentStudentData)
      : baseMessage;

    this.showLessonNotification(finalMessage, 'warning');
  }

  /**
   * Adjust message difficulty based on student data
   */
  adjustMessageForDifficulty(message, studentData) {
    const difficulty = studentData?.difficulty_level || 'medium';

    switch (difficulty) {
      case 'easy':
        return `💡 ${message} Take your time to understand!`;
      case 'hard':
        return `🎯 ${message}`;
      default:
        return message;
    }
  }

  async lockLesson() {
    // API call to lock current lesson
    try {
      await fetch('http://localhost:3000/api/lock-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: this.currentStudent,
          lessonId: this.currentLesson._id,
        }),
      });
    } catch (error) {
      console.error('❌ Error locking lesson:', error);
    }
  }

  async unlockNextLesson() {
    // API call to unlock next lesson
    try {
      await fetch('http://localhost:3000/api/unlock-next-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: this.currentStudent,
          currentLessonId: this.currentLesson._id,
        }),
      });
    } catch (error) {
      console.error('❌ Error unlocking next lesson:', error);
    }
  }

  async syncWithTeacherDashboard(grade) {
    // API call to sync with teacher dashboard
    try {
      await fetch('http://localhost:3000/api/sync-teacher-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: this.currentStudent,
          lessonId: this.currentLesson._id,
          grade: grade,
          conditionsData: this.lessonTracker.getReportData(),
        }),
      });
    } catch (error) {
      console.error('❌ Error syncing with teacher dashboard:', error);
    }
  }

  async showCompletionMessage(grade, actionDetails = {}) {
    const letterGrade = this.convertToLetterGrade(grade);
    const lessonTitle = this.currentLesson?.lesson_title || 'Unknown Lesson';

    let message =
      actionDetails.completion_message ||
      `🎓 Lesson Complete!\n\n📚 ${lessonTitle}\n🎯 Grade: ${grade}% (${letterGrade})\n\nGreat work! Keep learning! 💪`;

    // Apply difficulty adjustment if enabled
    if (actionDetails.difficulty_adjusted && this.currentStudentData) {
      message = this.adjustMessageForDifficulty(
        message,
        this.currentStudentData,
      );
    }

    this.showLessonNotification(message, 'completion');
  }

  convertToLetterGrade(percentage) {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  showLessonNotification(message, type = 'info') {
    // Use the existing validation notification system
    try {
      showNotification(message, type);
    } catch (error) {
      console.log(`🔔 [${type.toUpperCase()}] ${message}`);
    }
  }
}

/**
 * Lesson Tracker - Tracks student progress and condition fulfillment
 */
class LessonTracker {
  constructor() {
    this.conditionsMet = new Set();
    this.positiveConditions = [];
    this.negativeConditions = [];
    this.quizScores = [];
    this.startTime = Date.now();
  }

  recordConditionMet(condition) {
    const conditionKey = `${condition.condition_type}_${condition.value || ''}`;

    if (!this.conditionsMet.has(conditionKey)) {
      this.conditionsMet.add(conditionKey);

      // Categorize condition as positive or negative for scoring
      if (this.isPositiveCondition(condition)) {
        this.positiveConditions.push(condition);
      } else if (this.isNegativeCondition(condition)) {
        this.negativeConditions.push(condition);
      }
    }
  }

  recordPositiveCondition(conditionType, data) {
    this.positiveConditions.push({ condition_type: conditionType, data });
  }

  recordNegativeCondition(conditionType, data) {
    this.negativeConditions.push({ condition_type: conditionType, data });
  }

  addQuizScore(score, maxScore, quizName) {
    const percentage = (score / maxScore) * 100;
    this.quizScores.push({ score: percentage, name: quizName });
  }

  getPositiveConditionsCount() {
    return this.positiveConditions.length;
  }

  getNegativeConditionsCount() {
    return this.negativeConditions.length;
  }

  getQuizScore() {
    if (this.quizScores.length === 0) return null;

    const average =
      this.quizScores.reduce((sum, quiz) => sum + quiz.score, 0) /
      this.quizScores.length;
    return Math.round(average);
  }

  getAllConditionsMet(allConditions) {
    const requiredConditions = allConditions.filter(
      c => !this.isOptionalCondition(c),
    );
    return requiredConditions.every(condition => {
      const conditionKey = `${condition.condition_type}_${condition.value || ''}`;
      return this.conditionsMet.has(conditionKey);
    });
  }

  getReportData() {
    return {
      positiveConditions: this.positiveConditions,
      negativeConditions: this.negativeConditions,
      quizScores: this.quizScores,
      duration: Date.now() - this.startTime,
    };
  }

  isPositiveCondition(condition) {
    const positiveTypes = [
      'transfer_completed',
      'deposit_completed',
      'savings_goal_met',
      'goal_set_specific',
      'smart_goal_completed',
      'emergency_fund_built',
    ];
    return positiveTypes.includes(condition.condition_type);
  }

  isNegativeCondition(condition) {
    const negativeTypes = [
      'budget_negative',
      'debt_to_income_high',
      'loan_amount_above',
    ];
    return negativeTypes.includes(condition.condition_type);
  }

  isOptionalCondition(condition) {
    return (
      condition.action?.action_type === 'show_tip' ||
      condition.action?.action_type === 'highlight_feature'
    );
  }
}

/**
 * Instruction Templates - Provides dynamic instruction generation
 */
class InstructionTemplates {
  constructor() {
    this.templates = {
      transfer_challenge:
        'Transfer ${amount} from your ${fromAccount} to your ${toAccount} account.',
      savings_goal: 'Save ${amount} to reach your ${goalName} goal.',
      bill_setup:
        'Set up a ${frequency} bill for ${description} with amount ${amount}.',
      budget_warning:
        'Your expenses (${expenses}) exceed your income (${income}). Review your budget.',
      general_praise: "Excellent work! You've successfully ${action}.",
    };
  }

  generateInstruction(templateName, variables = {}) {
    const template = this.templates[templateName];
    if (!template) return null;

    let instruction = template;
    Object.keys(variables).forEach(key => {
      instruction = instruction.replace(
        new RegExp(`\\$\\{${key}\\}`, 'g'),
        variables[key],
      );
    });

    return instruction;
  }
}

// Initialize global lesson engine instance
window.lessonEngine = new LessonEngine();

/**
 * Backward compatibility functions for existing test files and integrations
 */

// Legacy function for recording lesson actions
window.recordLessonAction = async function (actionType, payload) {
  if (window.lessonEngine && window.lessonEngine.initialized) {
    await window.lessonEngine.onAppAction(actionType, payload);
  } else if (window.lessonEngine) {
    // Queue the action if engine exists but not yet initialized
    console.log(
      '🔄 Queueing action until lesson engine is initialized:',
      actionType,
    );
    setTimeout(() => window.recordLessonAction(actionType, payload), 1000);
  } else {
    console.warn('⚠️ Lesson engine not available for recordLessonAction');
  }
};

// Legacy function for initializing lesson with requirements
window.initializeLessonWithRequirements = async function (lessonData) {
  if (window.lessonEngine) {
    // Set current lesson data
    window.lessonEngine.currentLesson = lessonData;
    console.log('📝 Legacy lesson initialization:', lessonData);
    return true;
  }
  return false;
};

// Expose lesson tracker for backward compatibility
Object.defineProperty(window, 'lessonTracker', {
  get: function () {
    return window.lessonEngine ? window.lessonEngine.lessonTracker : null;
  },
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LessonEngine,
    LessonTracker,
    InstructionTemplates,
    recordLessonAction: window.recordLessonAction,
    initializeLessonWithRequirements: window.initializeLessonWithRequirements,
  };
}

// Export for ES6 modules (for test files and imports)
export const recordLessonAction = window.recordLessonAction;
export const initializeLessonWithRequirements =
  window.initializeLessonWithRequirements;

console.log('✅ Trinity Capital Lesson Engine loaded successfully');
