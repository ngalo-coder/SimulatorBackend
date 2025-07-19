// Simple script to run the initialization of program areas and specialties
// This is needed because we're using ES modules and need to handle the top-level await

import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting initialization script...');

// Run the initialization script
const scriptPath = path.join(__dirname, 'initProgramsAndSpecialties.js');
const child = exec(`node ${scriptPath}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing script: ${error}`);
    return;
  }
  
  if (stderr) {
    console.error(`Script stderr: ${stderr}`);
  }
  
  console.log(`Script output: ${stdout}`);
  console.log('Initialization complete!');
});

// Forward script output to console
child.stdout.on('data', (data) => {
  console.log(data.toString().trim());
});

child.stderr.on('data', (data) => {
  console.error(data.toString().trim());
});