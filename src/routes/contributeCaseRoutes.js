import express from 'express';
import ContributedCase from '../models/ContributedCaseModel.js';
import Case from '../models/CaseModel.js';
import { checkContributorEligibility } from '../middleware/performanceMiddleware.js';
import { protect as requireAuth, optionalAuth as extractUserInfo } from '../middleware/jwtAuthMiddleware.js';

const router = express.Router();

// Get case contribution form data (specialties, modules, etc.)
router.get('/form-data', async (req, res) => {
  try {
    // Get available specialties and modules from existing cases
    const specialties = await Case.distinct('case_metadata.specialty');
    const modules = await Case.distinct('case_metadata.module');
    
    // Module mapping for Internal Medicine
    const internalMedicineModules = [
      'Cardiovascular System',
      'Tropical Medicine', 
      'Central Nervous System',
      'Respiratory System',
      'Genital Urinary System',
      'Musculoskeletal System',
      'Endocrinology',
      'Emergency Medicine'
    ];
    
    const formData = {
      specialties: specialties.filter(s => s), // Remove null values
      modules: {
        'Internal Medicine': internalMedicineModules,
        'Pediatrics': [],
        'General Surgery': [],
        'Reproductive Health': []
      },
      programAreas: ['Basic Program', 'Specialty Program'],
      difficulties: ['Easy', 'Intermediate', 'Hard'],
      locations: ['East Africa', 'West Africa', 'Central Africa', 'Southern Africa', 'Global'],
      genders: ['Male', 'Female', 'Other'],
      emotionalTones: [
        'Anxious and worried',
        'Calm but concerned', 
        'Frustrated and impatient',
        'Scared and vulnerable',
        'Hopeful but uncertain',
        'Tired and exhausted',
        'Confused and overwhelmed'
      ]
    };
    
    res.json(formData);
  } catch (error) {
    console.error('Error fetching form data:', error);
    res.status(500).json({ error: 'Failed to fetch form data' });
  }
});

// Save case as draft (requires auth and eligibility check)
router.post('/draft', extractUserInfo, requireAuth, checkContributorEligibility, async (req, res) => {
  try {
    const { caseData } = req.body;
    const { id: contributorId, name: contributorName, email: contributorEmail } = req.user;
    
    const contributedCase = new ContributedCase({
      contributorId,
      contributorName,
      contributorEmail,
      caseData,
      status: 'draft'
    });
    
    await contributedCase.save();
    
    res.status(201).json({
      message: 'Case draft saved successfully',
      caseId: contributedCase._id,
      generatedCaseId: contributedCase.caseData.case_metadata.case_id
    });
  } catch (error) {
    console.error('Error saving draft:', error);
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

// Submit case for review (requires auth and eligibility check)
router.post('/submit', extractUserInfo, requireAuth, checkContributorEligibility, async (req, res) => {
  try {
    const { caseData } = req.body;
    const { id: contributorId, name: contributorName, email: contributorEmail } = req.user;
    
    // Validate required fields
    const requiredFields = [
      'case_metadata.title',
      'case_metadata.specialty', 
      'case_metadata.program_area',
      'case_metadata.difficulty',
      'case_metadata.location',
      'patient_persona.name',
      'patient_persona.age',
      'patient_persona.gender',
      'patient_persona.chief_complaint',
      'patient_persona.emotional_tone',
      'clinical_dossier.hidden_diagnosis',
      'initial_prompt'
    ];
    
    const missingFields = [];
    requiredFields.forEach(field => {
      const fieldPath = field.split('.');
      let value = caseData;
      for (const path of fieldPath) {
        value = value?.[path];
      }
      if (!value) {
        missingFields.push(field);
      }
    });
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        missingFields
      });
    }
    
    const contributedCase = new ContributedCase({
      contributorId,
      contributorName,
      contributorEmail,
      caseData,
      status: 'submitted',
      submittedAt: new Date()
    });
    
    await contributedCase.save();
    
    res.status(201).json({
      message: 'Case submitted successfully for review',
      caseId: contributedCase._id,
      generatedCaseId: contributedCase.caseData.case_metadata.case_id
    });
  } catch (error) {
    console.error('Error submitting case:', error);
    res.status(500).json({ error: 'Failed to submit case' });
  }
});

// Get contributor's cases (requires auth)
router.get('/my-cases', extractUserInfo, requireAuth, async (req, res) => {
  try {
    const contributorId = req.user.id;
    
    const cases = await ContributedCase.find({ contributorId })
      .sort({ updatedAt: -1 })
      .select('_id status caseData.case_metadata.title caseData.case_metadata.specialty caseData.case_metadata.case_id submittedAt createdAt reviewComments');
    
    res.json(cases);
  } catch (error) {
    console.error('Error fetching contributor cases:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// Get case for editing
router.get('/edit/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    
    const contributedCase = await ContributedCase.findById(caseId);
    
    if (!contributedCase) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    // Only allow editing of draft or needs_revision cases
    if (!['draft', 'needs_revision'].includes(contributedCase.status)) {
      return res.status(403).json({ error: 'Case cannot be edited in current status' });
    }
    
    res.json(contributedCase);
  } catch (error) {
    console.error('Error fetching case for editing:', error);
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

// Update case
router.put('/update/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { caseData } = req.body;
    
    const contributedCase = await ContributedCase.findById(caseId);
    
    if (!contributedCase) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    // Only allow updating of draft or needs_revision cases
    if (!['draft', 'needs_revision'].includes(contributedCase.status)) {
      return res.status(403).json({ error: 'Case cannot be updated in current status' });
    }
    
    contributedCase.caseData = caseData;
    contributedCase.updatedAt = new Date();
    
    await contributedCase.save();
    
    res.json({
      message: 'Case updated successfully',
      caseId: contributedCase._id
    });
  } catch (error) {
    console.error('Error updating case:', error);
    res.status(500).json({ error: 'Failed to update case' });
  }
});

// Delete draft case
router.delete('/delete/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    
    const contributedCase = await ContributedCase.findById(caseId);
    
    if (!contributedCase) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    // Only allow deleting draft cases
    if (contributedCase.status !== 'draft') {
      return res.status(403).json({ error: 'Only draft cases can be deleted' });
    }
    
    await ContributedCase.findByIdAndDelete(caseId);
    
    res.json({ message: 'Case deleted successfully' });
  } catch (error) {
    console.error('Error deleting case:', error);
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

export default router;