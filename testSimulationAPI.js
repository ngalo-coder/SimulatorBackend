import mongoose from 'mongoose';
import * as simulationService from './src/services/simulationService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testSimulationAPI() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Test with the first case
        const caseId = 'VP-IM-622'; // From our previous check
        
        console.log(`\n🧪 Testing simulation start with case: ${caseId}`);
        
        const result = await simulationService.startSimulation(caseId);
        
        console.log('\n📋 API Response:');
        console.log('Full Response:', JSON.stringify(result, null, 2));
        console.log('\n🔍 Key Fields:');
        console.log('sessionId:', result.sessionId);
        console.log('patientName:', result.patientName);
        console.log('speaks_for:', result.speaks_for);
        console.log('initialPrompt length:', result.initialPrompt?.length || 0);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

testSimulationAPI();