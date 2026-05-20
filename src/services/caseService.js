import Case from '../models/CaseModel.js';
import Specialty from '../models/SpecialtyModel.js';

export class CaseService {
  static CASE_FIELDS = [
    'case_metadata.case_id',
    'case_metadata.title',
    'description',
    // 'case_metadata.difficulty', // Removed from API response but kept in DB for background grading
    // 'case_metadata.estimated_duration_min', // Removed from API response - duration is given in case data
    'case_metadata.program_area',
    'case_metadata.specialty',
    'case_metadata.specialized_area',
    'patient_persona.age',
    'patient_persona.gender',
    'patient_persona.chief_complaint',
    'clinical_dossier.history_of_presenting_illness.associated_symptoms',
    'case_metadata.tags'
  ].join(' ');

  static DIAGNOSIS_TRIGGERS = [
    'heart attack',
    'myocardial infarction',
    'emergency',
    'admit',
    'admitted',
    'treatment',
    'ward',
    'emergency care'
  ];

  static buildQuery(filters) {
    const { program_area, specialty, specialized_area } = filters;
    const query = {};

    if (program_area) query['case_metadata.program_area'] = program_area;
    if (specialty) query['case_metadata.specialty'] = specialty;
    
    if (specialized_area) {
      query['case_metadata.specialized_area'] = ["null", "None", ""].includes(specialized_area)
        ? { $in: [null, ""] }
        : specialized_area;
    }

    return query;
  }

  static formatCase(caseData) {
    const { case_metadata: meta, patient_persona: patient, clinical_dossier: clinical } = caseData;
    
    // Format the title - Focus on key clinical presentation
    const formatClinicalTitle = (complaint, hpi) => {
      // Extract key clinical elements
      const onset = hpi?.onset?.toLowerCase() || '';
      const location = hpi?.location?.toLowerCase() || '';
      const duration = hpi?.timing_and_duration?.toLowerCase() || '';
      const severity = hpi?.severity?.toLowerCase() || '';
      
      // Common clinical patterns
      const isAcute = onset?.includes('sudden') || onset?.includes('acute') || duration?.includes('hour') || duration?.includes('day');
      const isChronic = duration?.includes('month') || duration?.includes('year') || onset?.includes('gradual');
      const isProgressive = onset?.includes('progressive') || onset?.includes('worsening');
      const isRecurrent = duration?.includes('recurring') || duration?.includes('episodic');
      const isUnilateral = location?.includes('right') || location?.includes('left');
      const isSevere = severity?.includes('severe') || severity?.includes('10') || severity?.includes('9');
      
      // Build clinically relevant title
      let title = complaint?.split('.')[0] || '';
      
      // Add clinical modifiers
      if (isAcute) title = `Acute ${title}`;
      if (isChronic) title = `Chronic ${title}`;
      if (isProgressive) title = `Progressive ${title}`;
      if (isRecurrent) title = `Recurrent ${title}`;
      if (isUnilateral && !title.toLowerCase().includes('unilateral')) title = `Unilateral ${title}`;
      if (isSevere && !title.toLowerCase().includes('severe')) title = `Severe ${title}`;
      
      // Cleanup and standardize
      return title
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
        .trim() || 'Unknown Case';
    };

    const formattedTitle = formatClinicalTitle(patient?.chief_complaint, clinical?.history_of_presenting_illness);
    const age = patient?.age || '';
    const gender = patient?.gender?.toLowerCase() || 'patient';
    const chiefComplaint = patient?.chief_complaint || '';
    const hpi = clinical?.history_of_presenting_illness || {};
    
    // Format clinical description professionally
    const formatDescription = (age, gender, complaint, history) => {
      // Extract relevant history elements
      const onset = history?.onset?.toLowerCase() || '';
      const timing = history?.timing_and_duration?.toLowerCase() || '';
      const location = history?.location?.toLowerCase() || '';
      
      // Build professional clinical description
      let description = `A ${age}-year-old ${gender} patient`;
      
      // Add presenting problem with proper clinical phrasing
      if (complaint) {
        description += ` presenting with ${complaint.toLowerCase()}`;
        
        // Add onset if available
        if (onset && !complaint.toLowerCase().includes(onset)) {
          if (onset.includes('sudden') || onset.includes('acute')) {
            description += ` of sudden onset`;
          } else if (onset.includes('gradual')) {
            description += ` of gradual onset`;
          } else if (timing.includes('hour') || timing.includes('day')) {
            description += ` that started ${timing}`;
          }
        }
        
        // Add location if relevant
        if (location && !complaint.toLowerCase().includes(location)) {
          description += ` affecting the ${location}`;
        }
      }
      
      return description + '.';
    };

    const description = formatDescription(age, gender, chiefComplaint, hpi);

    // Format the presenting complaint with structured clinical details
    const presentingComplaint = [
      `Presenting Complaint: ${chiefComplaint}`,
      hpi.onset ? `Onset: ${hpi.onset}` : null,
      hpi.timing_and_duration ? `Duration: ${hpi.timing_and_duration}` : null,
      hpi.location ? `Location: ${hpi.location}` : null,
      hpi.character ? `Character: ${hpi.character}` : null,
      hpi.severity ? `Severity: ${hpi.severity}` : null
    ].filter(Boolean).join('\n');
    
    return {
      id: meta?.case_id,
      title: formattedTitle,
      description: description,
      presentingComplaint: presentingComplaint,
      category: meta?.specialized_area,
      // estimated_time removed - duration is provided within case data
      program_area: meta?.program_area,
      specialty: meta?.specialty,
      specialized_area: meta?.specialized_area,
      patient_age: patient?.age,
      patient_gender: patient?.gender,
      chief_complaint: patient?.chief_complaint,
      presenting_symptoms: clinical?.history_of_presenting_illness?.associated_symptoms || [],
      tags: meta?.tags || []
    };
  }

  static async getCases(queryParams) {
    const { page = 1, limit = 20 } = queryParams;
    const query = this.buildQuery(queryParams);
    
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Enforce global specialty visibility: only include cases whose specialty is visible
    const visibleSpecialties = await Specialty.find({ active: true, isVisible: true }).distinct('name');

    if (visibleSpecialties && visibleSpecialties.length > 0) {
      // If a specialty filter is provided in the query, ensure it intersects with visible ones
      if (query['case_metadata.specialty']) {
        const requested = query['case_metadata.specialty'];
        if (typeof requested === 'string') {
          // If the requested specialty is not visible, return empty result
          if (!visibleSpecialties.includes(requested)) {
            return {
              cases: [],
              currentPage: pageNum,
              totalPages: 0,
              totalCases: 0
            };
          }
        } else if (requested && requested.$in) {
          // Narrow down $in list to visible specialties
          requested.$in = requested.$in.filter(s => visibleSpecialties.includes(s));
          // If no intersection remains, return empty
          if (!requested.$in || requested.$in.length === 0) {
            return {
              cases: [],
              currentPage: pageNum,
              totalPages: 0,
              totalCases: 0
            };
          }
        }
      } else {
        query['case_metadata.specialty'] = { $in: visibleSpecialties };
      }
    } else {
      // If no specialties are visible, return empty result set
      return {
        cases: [],
        currentPage: pageNum,
        totalPages: 0,
        totalCases: 0
      };
    }

    const [casesFromDB, totalCases] = await Promise.all([
      Case.find(query).select(this.CASE_FIELDS).sort({ 'case_metadata.case_id': 1 }).skip(skip).limit(limitNum).lean(),
      Case.countDocuments(query)
    ]);

    return {
      cases: casesFromDB.map(this.formatCase),
      currentPage: pageNum,
      totalPages: Math.ceil(totalCases / limitNum),
      totalCases
    };
  }

  static async getCaseCategories(program_area) {
    const baseQuery = program_area ? { 'case_metadata.program_area': program_area } : {};

    // Normalize program area for database query
    // Frontend sends: 'Basic Program' or 'Specialty Program'
    // Database stores: 'Basic Program' or 'Specialty Program' (with spaces)
    const normalizeProgramArea = (area) => {
      if (!area) return null;
      // Database actually stores the values with proper capitalization and spaces
      if (area === 'basic') return 'Basic Program';
      if (area === 'specialty') return 'Specialty Program';
      if (area === 'Basic Program') return 'Basic Program';
      if (area === 'Specialty Program') return 'Specialty Program';
      return area;
    };

    const normalizedProgramArea = normalizeProgramArea(program_area);

    const [programAreas, caseSpecialties, specializedAreas, allSpecialties] = await Promise.all([
      Case.distinct('case_metadata.program_area'),
      Case.distinct('case_metadata.specialty', baseQuery),
      Case.distinct('case_metadata.specialized_area'),
      Specialty.find({ active: true, isVisible: true }, 'name programArea').lean()
    ]);

    // Filter specialties by program area if specified
    let availableSpecialties;
    if (normalizedProgramArea) {
      availableSpecialties = allSpecialties
        .filter(s => s.programArea === normalizedProgramArea)
        .map(s => s.name)
        .sort();
    } else {
      availableSpecialties = allSpecialties.map(s => s.name).sort();
    }

    // Get case counts for each specialty when program_area is specified
    let specialty_counts = {};
    if (program_area && caseSpecialties.length > 0) {
      const countPromises = caseSpecialties
        .filter(s => s?.trim())
        .map(async (specialty) => {
          const count = await Case.countDocuments({
            'case_metadata.program_area': program_area,
            'case_metadata.specialty': specialty
          });
          return { specialty, count };
        });

      const counts = await Promise.all(countPromises);
      specialty_counts = counts.reduce((acc, { specialty, count }) => {
        acc[specialty] = count;
        return acc;
      }, {});
    }

  // Also include specialties from cases that might not be in the Specialty collection
  // But only if they exist as active and visible specialties in the Specialty collection
    const caseSpecialtyNames = caseSpecialties.filter(s => s?.trim());

    // Filter case specialties to only include those that are active in the Specialty collection
    const activeSpecialtyNames = new Set(availableSpecialties);
    const filteredCaseSpecialties = caseSpecialtyNames.filter(specialty => activeSpecialtyNames.has(specialty));

    // Merge specialties from both sources
    const allAvailableSpecialties = [...new Set([...availableSpecialties, ...filteredCaseSpecialties])].sort();

    // Get counts for all specialties found in cases (only active ones)
    const allSpecialtyCounts = {};
    for (const specialty of filteredCaseSpecialties) {
      if (program_area) {
        allSpecialtyCounts[specialty] = await Case.countDocuments({
          'case_metadata.program_area': program_area,
          'case_metadata.specialty': specialty
        });
      } else {
        allSpecialtyCounts[specialty] = await Case.countDocuments({
          'case_metadata.specialty': specialty
        });
      }
    }

    // Get accurate case counts for program areas
    const programAreaCounts = {};
    for (const programArea of programAreas) {
      programAreaCounts[programArea] = await Case.countDocuments({
        'case_metadata.program_area': programArea
      });
    }

    console.log('CaseService.getCaseCategories results:', {
      programAreas: programAreas.length,
      caseSpecialties: caseSpecialtyNames.length,
      dbSpecialties: availableSpecialties.length,
      allSpecialties: allAvailableSpecialties.length,
      program_area,
      programAreaCounts,
      specialtyCounts: allSpecialtyCounts
    });

    return {
      program_areas: programAreas.sort(),
      specialties: allAvailableSpecialties,
      specialized_areas: specializedAreas.filter(a => a?.trim()).sort(),
      specialty_counts: allSpecialtyCounts,
      program_area_counts: programAreaCounts
    };
  }

  static shouldEndSession(question) {
    return this.DIAGNOSIS_TRIGGERS.some(trigger => 
      question.toLowerCase().includes(trigger)
    );
  }
}

export default CaseService;