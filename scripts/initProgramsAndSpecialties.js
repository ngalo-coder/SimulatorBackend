import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ProgramArea from '../src/models/ProgramAreaModel.js';
import Specialty from '../src/models/SpecialtyModel.js';
import Case from '../src/models/CaseModel.js';
import connectDB from '../src/config/db.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB
await connectDB();

async function initializeProgramAreasAndSpecialties() {
  try {
    console.log('Starting initialization of program areas and specialties...');
    
    // Get existing program areas and specialties from cases
    const existingProgramAreas = await Case.distinct('case_metadata.program_area');
    const existingSpecialties = await Case.distinct('case_metadata.specialty');
    
    console.log('Existing program areas from cases:', existingProgramAreas);
    console.log('Existing specialties from cases:', existingSpecialties);
    
    // Create program areas collection if it doesn't exist
    const programAreasCount = await ProgramArea.countDocuments();
    if (programAreasCount === 0) {
      console.log('Creating program areas collection...');
      
      const programAreasToCreate = existingProgramAreas
        .filter(area => area && area.trim() !== '')
        .map(area => ({
          name: area,
          description: `${area} program for medical training`,
          active: true
        }));
      
      if (programAreasToCreate.length > 0) {
        await ProgramArea.insertMany(programAreasToCreate);
        console.log(`Created ${programAreasToCreate.length} program areas`);
      } else {
        console.log('No program areas to create');
        
        // Create default program areas if none exist
        await ProgramArea.insertMany([
          {
            name: 'Basic Program',
            description: 'Fundamental medical training program',
            active: true
          },
          {
            name: 'Specialty Program',
            description: 'Advanced specialized medical training',
            active: true
          }
        ]);
        console.log('Created default program areas');
      }
    } else {
      console.log(`Program areas collection already exists with ${programAreasCount} entries`);
    }
    
    // Create specialties collection if it doesn't exist
    const specialtiesCount = await Specialty.countDocuments();
    if (specialtiesCount === 0) {
      console.log('Creating specialties collection...');
      
      // Get program areas from the database
      const programAreas = await ProgramArea.find();
      const programAreaMap = {};
      programAreas.forEach(pa => {
        programAreaMap[pa.name] = pa.name;
      });
      
      // Default program area if none match
      const defaultProgramArea = programAreas.length > 0 ? 
        programAreas[0].name : 'Basic Program';
      
      const specialtiesToCreate = existingSpecialties
        .filter(specialty => specialty && specialty.trim() !== '')
        .map(specialty => ({
          name: specialty,
          // Assign to a program area if we can match it, otherwise use default
          programArea: determineMatchingProgramArea(specialty, programAreaMap) || defaultProgramArea,
          description: `${specialty} specialty for medical training`,
          active: true
        }));
      
      if (specialtiesToCreate.length > 0) {
        await Specialty.insertMany(specialtiesToCreate);
        console.log(`Created ${specialtiesToCreate.length} specialties`);
      } else {
        console.log('No specialties to create');
      }
    } else {
      console.log(`Specialties collection already exists with ${specialtiesCount} entries`);
    }
    
    console.log('Initialization complete!');
  } catch (error) {
    console.error('Error initializing program areas and specialties:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Helper function to determine which program area a specialty belongs to
function determineMatchingProgramArea(specialty, programAreaMap) {
  // This is a simple implementation - you might want to enhance this with more sophisticated matching
  
  // Map of specialties to program areas
  const specialtyToProgramArea = {
    'Internal Medicine': 'Basic Program',
    'Surgery': 'Specialty Program',
    'Pediatrics': 'Basic Program',
    'Ophthalmology': 'Specialty Program',
    'ENT': 'Specialty Program',
    'Cardiology': 'Specialty Program',
    'Neurology': 'Specialty Program',
    'Psychiatry': 'Basic Program',
    'Emergency Medicine': 'Basic Program',
    'Family Medicine': 'Basic Program',
    'Obstetrics & Gynecology': 'Specialty Program',
    'Dermatology': 'Specialty Program',
    'Orthopedics': 'Specialty Program',
    'Radiology': 'Specialty Program',
    'Pathology': 'Specialty Program',
    'Anesthesiology': 'Specialty Program'
  };
  
  // Return the mapped program area if it exists in our database
  const mappedProgramArea = specialtyToProgramArea[specialty];
  if (mappedProgramArea && programAreaMap[mappedProgramArea]) {
    return mappedProgramArea;
  }
  
  // Default to the first program area
  return Object.values(programAreaMap)[0];
}

// Run the initialization
initializeProgramAreasAndSpecialties();