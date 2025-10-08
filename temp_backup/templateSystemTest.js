/**
 * Template System Integration Test
 * Verifies that the instruction template system covers all teacher dashboard conditions
 */

import {
  getInstructionTemplate,
  hasInstructionTemplate,
  getAvailableConditionTypes,
  getTemplatesByCategory,
} from './instructionTemplates.js';

// Test conditions from teacher dashboard
const teacherDashboardConditions = [
  'bank_balance_above',
  'bank_balance_below',
  'transfer_completed',
  'goal_set_specific',
  'elapsed_time',
  'bill_created',
  'payment_created',
  'message_sent',
  'lesson_revisited',
  'account_switched',
  'deposit_completed',
  'money_sent',
  'challenge_transfer',
  'show_tip',
  'highlight_feature',
  'add_text_block',
  'loan_taken',
  'savings_goal_met',
  'budget_negative',
  'classmate_interaction',
];

console.log('=== Template System Integration Test ===\n');

// Test 1: Check template coverage
console.log('1. Template Coverage Test:');
let missingTemplates = [];
teacherDashboardConditions.forEach(condition => {
  const hasTemplate = hasInstructionTemplate(condition);
  const status = hasTemplate ? '✅' : '❌';
  console.log(`   ${status} ${condition}`);
  if (!hasTemplate) missingTemplates.push(condition);
});

if (missingTemplates.length === 0) {
  console.log('   🎉 All teacher dashboard conditions have templates!\n');
} else {
  console.log(`   ⚠️  Missing templates for: ${missingTemplates.join(', ')}\n`);
}

// Test 2: Template structure validation
console.log('2. Template Structure Test:');
const sampleCondition = 'bank_balance_above';
const template = getInstructionTemplate(sampleCondition);

if (template) {
  const requiredFields = ['icon', 'title', 'description', 'location'];
  const hasAllFields = requiredFields.every(field => template[field]);
  console.log(
    `   ✅ Template structure for '${sampleCondition}': ${hasAllFields ? 'VALID' : 'INVALID'}`,
  );
  console.log(`      Icon: ${template.icon}`);
  console.log(`      Title: ${template.title}`);
  console.log(`      Description: ${template.description.substring(0, 50)}...`);
} else {
  console.log(`   ❌ No template found for ${sampleCondition}`);
}

// Test 3: Category organization
console.log('\n3. Category Organization Test:');
const categories = getTemplatesByCategory();
const totalTemplates = getAvailableConditionTypes().length;
const categorizedCount = Object.values(categories).flat().length;

console.log(`   Total templates: ${totalTemplates}`);
console.log(`   Categorized templates: ${categorizedCount}`);
console.log(`   Categories: ${Object.keys(categories).length}`);

// Test 4: No more "Complete Activity" fallbacks
console.log('\n4. Fallback Elimination Test:');
const problematicConditions = [
  'elapsed_time',
  'payment_created',
  'lesson_revisited',
];
problematicConditions.forEach(condition => {
  const template = getInstructionTemplate(condition);
  if (template) {
    const hasVagueInstruction =
      template.description.includes('Complete Activity') ||
      template.description.includes('Please complete');
    console.log(
      `   ${hasVagueInstruction ? '❌' : '✅'} ${condition}: ${hasVagueInstruction ? 'Still vague' : 'Specific instruction'}`,
    );
  } else {
    console.log(`   ❌ ${condition}: No template found`);
  }
});

console.log('\n=== Test Complete ===');
