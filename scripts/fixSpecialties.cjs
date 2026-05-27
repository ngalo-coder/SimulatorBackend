const mongoose = require('mongoose');
const uri = 'mongodb+srv://odongolera:6JCeO6593BF3CtBd@cluster0.kha1r.mongodb.net/test';
mongoose.connect(uri).then(async () => {
  const db = mongoose.connection.db;
  
  const missing = [
    { name: 'Laboratory', isVisible: true, active: true, programArea: 'Basic Program', lastModified: new Date() },
    { name: 'Nursing', isVisible: true, active: true, programArea: 'Basic Program', lastModified: new Date() },
    { name: 'Pharmacy', isVisible: true, active: true, programArea: 'Basic Program', lastModified: new Date() },
    { name: 'Radiology', isVisible: true, active: true, programArea: 'Basic Program', lastModified: new Date() }
  ];
  
  for (const spec of missing) {
    const existing = await db.collection('specialties').findOne({ name: spec.name });
    if (existing) {
      console.log(spec.name, 'already exists, updating...');
      await db.collection('specialties').updateOne(
        { name: spec.name },
        { $set: { isVisible: true, active: true, programArea: spec.programArea, lastModified: new Date() } }
      );
    } else {
      console.log('Inserting', spec.name);
      await db.collection('specialties').insertOne(spec);
    }
  }
  
  const allSpecs = await db.collection('specialties').find({}).toArray();
  console.log('\nAll specialties now:');
  allSpecs.forEach(s => console.log(s.name, '| visible:', s.isVisible, '| active:', s.active, '| programArea:', s.programArea));
  
  await mongoose.disconnect();
  process.exit(0);
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
