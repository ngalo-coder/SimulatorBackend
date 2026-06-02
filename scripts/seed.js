// scripts/seed.js
require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Case = require('../models/Case');
const sampleCases = require('./sampleCases');

async function seed() {
    try {
        let uri = process.env.MONGODB_URI;
        // Fall back to in-memory if no valid external URI
        const isInvalid = !uri || uri.includes('cluster0') || uri.includes('your_') || uri.includes('localhost');
        if (isInvalid) {
            const mongoServer = await MongoMemoryServer.create();
            uri = mongoServer.getUri();
            console.log('Using in-memory MongoDB for seeding');
        }
        await mongoose.connect(uri);
        await Case.deleteMany();
        await Case.insertMany(sampleCases);
        console.log('✅ Database seeded with', sampleCases.length, 'cases');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
seed();
