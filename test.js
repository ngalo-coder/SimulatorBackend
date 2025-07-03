import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// import { v4 as uuidv4 } from 'uuid';
// import { getPatientResponseStream } from '../services/aiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sessions = new Map();
const cases = {};

// Load all cases from the /cases directory into memory on startup
const casesDir = path.join(__dirname, 'cases');
fs.readdirSync(casesDir).forEach(file => {
    if (file.endsWith('.json')) {
        const caseId = path.basename(file, '.json');
        const caseData = JSON.parse(fs.readFileSync(path.join(casesDir, file), 'utf-8'));
        cases[caseId] = caseData;
    }
});

console.log(cases)

