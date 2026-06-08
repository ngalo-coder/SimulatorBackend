const Case = require('../models/Case');

exports.getSpecialties = async (req, res) => {
    try {
      const { category } = req.query;
      if (!category) return res.status(400).json({ error: 'Category required' });
      const specialties = await Case.distinct('specialty', { category });
      res.json(specialties);
    } catch (err) {
      console.error('❌ getSpecialties error:', err.message);
      res.status(500).json({ error: 'Failed to load specialties' });
    }
};

exports.getCases = async (req, res) => {
    try {
      const { category, specialty } = req.query;
      const filter = {};
      if (category) filter.category = category;
      if (specialty) filter.specialty = specialty;
      const cases = await Case.find(filter).select('title difficulty patientProfile.chiefComplaint patientProfile.age patientProfile.gender patientProfile.patientPersonality specialty');
      res.json(cases);
    } catch (err) {
      console.error('❌ getCases error:', err.message);
      res.status(500).json({ error: 'Failed to load cases' });
    }
};
