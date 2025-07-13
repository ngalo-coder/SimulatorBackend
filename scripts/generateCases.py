import json
from pymongo import MongoClient

# Step 1: Load the JSON file containing all cases
def load_cases_from_json(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            cases = json.load(file)
        print(f"Successfully loaded {len(cases)} cases from {file_path}.")
        return cases
    except Exception as e:
        print(f"Error loading JSON file: {e}")
        return None

# Step 2: Connect to MongoDB and insert cases
def push_cases_to_mongodb(cases, mongo_uri, db_name, collection_name):
    try:
        # Connect to MongoDB
        client = MongoClient(mongo_uri)
        print("Connected to MongoDB successfully.")

        # Select the database and collection
        db = client[db_name]
        collection = db[collection_name]

        # Insert cases into the collection
        result = collection.insert_many(cases)
        print(f"Successfully inserted {len(result.inserted_ids)} cases into MongoDB.")
    except Exception as e:
        print(f"Error inserting cases into MongoDB: {e}")

# Main function to execute the script
if __name__ == "__main__":
    # Configuration
    MONGO_URI = "mongodb+srv://odongolera:IzGzTDrsr3U4aBaA@cluster0.kha1r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"  # Replace with your MongoDB URI
    DB_NAME = "test"           # Replace with your database name
    COLLECTION_NAME = "cases"                # Replace with your collection name
    JSON_FILE_PATH = "..\\cases\\case_100.json"        # Replace with the path to your consolidated JSON file

    # Load cases from JSON
    cases = load_cases_from_json(JSON_FILE_PATH)

    if cases:
        # Push cases to MongoDB
        push_cases_to_mongodb(cases, MONGO_URI, DB_NAME, COLLECTION_NAME)