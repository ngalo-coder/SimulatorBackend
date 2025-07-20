import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ProgramArea from '../src/models/ProgramAreaModel.js';
import Specialty from '../src/models/SpecialtyModel.js';
import connectDB from '../src/config/db.js';
import fs from 'fs';

dotenv.config();

const updateProgramsAndSpecialties = async () => {
  await connectDB();

  const jsonFiles = ['program1.json', 'program2.json'];

  for (const file of jsonFiles) {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const programName = data.program;
    const modules = data.modules;

    let program = await ProgramArea.findOne({ name: programName });
    if (!program) {
      program = new ProgramArea({ name: programName });
      await program.save();
    }

    for (const module of modules) {
      let specialty = await Specialty.findOne({ name: module.name });
      if (!specialty) {
        specialty = new Specialty({
          name: module.name,
          label: module.label,
          description: module.description,
          examples: module.examples,
          programArea: program._id,
        });
        await specialty.save();
      }
    }
  }

  console.log('Programs and specialties updated successfully.');
  mongoose.connection.close();
};

updateProgramsAndSpecialties().catch((err) => {
  console.error(err);
  mongoose.connection.close();
});
