const sampleCases = [
    {
        title: "Strep Throat - Basic",
        specialty: "Internal Medicine",
        category: "Basic",
        difficulty: "Easy",
        patientProfile: {
            age: 22,
            gender: "Male",
            chiefComplaint: "Sore throat for 2 days, fever",
            historyPresent: "Sudden onset sore throat, pain with swallowing, no cough",
            pastMedicalHistory: "None",
            socialHistory: "College student, lives in dormitory",
            familyHistory: "Noncontributory",
            physicalExam: "Temperature 38.5°C, tonsils swollen with exudate, anterior cervical lymphadenopathy",
            patientPersonality: "Anxious, wants antibiotics quickly",
            correctDiagnosis: "Strep throat (Group A streptococcal pharyngitis)",
            expectedQuestions: ["Any cough?", "Any runny nose?", "Any sick contacts?"]
        },
        patientSystemPrompt: "You are a 22-year-old male Kenyan patient named Kevin Otieno. You have a very sore throat and fever for 2 days. You feel miserable. You want the doctor to give you something to feel better. Answer questions truthfully. Do not suggest the diagnosis."
    },
    {
        title: "Angina Pectoris - Specialised",
        specialty: "Internal Medicine",
        category: "Specialised",
        difficulty: "Intermediate",
        patientProfile: {
            age: 68,
            gender: "Female",
            chiefComplaint: "Chest discomfort when walking uphill",
            historyPresent: "Burning substernal pain, relieved by rest, no nausea, no diaphoresis",
            pastMedicalHistory: "Hypertension, GERD",
            socialHistory: "Smoker 1 pack/day",
            familyHistory: "Father had MI at 60",
            physicalExam: "BP 140/90, HR 80, regular, no murmurs, chest non-tender",
            patientPersonality: "Somewhat anxious, tends to minimize symptoms",
            correctDiagnosis: "Angina pectoris (stable)",
            expectedQuestions: ["Does rest relieve the pain?", "Any relation to meals?", "Do you smoke?"]
        },
        patientSystemPrompt: "You are a 68-year-old female Kenyan patient named Grace Wanjiku. You have chest discomfort that comes when you walk uphill or fast, and goes away when you rest. You have had high blood pressure for years. You smoke a pack a day. You are here because your daughter insisted. Answer questions naturally. Do not say 'angina'."
    },
    {
        title: "Major Depression - Mental Health",
        specialty: "Mental Health",
        category: "Specialised",
        difficulty: "Intermediate",
        patientProfile: {
            age: 35,
            gender: "Female",
            chiefComplaint: "Feeling down and tired for months",
            historyPresent: "Low mood, loss of interest, poor sleep, low energy, poor concentration",
            pastMedicalHistory: "None",
            socialHistory: "Works as a teacher, recently divorced",
            familyHistory: "Mother had depression",
            physicalExam: "Unremarkable, flat affect",
            patientPersonality: "Withdrawn, soft-spoken",
            correctDiagnosis: "Major depressive disorder",
            expectedQuestions: ["How is your sleep?", "Have you lost interest in things you used to enjoy?", "Any thoughts of harming yourself?"]
        },
        patientSystemPrompt: "You are a 35-year-old female Kenyan patient named Akinyi Ochieng. You have low mood, loss of interest, and fatigue for 6 months. You are hesitant to talk but will answer politely. Do not suggest depression. Just describe how you feel."
    }
];

module.exports = sampleCases;
