const Case = require('../models/Case');

exports.getSpecialties = async (req, res) => {
    const { category } = req.query;
    if (!category) return res.status(400).json({ error: 'Category required' });
    const specialties = await Case.distinct('specialty', { category });
    res.json(specialties);
};

exports.getCases = async (req, res) => {
    const { category, specialty } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (specialty) filter.specialty = specialty;
    const cases = await Case.find(filter).select('title patientProfile.chiefComplaint patientProfile.age patientProfile.gender specialty');
    res.json(cases);
};
