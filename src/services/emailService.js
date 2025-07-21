// Email notification service for case contribution system
// This is a basic implementation - replace with your preferred email service

import logger from '../config/logger.js';

// Mock email service - replace with actual email provider (SendGrid, AWS SES, etc.)
class EmailService {
  constructor() {
    this.enabled = process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@medicalsimulator.com';
  }

  async sendEmail(to, subject, htmlContent, textContent) {
    if (!this.enabled) {
      logger.info(`Email notification disabled. Would send to ${to}: ${subject}`);
      return { success: true, message: 'Email notifications disabled' };
    }

    try {
      // TODO: Replace with actual email service implementation
      // Example with SendGrid:
      // const msg = {
      //   to,
      //   from: this.fromEmail,
      //   subject,
      //   text: textContent,
      //   html: htmlContent,
      // };
      // await sgMail.send(msg);

      logger.info(`Email sent to ${to}: ${subject}`);
      return { success: true, message: 'Email sent successfully' };
    } catch (error) {
      logger.error('Error sending email:', error);
      return { success: false, error: error.message };
    }
  }

  // Case submission notification to admin
  async notifyAdminCaseSubmitted(contributorName, contributorEmail, caseTitle, caseId) {
    const subject = `New Case Submitted for Review: ${caseTitle}`;
    const htmlContent = `
      <h2>New Case Submission</h2>
      <p>A new case has been submitted for review:</p>
      <ul>
        <li><strong>Case Title:</strong> ${caseTitle}</li>
        <li><strong>Contributor:</strong> ${contributorName} (${contributorEmail})</li>
        <li><strong>Case ID:</strong> ${caseId}</li>
      </ul>
      <p>Please review the case in the admin dashboard.</p>
      <p><a href="${process.env.FRONTEND_URL}/admin/review">Review Cases</a></p>
    `;
    const textContent = `New case submitted: ${caseTitle} by ${contributorName}. Please review in admin dashboard.`;

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@medicalsimulator.com';
    return await this.sendEmail(adminEmail, subject, htmlContent, textContent);
  }

  // Case approved notification to contributor
  async notifyCaseApproved(contributorEmail, contributorName, caseTitle, reviewComments) {
    const subject = `🎉 Your Case Has Been Approved: ${caseTitle}`;
    const htmlContent = `
      <h2>Congratulations!</h2>
      <p>Dear ${contributorName},</p>
      <p>Your contributed case "<strong>${caseTitle}</strong>" has been approved and added to the medical simulator database!</p>
      ${reviewComments ? `<p><strong>Reviewer Comments:</strong><br>${reviewComments}</p>` : ''}
      <p>Thank you for contributing to the medical education community. Your case will help train future healthcare professionals.</p>
      <p><a href="${process.env.FRONTEND_URL}/contribute">View Your Contributions</a></p>
      <p>Best regards,<br>Medical Simulator Team</p>
    `;
    const textContent = `Congratulations! Your case "${caseTitle}" has been approved and added to the database. Thank you for your contribution!`;

    return await this.sendEmail(contributorEmail, subject, htmlContent, textContent);
  }

  // Case rejected notification to contributor
  async notifyCaseRejected(contributorEmail, contributorName, caseTitle, reviewComments) {
    const subject = `Case Review Update: ${caseTitle}`;
    const htmlContent = `
      <h2>Case Review Update</h2>
      <p>Dear ${contributorName},</p>
      <p>Thank you for submitting your case "<strong>${caseTitle}</strong>". After review, we are unable to approve it at this time.</p>
      <p><strong>Reviewer Feedback:</strong><br>${reviewComments}</p>
      <p>We encourage you to continue contributing cases. Please feel free to submit new cases that address the feedback provided.</p>
      <p><a href="${process.env.FRONTEND_URL}/contribute">Submit New Case</a></p>
      <p>Best regards,<br>Medical Simulator Team</p>
    `;
    const textContent = `Your case "${caseTitle}" was not approved. Reviewer feedback: ${reviewComments}`;

    return await this.sendEmail(contributorEmail, subject, htmlContent, textContent);
  }

  // Case revision requested notification to contributor
  async notifyRevisionRequested(contributorEmail, contributorName, caseTitle, reviewComments, revisionRequests) {
    const subject = `Revision Requested: ${caseTitle}`;
    const revisionList = revisionRequests.map(req => `• ${req.field}: ${req.comment}`).join('\n');
    
    const htmlContent = `
      <h2>Revision Requested</h2>
      <p>Dear ${contributorName},</p>
      <p>Your case "<strong>${caseTitle}</strong>" needs some revisions before it can be approved.</p>
      <p><strong>General Comments:</strong><br>${reviewComments}</p>
      <p><strong>Specific Revisions Needed:</strong></p>
      <ul>
        ${revisionRequests.map(req => `<li><strong>${req.field}:</strong> ${req.comment}</li>`).join('')}
      </ul>
      <p>Please make the requested changes and resubmit your case.</p>
      <p><a href="${process.env.FRONTEND_URL}/contribute">Edit Your Case</a></p>
      <p>Best regards,<br>Medical Simulator Team</p>
    `;
    const textContent = `Revision requested for "${caseTitle}". Comments: ${reviewComments}. Revisions: ${revisionList}`;

    return await this.sendEmail(contributorEmail, subject, htmlContent, textContent);
  }

  // Contributor eligibility achieved notification
  async notifyEligibilityAchieved(userEmail, userName, eligibleSpecialties) {
    const subject = '🎉 You\'re Now Eligible to Contribute Cases!';
    const specialtiesList = eligibleSpecialties.join(', ');
    
    const htmlContent = `
      <h2>Congratulations on Your Achievement!</h2>
      <p>Dear ${userName},</p>
      <p>Based on your excellent performance in case evaluations, you are now eligible to contribute new cases to the medical simulator!</p>
      <p><strong>You can contribute cases in:</strong> ${specialtiesList}</p>
      <p>This is a recognition of your clinical expertise and commitment to medical education. Your contributions will help train the next generation of healthcare professionals.</p>
      <p><a href="${process.env.FRONTEND_URL}/contribute/new">Start Contributing Cases</a></p>
      <p>Thank you for your dedication to medical education!</p>
      <p>Best regards,<br>Medical Simulator Team</p>
    `;
    const textContent = `Congratulations! You're now eligible to contribute cases in: ${specialtiesList}. Start contributing at ${process.env.FRONTEND_URL}/contribute/new`;

    return await this.sendEmail(userEmail, subject, htmlContent, textContent);
  }
}

export default new EmailService();