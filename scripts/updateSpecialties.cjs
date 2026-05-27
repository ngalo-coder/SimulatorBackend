const mongoose = require('mongoose');
const uri = 'mongodb+srv://odongolera:6JCeO6593BF3CtBd@cluster0.kha1r.mongodb.net/test';
mongoose.connect(uri).then(async () => {
  const db = mongoose.connection.db;
  
  // Update all specialties with programArea 'all' 
  await db.collection('specialties').updateMany(
    { programArea: 'all' },
    { $set: { programArea: 'Basic Program', programAreas: ['Basic Program', 'Specialty Program'] } }
  );
  
  // Update specialties with programArea 'specialty'
  await db.collection('specialties').updateMany(
    { programArea: 'specialty' },
    { $set: { programArea: 'Specialty Program', programAreas: ['Specialty Program'] } }
  );

  // Update specialties with programArea 'Basic Program' (from our insert)
  await db.collection('specialties').updateMany(
    { name: { $in: ['Laboratory', 'Nursing', 'Pharmacy', 'Radiology'] } },
    { $set: { programAreas: ['Basic Program'], lastModified: new Date() } }
  );
  
  // Verify
  const all = await db.collection('specialties').find({}).toArray();
  console.log('Updated specialties:');
  all.forEach(s => console.log(s.name, '| programArea:', s.programArea, '| programAreas:', JSON.stringify(s.programAreas)));
  
  await mongoose.disconnect();
  process.exit(0);
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
