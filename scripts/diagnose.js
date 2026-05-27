import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-simulator';
console.log('Connecting to:', uri);

const specialtySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    programArea: {
        type: String,
        required: true,
        enum: ['basic', 'specialty', 'Basic Program', 'Specialty Program', 'internal_medicine'],
        default: 'basic'
    },
    description: {
        type: String,
        default: ''
    },
    active: {
        type: Boolean,
        default: true
    },
    isVisible: {
        type: Boolean,
        default: true
    },
    lastModified: {
        type: Date,
        default: Date.now
    },
    modifiedBy: {
        type: String,
        default: 'system'
    }
}, {
    timestamps: true
});

const Specialty = mongoose.model('Specialty', specialtySchema);

const caseMetadataSchema = new mongoose.Schema({
  case_id: { type: String, required: true, unique: true, trim: true },
  title: { type: String, required: true, trim: true },
  specialty: { type: String, required: true, trim: true },
  program_area: { type: String, required: true, trim: true },
  module: { type: String, trim: true },
  difficulty: { type: String, required: true, trim: true },
  tags: [{ type: String, trim: true }],
  location: { type: String, required: true, trim: true },
}, { _id: false });

const CaseSchema = new mongoose.Schema({
  case_metadata: caseMetadataSchema,
}, { timestamps: true });

const Case = mongoose.model('Case', CaseSchema);

async function main() {
  try {
    await mongoose.connect(uri);
    console.log('✓ Connected to MongoDB\n');

    console.log('=== SPECIALTIES IN DATABASE ===');
    const specialties = await Specialty.find({}).lean();
    if (specialties.length === 0) {
      console.log('⚠️  No specialties found in database!');
    } else {
      specialties.forEach(s => {
        console.log(`• ${s.name}`);
        console.log(`  - Active: ${s.active}`);
        console.log(`  - Visible: ${s.isVisible}`);
        console.log(`  - Program Area: ${s.programArea}`);
      });
    }

    console.log('\n=== SPECIALTIES IN CASES ===');
    const caseSpecialties = await Case.distinct('case_metadata.specialty');
    caseSpecialties.sort().forEach(spec => {
      const count = Case.countDocuments({ 'case_metadata.specialty': spec });
      console.log(`• ${spec}`);
    });

    console.log('\n=== MISMATCH CHECK ===');
    const activeSpecialties = new Set(specialties.filter(s => s.active && s.isVisible).map(s => s.name));
    const caseSpecialtiesSet = new Set(caseSpecialties);
    
    const missingInDB = caseSpecialties.filter(cs => !activeSpecialties.has(cs));
    if (missingInDB.length > 0) {
      console.log('❌ Specialties in cases but not active in DB:');
      missingInDB.forEach(s => console.log(`   - ${s}`));
    } else {
      console.log('✓ All case specialties are active in DB');
    }

    const notInCases = specialties.filter(s => s.active && s.isVisible).map(s => s.name).filter(s => !caseSpecialtiesSet.has(s));
    if (notInCases.length > 0) {
      console.log('⚠️  Active specialties with no cases:');
      notInCases.forEach(s => console.log(`   - ${s}`));
    }

    console.log('\n=== CASE COUNTS BY SPECIALTY ===');
    for (const spec of caseSpecialties) {
      const count = await Case.countDocuments({ 'case_metadata.specialty': spec });
      const isActive = activeSpecialties.has(spec) ? '✓' : '✗';
      console.log(`${isActive} ${spec}: ${count} cases`);
    }

    console.log('\n=== TOTAL COUNTS ===');
    const totalSpecialties = specialties.length;
    const activeCount = specialties.filter(s => s.active && s.isVisible).length;
    const totalCases = await Case.countDocuments({});
    console.log(`Total specialties: ${totalSpecialties}`);
    console.log(`Active & visible: ${activeCount}`);
    console.log(`Total cases: ${totalCases}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
