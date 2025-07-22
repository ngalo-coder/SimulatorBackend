import emailService from '../src/services/emailService.js';
import 'dotenv/config';

const testEmailNotifications = async () => {
  console.log('--- Testing Email Notifications ---');

  // Test eligibility_achieved notification
  console.log('\nTesting eligibility_achieved notification...');
  await emailService.notifyEligibilityAchieved('otienodominic@gmail.com', 'Dominic Otieno', ['Internal Medicine']);

  // Test case_approved notification
  console.log('\nTesting case_approved notification...');
  await emailService.notifyCaseApproved('otienodominic@gmail.com', 'Dominic Otieno', 'Test Case', 'Good work!');

  // Test case_rejected notification
  console.log('\nTesting case_rejected notification...');
  await emailService.notifyCaseRejected('otienodominic@gmail.com', 'Dominic Otieno', 'Test Case', 'Needs improvement');

  console.log('\n--- Email Notification Testing Complete ---');
};

testEmailNotifications();
