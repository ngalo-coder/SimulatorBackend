import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Case from './src/models/CaseModel.js';
import connectDB from './src/config/db.js';

dotenv.config();
await connectDB();

// Mapping of current specialties to Internal Medicine modules
const specialtyToModule = {
  'Cardiology': {
    program: 'Internal Medicine Basic Program',
    module: 'Cardiovascular System',
    specialty: 'Internal Medicine'
  },
  'Endocrinology': {
    program: 'Internal Medicine Basic Program', 
    module: 'Endocrinology',
    specialty: 'Internal Medicine'
  },
  'Emergency Medicine': {
    program: 'Internal Medicine Basic Program',
    module: 'Emergency Medicine', 
    specialty: 'Internal Medicine'
  },
  'Infectious Diseases': {
    program: 'Internal Medicine Basic Program',
    module: 'Tropical Medicine',
    specialty: 'Internal Medicine'
  },
  'Neurology': {
    program: 'Internal Medicine Basic Program',
    module: 'Central Nervous System',
    specialty: 'Internal Medicine'
  },
  'Pulmonology': {
    program: 'Internal Medicine Basic Program',
    module: 'Respiratory System', 
    specialty: 'Internal Medicine'
  },
  'Nephrology': {
    program: 'Internal Medicine Basic Program',
    module: 'Genital Urinary System',
    specialty: 'Internal Medicine'
  },
  'Rheumatology': {
    program: 'Internal Medicine Basic Program',
    module: 'Musculoskeletal System',
    specialty: 'Internal Medicine'
  }
};

console.log('🔄 REORGANIZING CASES TO INTERNAL MEDICINE BASIC PROGRAM');
console.log('=' .repeat(60));

let updatedCount = 0;
let totalCount = 0;

for (const [currentSpecialty, newConfig] of Object.entries(specialtyToModule)) {
  console.log(`\n📋 Processing ${currentSpecialty} cases...`);
  
  const cases = await Case.find({ 'case_metadata.specialty': currentSpecialty });
  console.log(`   Found ${cases.length} cases`);
  
  for (const caseDoc of cases) {
    const result = await Case.findOneAndUpdate(
      { _id: caseDoc._id },
      {
        $set: {
          'case_metadata.program_area': newConfig.program,
          'case_metadata.specialty': newConfig.specialty,
          'case_metadata.module': newConfig.module
        }
      },
      { new: true }
    );
    
    if (result) {
      console.log(`   ✅ ${result.case_metadata.case_id}: ${result.case_metadata.title}`);
      console.log(`      → ${newConfig.program} | ${newConfig.module}`);
      updatedCount++;
    }
    totalCount++;
  }
}

// Also update existing Internal Medicine cases to have modules
console.log(`\n📋 Adding modules to existing Internal Medicine cases...`);
const internalMedCases = await Case.find({ 
  'case_metadata.specialty': 'Internal Medicine',
  'case_metadata.module': { $exists: false }
});

console.log(`   Found ${internalMedCases.length} Internal Medicine cases without modules`);

for (const caseDoc of internalMedCases) {
  let module = 'General Internal Medicine'; // Default module
  
  // Try to assign module based on tags or title
  const tags = caseDoc.case_metadata?.tags || [];
  const title = caseDoc.case_metadata?.title || '';
  
  if (tags.some(tag => ['Rse();loion.cnnectoose.coongt m);

awaial Medicine'Intern  - General ole.log('   nsne');
cociy MediEmergenc  - .log('   consoley');
ndocrinolog'     - Elog(nsole.co);
System'skeletal  Musculo'     -sole.log(onSystem');
ctal Urinary   - Genig('   sole.loem');
con Systpiratory Res('     -sole.logm');
conus Systeervo N  - Central   g('console.lom'); 
yster Sdiovascula    - Carlog(' le.consoedicine');
pical M Tro  -  log(' ;
console.c Program')icine Basinternal Med   • Ile.log('onsore:');
cNew structue.log('\n📋 !');
consolletezation compm reorgani\n🎉 Prograle.log('onso
clCount}`);: ${totarocessedcases ptal 📊 Tog(`onsole.lo
cunt}`);dCo${updatepdated:  Cases uog(`✅le.l60));
conso.repeat(og('=' ;
console.l')SUMMARYNIZATION 📊 REORGAsole.log(';
con0))repeat(6\n' + '=' .le.log('
consot++;
}
otalCoun
  }
  tdCount++;
    updatemodule}`); | ${ram Basic Progedicinenternal M      → Iole.log(`   constitle}`);
 a.datlt.case_meta ${resud}:_idata.casecase_meta✅ ${result.g(`    console.lo
   t) {  if (resul  );
  
e }
 { new: tru},
          }
 
  le': moduledata.modutame'case_    am',
    asic Progrcine Bnternal Medim_area': 'Iprogrametadata.     'case_   {
 set: {
      $  oc._id },
 { _id: caseD(
    dateeAndUpCase.findOnt = await onst resul 
  cm';
  }
 Systervous ntral Nemodule = 'Ce)) {
    'headache').includes(LowerCase(to     title.
        )) || ag.includes(tcal']eurologi', 'N', 'Migraineeadachee(tag => ['H (tags.somelse if  } r System';
ulaiovasc = 'Carddule
    mon')) {hest pais('cnclude().ierCaseowle.toL      tit        || 
(tag))cludes.in', 'Heart']hest Painar', 'Cascul> ['Cardiovs.some(tag =f (taglse i';
  } e Systemespiratory module = 'R) {
   ough').includes('ce()rCasoLowe.t     title|| 
 tag)) s(ncludeonia'].ineumough', 'Patory', 'Ciresp