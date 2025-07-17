import { MongoClient } from 'mongodb';
import fs from 'fs'; // Node.js file system module to read the JSON file
import dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file
// const fs = require('fs');

// Step 1: Load the JSON file containing all cases
function loadCasesFromJson(filePath) {
    try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const cases = JSON.parse(rawData);
        console.log(`Successfully loaded ${cases.length} cases from ${filePath}.`);
        return cases;
    } catch (error) {
        console.error(`Error loading JSON file: ${error.message}`);
        return null;
    }
}

// Step 2: Connect to MongoDB and insert cases
async function pushCasesToMongoDB(cases, mongoUri, dbName, collectionName) {
    const client = new MongoClient(mongoUri);

    try {
        // Connect to MongoDB
        await client.connect();
        console.log("Connected to MongoDB successfully.");

        // Select the database and collection
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        // Insert cases into the collection
        const result = await collection.insertMany(cases);
        console.log(`Successfully inserted ${result.insertedCount} cases into MongoDB.`);
    } catch (error) {
        console.error(`Error inserting cases into MongoDB: ${error.message}`);
    } finally {
        // Close the connection
        await client.close();
    }
}

// Main function to execute the script
(async () => {
    // Configuration
    const MONGO_URI="mongodb+srv://odongolera:IzGzTDrsr3U4aBaA@cluster0.kha1r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"  // Replace with your MongoDB URI
    const DB_NAME="test"            // Replace with your database name
    const COLLECTION_NAME = "cases"                // Replace with your collection name                        
    const JSON_FILE_PATH = "cases/case_5.json"       // Replace with the path to your consolidated JSON file

    // Load cases from JSON
    const cases = loadCasesFromJson(JSON_FILE_PATH);

    if (cases) {
        // Push cases to MongoDB
        await pushCasesToMongoDB(cases, MONGO_URI, DB_NAME, COLLECTION_NAME);
    }
})();









