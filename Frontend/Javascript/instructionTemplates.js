/**
 * Trinity Capital App - Instruction Templates
 *
 * This file contains comprehensive instruction templates for ALL condition types
 * available in the teacher dashboard lesson builder. Each template provides:
 * - Clear, actionable instructions for students
 * - Specific app location guidance
 * - Educational context and purpose
 * - Proper iconography for visual clarity
 *
 * Templates are organized by Trinity Capital app feature categories
 * to match the actual app structure and ensure seamless operation.
 */

export const instructionTemplates = {
  // =====================================
  // 💰 ACCOUNT BALANCE CONDITIONS
  // =====================================

  bank_balance_above: {
    icon: '💰',
    title: 'Check Your Total Account Balance',
    description:
      'Review your combined checking and savings balance. Your total balance should be above the target amount.',
    location: 'Main Dashboard → View total balance at the top of your screen',
  },

  bank_balance_below: {
    icon: '⚠️',
    title: 'Monitor Low Total Balance',
    description:
      'Your total account balance is below the threshold. Consider adding income or reducing expenses.',
    location: 'Main Dashboard → Monitor total balance display',
  },

  checking_balance_above: {
    icon: '🏦',
    title: 'Build Your Checking Account',
    description:
      'Increase your checking account balance above the target amount. This is your primary spending account.',
    location:
      'Click "Checking" tab → View balance → Add deposits or transfers if needed',
  },

  checking_balance_below: {
    icon: '📉',
    title: 'Address Low Checking Balance',
    description:
      'Your checking balance is below the safe threshold. Consider transferring from savings or adding income.',
    location: 'Click "Checking" tab → Review balance and recent transactions',
  },

  savings_balance_above: {
    icon: '💎',
    title: 'Build Your Savings Account',
    description:
      'Transfer money to your savings account to reach the target balance. Savings provide financial security.',
    location:
      'Click "Savings" tab → Use Transfer button to move money from checking',
  },

  savings_balance_below: {
    icon: '📊',
    title: 'Increase Your Savings',
    description:
      'Your savings balance is below the recommended amount. Try to save more consistently.',
    location:
      'Click "Savings" tab → Review balance → Make transfers from checking',
  },

  balance_ratio_savings_above: {
    icon: '⚖️',
    title: 'Optimize Savings-to-Checking Ratio',
    description:
      'Maintain a healthy ratio between your savings and checking accounts. More savings shows good financial planning.',
    location: 'Compare balances between "Checking" and "Savings" tabs',
  },

  // =====================================
  // 💸 TRANSFER & TRANSACTION CONDITIONS
  // =====================================

  transfer_completed: {
    icon: '💸',
    title: 'Transfer Money Between Accounts',
    description:
      'Practice transferring money between your checking and savings accounts. This helps you manage and allocate funds wisely.',
    location:
      'Click "Transfer" button → Select From/To accounts → Enter amount → Confirm',
  },

  transfer_amount_above: {
    icon: '💵',
    title: 'Make a Significant Transfer',
    description:
      'Complete a transfer above the specified amount. Larger transfers show commitment to saving or major financial moves.',
    location:
      'Click "Transfer" button → Enter amount greater than required → Complete transfer',
  },

  deposit_completed: {
    icon: '💰',
    title: 'Make a Mobile Check Deposit',
    description:
      'Use the deposit feature to add money to your account. Practice depositing checks digitally.',
    location: 'Click "Deposits" button → Enter check details → Submit deposit',
  },

  deposit_amount_above: {
    icon: '📈',
    title: 'Make a Substantial Deposit',
    description:
      'Deposit an amount above the specified threshold. Larger deposits help build your account balance faster.',
    location:
      'Click "Deposits" button → Enter amount greater than required → Submit',
  },

  money_sent: {
    icon: '📤',
    title: 'Send Money to Classmates',
    description:
      'Practice peer-to-peer payments by sending money to your classmates. This simulates real-world money transfers.',
    location:
      'Click "Send Money" button → Select recipient → Enter amount → Send',
  },

  money_received: {
    icon: '📥',
    title: 'Receive Money from Peers',
    description:
      'Accept money sent by classmates. Check your transaction history to see received payments.',
    location: 'Monitor your account for incoming transfers from classmates',
  },

  total_transactions_above: {
    icon: '📊',
    title: 'Build Transaction History',
    description:
      'Create a robust transaction history by making transfers, deposits, and payments. This helps you understand money flow.',
    location:
      'Use Transfer, Deposits, and Send Money features to create transactions',
  },

  // =====================================
  // 📋 BILLS & INCOME CONDITIONS
  // =====================================

  bill_created: {
    icon: '📋',
    title: 'Set Up Bill Payments',
    description:
      'Create and manage your bill payments. Add recurring payments for monthly expenses like rent, utilities, or subscriptions.',
    location:
      'Click "Bills & Payments" button → Add new bill → Set payment details',
  },

  payment_created: {
    icon: '💵',
    title: 'Add an Income Source',
    description:
      'Set up income sources like paychecks, allowances, or part-time job payments. Income is the foundation of financial planning.',
    location:
      'Click "Bills & Payments" button → Add new payment/income → Enter details',
  },

  total_bills_above: {
    icon: '📋',
    title: 'Track Your Monthly Expenses',
    description:
      'Add multiple bills to track all your monthly expenses. Understanding your bills helps with budgeting.',
    location:
      'Click "Bills & Payments" → Add multiple bills to reach the target amount',
  },

  total_income_above: {
    icon: '💸',
    title: 'Reach Income Milestone',
    description:
      'Build your monthly income above the target amount. Higher income provides more financial flexibility.',
    location:
      'Add various income sources through "Bills & Payments" → Income section',
  },

  budget_negative: {
    icon: '⚠️',
    title: 'Address Budget Deficit',
    description:
      'Your expenses exceed your income, creating a budget deficit. Consider reducing expenses or finding additional income.',
    location:
      'Review your budget calculation → Compare total income vs total bills',
  },

  budget_positive_above: {
    icon: '✅',
    title: 'Achieve Budget Surplus',
    description:
      'Excellent! Your income exceeds your expenses by the target amount. This surplus can go toward savings and goals.',
    location:
      'Review your budget overview → See income minus expenses calculation',
  },

  bills_count_above: {
    icon: '📝',
    title: 'Diversify Your Expense Tracking',
    description:
      'Add multiple types of bills to get a complete picture of your monthly expenses.',
    location:
      'Click "Bills & Payments" → Add different categories of bills (rent, utilities, food, etc.)',
  },

  income_count_above: {
    icon: '💰',
    title: 'Diversify Your Income Sources',
    description:
      'Multiple income sources provide financial stability. Add different types of income streams.',
    location:
      'Click "Bills & Payments" → Add various income sources (job, allowance, side work)',
  },

  // =====================================
  // 🔄 ACCOUNT NAVIGATION CONDITIONS
  // =====================================

  account_switched: {
    icon: '🔄',
    title: 'Explore Your Accounts',
    description:
      'Switch between your checking and savings accounts to understand how each account serves different purposes.',
    location: 'Click between "Checking" and "Savings" account tabs to explore',
  },

  checking_used_more: {
    icon: '🏦',
    title: 'Focus on Checking Account',
    description:
      "You're using your checking account more frequently. This suggests you prefer easy access to your money.",
    location: 'Continue using "Checking" tab for daily transactions',
  },

  savings_used_more: {
    icon: '💎',
    title: 'Emphasize Savings Behavior',
    description:
      "You're using your savings account more often. This shows good long-term financial planning habits.",
    location: 'Continue using "Savings" tab for your financial activities',
  },

  account_type_active: {
    icon: '👁️',
    title: 'Review Active Account',
    description:
      "You're currently viewing a specific account type. Notice how this account serves your financial needs.",
    location: 'Current account tab → Review account details and purpose',
  },

  // =====================================
  // ⏰ TIME-BASED CONDITIONS
  // =====================================

  elapsed_time: {
    icon: '⏰',
    title: 'Take Time to Learn',
    description:
      'Spend time understanding the lesson concepts. Good financial decisions require thoughtful consideration.',
    location: 'Review the lesson content above and reflect on the concepts',
  },

  lesson_revisited: {
    icon: '🔄',
    title: 'Review Previous Learning',
    description:
      "You're revisiting this lesson. Use this opportunity to reinforce your understanding of the concepts.",
    location: 'Review the lesson content and practice the skills again',
  },

  lesson_completion_trigger: {
    icon: '🎯',
    title: 'Complete Lesson Requirements',
    description:
      "You've met the criteria for lesson completion. Review your progress and accomplishments.",
    location: 'Review all completed activities in this lesson',
  },

  // =====================================
  // 🎯 GOAL SETTING CONDITIONS
  // =====================================

  goal_set_specific: {
    icon: '🎯',
    title: 'Set a Specific Financial Goal',
    description:
      'Create a clear, specific financial goal (like "Save $500 for a car"). Specific goals are easier to achieve than vague ones.',
    location:
      'Use the goal-setting feature to define exactly what you want to save for',
  },

  goal_set_measurable: {
    icon: '📏',
    title: 'Make Your Goal Measurable',
    description:
      'Add a specific dollar amount to your goal. Measurable goals help you track progress effectively.',
    location: 'Add a target amount to your goal using the goal-setting feature',
  },

  goal_has_deadline: {
    icon: '📅',
    title: 'Add a Deadline to Your Goal',
    description:
      'Set a realistic deadline for your financial goal. Time-bound goals help you stay motivated and on track.',
    location: 'Add a target date to your goal to make it time-bound',
  },

  goal_progress_tracked: {
    icon: '📈',
    title: 'Track Your Goal Progress',
    description:
      'Monitor your progress toward your financial goal. Regular tracking helps maintain motivation.',
    location: 'Review your goal progress in the goal-tracking section',
  },

  smart_goal_completed: {
    icon: '🏆',
    title: 'Achieve Your SMART Goal',
    description:
      "Congratulations! You've completed a goal that meets all SMART criteria (Specific, Measurable, Achievable, Relevant, Time-bound).",
    location: 'Review your completed goal in the goal management section',
  },

  goal_savings_amount_set: {
    icon: '💰',
    title: 'Set Savings Goal Amount',
    description:
      'Specify how much money you want to save. Having a target amount makes your savings goal concrete.',
    location: 'Enter a specific dollar amount in your savings goal',
  },

  goal_timeline_realistic: {
    icon: '⏳',
    title: 'Ensure Realistic Timeline',
    description:
      'Your goal timeline is achievable given your income and expenses. Realistic timelines lead to success.',
    location: 'Review your goal deadline against your budget capacity',
  },

  multiple_goals_active: {
    icon: '🎯',
    title: 'Manage Multiple Financial Goals',
    description:
      "You're working toward multiple financial goals. Prioritize them by importance and deadline.",
    location: 'Review all your active goals and prioritize by importance',
  },

  // =====================================
  // 💬 COMMUNICATION CONDITIONS
  // =====================================

  message_sent: {
    icon: '📤',
    title: 'Send Messages to Class',
    description:
      'Communicate with your teacher and classmates about financial topics or ask questions.',
    location: 'Click "Messages" button → Compose and send message',
  },

  message_received: {
    icon: '📥',
    title: 'Check Your Messages',
    description:
      'Review messages from your teacher and classmates. Important financial tips and feedback may be waiting.',
    location: 'Click "Messages" button → Read incoming messages',
  },

  classmate_interaction: {
    icon: '👥',
    title: 'Interact with Classmates',
    description:
      'Engage with specific classmates through messages or money transfers. Collaboration enhances learning.',
    location:
      'Use "Messages" or "Send Money" to interact with the specified classmate',
  },

  // =====================================
  // 🏦 ADVANCED FINANCIAL CONDITIONS
  // =====================================

  loan_taken: {
    icon: '🏦',
    title: 'Understand Loan Impact',
    description:
      "You've taken a loan. Remember that loans must be repaid with interest. Consider the total cost carefully.",
    location: 'Review loan terms and calculate total repayment amount',
  },

  loan_amount_above: {
    icon: '💳',
    title: 'Manage Large Loan Amount',
    description:
      "You've taken a substantial loan. Ensure you can afford the monthly payments within your budget.",
    location: 'Review your budget to confirm loan payment affordability',
  },

  savings_goal_met: {
    icon: '🎉',
    title: 'Achieve Your Savings Goal',
    description:
      "Congratulations! You've reached your savings target. This demonstrates excellent financial discipline.",
    location:
      'Celebrate your achievement and consider setting a new savings goal',
  },

  emergency_fund_built: {
    icon: '🛡️',
    title: 'Build Emergency Fund',
    description:
      "You've built an emergency fund covering 3+ months of expenses. This provides excellent financial security.",
    location: 'Review your savings balance compared to your monthly expenses',
  },

  debt_to_income_high: {
    icon: '⚠️',
    title: 'Monitor Debt-to-Income Ratio',
    description:
      'Your debt payments are high compared to your income. Consider reducing debt or increasing income.',
    location: 'Review total loan payments compared to your monthly income',
  },

  // =====================================
  // 🎮 CHALLENGE CONDITIONS (These map to action types but need instruction templates)
  // =====================================

  challenge_transfer: {
    icon: '💸',
    title: 'Challenge: Complete a Transfer',
    description:
      "You've been challenged to make a transfer between your accounts. Show your money management skills!",
    location: 'Click "Transfer" button → Complete the challenge requirements',
  },

  challenge_deposit: {
    icon: '💰',
    title: 'Challenge: Make a Deposit',
    description:
      'Challenge accepted! Make a deposit to add money to your account and demonstrate financial responsibility.',
    location: 'Click "Deposits" button → Complete the deposit challenge',
  },

  challenge_create_bill: {
    icon: '📋',
    title: 'Challenge: Set Up a Bill',
    description:
      'Challenge yourself to add a new bill or expense. This helps you track all your financial obligations.',
    location:
      'Click "Bills & Payments" → Add a new bill to complete the challenge',
  },

  challenge_create_income: {
    icon: '💵',
    title: 'Challenge: Add Income Source',
    description:
      'Take the challenge to add a new income source. Multiple income streams provide financial stability.',
    location: 'Click "Bills & Payments" → Add a new income source',
  },

  challenge_save_amount: {
    icon: '💎',
    title: 'Challenge: Save Specific Amount',
    description:
      "You've been challenged to save a specific amount. Transfer money to savings to meet this goal!",
    location:
      'Use "Transfer" to move the required amount to your savings account',
  },

  challenge_send_money: {
    icon: '📤',
    title: 'Challenge: Send Money to Classmate',
    description:
      'Challenge accepted! Send money to a classmate to practice peer-to-peer payments.',
    location:
      'Click "Send Money" → Select classmate → Complete the challenge amount',
  },

  challenge_budget_balance: {
    icon: '⚖️',
    title: 'Challenge: Balance Your Budget',
    description:
      'Take on the challenge of creating a balanced budget where income meets or exceeds expenses.',
    location:
      'Review "Bills & Payments" → Adjust income and expenses to achieve balance',
  },

  // =====================================
  // 🔧 SIMULATION CONDITIONS (These simulate adding data)
  // =====================================

  add_virtual_transaction: {
    icon: '🔄',
    title: 'Review Virtual Transaction',
    description:
      'A sample transaction has been added to your account for learning purposes. Review how it affects your balance.',
    location: 'Check your transaction history in the main dashboard',
  },

  add_sample_bill: {
    icon: '📋',
    title: 'Review Sample Bill',
    description:
      'A sample bill has been added to demonstrate expense tracking. See how bills affect your budget.',
    location:
      'Click "Bills & Payments" → Review the sample bill that was added',
  },

  add_sample_income: {
    icon: '💵',
    title: 'Review Sample Income',
    description:
      'A sample income source has been added to show how regular income affects your financial picture.',
    location:
      'Click "Bills & Payments" → Review the sample income that was added',
  },

  // =====================================
  // 🎓 VALIDATION CONDITIONS (These validate goal quality)
  // =====================================

  validate_smart_goal: {
    icon: '✅',
    title: 'Validate Your SMART Goal',
    description:
      'Review your goal to ensure it meets all SMART criteria: Specific, Measurable, Achievable, Relevant, Time-bound.',
    location: 'Check your goal against the SMART criteria checklist',
  },

  guide_goal_improvement: {
    icon: '📈',
    title: 'Improve Your Goal',
    description:
      'Your goal needs refinement to meet SMART criteria. Consider making it more specific, measurable, or time-bound.',
    location: 'Edit your goal to improve its clarity and achievability',
  },

  congratulate_smart_goal: {
    icon: '🎉',
    title: 'Excellent SMART Goal!',
    description:
      'Outstanding! Your goal meets all SMART criteria and sets you up for financial success.',
    location:
      'Your goal is perfectly structured - now start working toward it!',
  },

  // =====================================
  // 🚀 FEATURE CONTROL CONDITIONS
  // =====================================

  force_account_switch: {
    icon: '🔄',
    title: 'Switch to Specific Account',
    description:
      "You've been directed to view a specific account type. This helps you understand different account purposes.",
    location:
      'The system will automatically switch you to the required account view',
  },

  unlock_feature: {
    icon: '🔓',
    title: 'New Feature Unlocked',
    description:
      "Congratulations! You've unlocked a new app feature through your progress. Explore your new capabilities.",
    location:
      'Look for newly available buttons or features in your app interface',
  },

  advance_to_section: {
    icon: '⏭️',
    title: 'Advance to Next Section',
    description:
      "You've completed this section! The system will guide you to the next part of the lesson.",
    location: 'Follow the system prompts to continue to the next section',
  },

  require_completion: {
    icon: '✋',
    title: 'Complete Required Task',
    description:
      'You must complete this specific task before proceeding. Focus on meeting the requirement.',
    location: 'Complete the highlighted task before moving forward',
  },

  complete_lesson: {
    icon: '🏁',
    title: 'Lesson Complete!',
    description:
      "Congratulations! You've successfully completed all lesson requirements. Your score is being calculated.",
    location: 'Review your lesson progress and prepare for your final score',
  },

  restart_student: {
    icon: '🔄',
    title: 'Restart Lesson',
    description:
      'The lesson is restarting to give you another opportunity to master the concepts.',
    location:
      'The system will reset your progress and guide you through the lesson again',
  },

  // =====================================
  // 🎮 GAMIFICATION CONDITIONS
  // =====================================

  compare_to_peers: {
    icon: '📊',
    title: 'Compare to Class Average',
    description:
      'See how your financial progress compares to your classmates. Healthy competition encourages improvement.',
    location: 'Review the class comparison data displayed',
  },

  show_calculation: {
    icon: '🧮',
    title: 'Review Financial Calculation',
    description:
      'A financial calculation has been performed to help you understand the numbers behind your decisions.',
    location: 'Review the calculation details shown on screen',
  },

  praise_good_habit: {
    icon: '👏',
    title: 'Excellent Financial Habit!',
    description:
      "Outstanding! You've demonstrated a positive financial behavior that will serve you well in the future.",
    location: 'Continue practicing this good financial habit',
  },

  warn_poor_choice: {
    icon: '⚠️',
    title: 'Reconsider This Choice',
    description:
      'This financial decision may not be in your best interest. Consider the long-term consequences.',
    location: 'Review your decision and consider alternative approaches',
  },

  explain_consequence: {
    icon: '💡',
    title: 'Understand the Consequences',
    description:
      'This action has important financial consequences. Understanding these helps you make better future decisions.',
    location:
      'Read the explanation of how this choice affects your financial future',
  },

  // =====================================
  // 🎯 PROGRESS TRACKING CONDITIONS
  // =====================================

  show_tip: {
    icon: '💡',
    title: 'Financial Tip',
    description:
      "Here's a helpful tip to improve your financial knowledge and decision-making skills.",
    location: 'Read the financial tip displayed and apply it to your situation',
  },

  highlight_feature: {
    icon: '✨',
    title: 'Explore Highlighted Feature',
    description:
      'A specific app feature is being highlighted to help you learn its purpose and functionality.',
    location: 'Focus on the highlighted area of the app interface',
  },

  suggest_action: {
    icon: '👉',
    title: 'Suggested Next Step',
    description:
      "Based on your current progress, here's a recommended action to help you continue learning effectively.",
    location:
      'Follow the suggested action to optimize your learning experience',
  },

  send_message: {
    icon: '📨',
    title: 'Educational Message',
    description:
      'An educational message has been sent to help you understand important financial concepts.',
    location:
      'Read the message content carefully and apply the lessons learned',
  },

  add_text_block: {
    icon: '📝',
    title: 'Additional Learning Content',
    description:
      'Additional educational content has been provided to deepen your understanding of the topic.',
    location: 'Review the new text content that has been added to your lesson',
  },
};

/**
 * Get instruction template for a specific condition type
 * @param {string} conditionType - The condition type to get template for
 * @returns {Object|null} The instruction template or null if not found
 */
export function getInstructionTemplate(conditionType) {
  return instructionTemplates[conditionType] || null;
}

/**
 * Get all available condition types that have instruction templates
 * @returns {Array<string>} Array of condition type names
 */
export function getAvailableConditionTypes() {
  return Object.keys(instructionTemplates);
}

/**
 * Check if a condition type has an instruction template
 * @param {string} conditionType - The condition type to check
 * @returns {boolean} True if template exists, false otherwise
 */
export function hasInstructionTemplate(conditionType) {
  return conditionType in instructionTemplates;
}

/**
 * Get templates organized by category
 * @returns {Object} Templates organized by feature category
 */
export function getTemplatesByCategory() {
  return {
    'Account Balance': [
      'bank_balance_above',
      'bank_balance_below',
      'checking_balance_above',
      'checking_balance_below',
      'savings_balance_above',
      'savings_balance_below',
      'balance_ratio_savings_above',
    ],
    'Transfers & Transactions': [
      'transfer_completed',
      'transfer_amount_above',
      'deposit_completed',
      'deposit_amount_above',
      'money_sent',
      'money_received',
      'total_transactions_above',
    ],
    'Bills & Income': [
      'bill_created',
      'payment_created',
      'total_bills_above',
      'total_income_above',
      'budget_negative',
      'budget_positive_above',
      'bills_count_above',
      'income_count_above',
    ],
    'Account Navigation': [
      'account_switched',
      'checking_used_more',
      'savings_used_more',
      'account_type_active',
    ],
    'Time & Progress': [
      'elapsed_time',
      'lesson_revisited',
      'lesson_completion_trigger',
    ],
    'Goal Setting': [
      'goal_set_specific',
      'goal_set_measurable',
      'goal_has_deadline',
      'goal_progress_tracked',
      'smart_goal_completed',
      'goal_savings_amount_set',
      'goal_timeline_realistic',
      'multiple_goals_active',
    ],
    Communication: [
      'message_sent',
      'message_received',
      'classmate_interaction',
    ],
    'Advanced Financial': [
      'loan_taken',
      'loan_amount_above',
      'savings_goal_met',
      'emergency_fund_built',
      'debt_to_income_high',
    ],
    Challenges: [
      'challenge_transfer',
      'challenge_deposit',
      'challenge_create_bill',
      'challenge_create_income',
      'challenge_save_amount',
      'challenge_send_money',
      'challenge_budget_balance',
    ],
    'Learning Support': [
      'show_tip',
      'highlight_feature',
      'suggest_action',
      'send_message',
      'add_text_block',
      'praise_good_habit',
      'warn_poor_choice',
      'explain_consequence',
      'show_calculation',
      'compare_to_peers',
    ],
  };
}
