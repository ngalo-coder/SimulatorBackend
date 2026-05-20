/**
 * Script to load case JSON files into MongoDB.
 * Usage: node scripts/loadCases.js [--force]
 */

import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
const CASES_DIR = path.join(__dirname, "..", "cases");
const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/medical-simulator";

// Schemas
const HistoryItemSchema = new mongoose.Schema({
  onset: String, location: String, radiation: String, character: String, severity: Number,
  timing_and_duration: String, exacerbating_factors: String, relieving_factors: String,
  associated_symptoms: [String],
}, { _id: false });

const ReviewOfSystemsSchema = new mongoose.Schema({
  comment: String, positive: [String], negative: [String],
}, { _id: false });

const SocialHistorySchema = new mongoose.Schema({
  smoking_status: String, alcohol_use: String, substance_use: String,
  diet_and_exercise: String, living_situation: String,
}, { _id: false });

const CaseMetadataSchema = new mongoose.Schema({
  case_id: { type: String, required: true, unique: true, trim: true },
  title: { type: String, required: true, trim: true },
  specialty: { type: String, required: true, trim: true },
  program_area: { type: String, required: true, trim: true, enum: ["Basic Program", "Specialty Program"] },
  module: { type: String, trim: true },
  difficulty: { type: String, required: true, trim: true, enum: ["Easy", "Intermediate", "Hard"] },
  tags: [{ type: String, trim: true }],
  location: { type: String, required: true, trim: true },
}, { _id: false });

const ClinicalDossierSchema = new mongoose.Schema({
  hidden_diagnosis: { type: String, required: true, trim: true },
  history_of_presenting_illness: HistoryItemSchema,
  review_of_systems: ReviewOfSystemsSchema,
  past_medical_history: [String], medications: [String], allergies: [String],
  surgical_history: [String], family_history: [String],
  social_history: SocialHistorySchema,
}, { _id: false });

const SimulationTriggerSchema = new mongoose.Schema({
  condition_keyword: String, patient_response: String,
}, { _id: false });

const PatientPersonaSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  age: { type: Number, required: true },
  gender: { type: String, required: true, trim: true },
  occupation: { type: String, trim: true },
  chief_complaint: { type: String, required: true, trim: true },
  emotional_tone: { type: String, required: true, trim: true },
  background_story: { type: String, trim: true },
  speaks_for: { type: String, trim: true },
}, { _id: false });

const CaseSchema = new mongoose.Schema({
  version: { type: Number, required: true, default: 1 },
  description: { type: String, required: true, trim: true },
  system_instruction: { type: String, required: true, trim: true },
  case_metadata: { type: CaseMetadataSchema, required: true },
  patient_persona: { type: PatientPersonaSchema, required: true },
  initial_prompt: { type: String, required: true, trim: true },
  clinical_dossier: { type: ClinicalDossierSchema, required: true },
  simulation_triggers: {
    end_session: SimulationTriggerSchema,
    invalid_input: SimulationTriggerSchema,
  },
  evaluation_criteria: { type: mongoose.Schema({}, { strict: false, _id: false }), required: true },
  status: { type: String, default: "published" },
}, { timestamps: true });

const Case = mongoose.model("Case", CaseSchema);

// Helpers
function toStr(v) {
  if (Array.isArray(v)) return v.join("; ");
  if (v === null || v === undefined) return undefined;
  return String(v);
}

function transformCase(raw) {
  const m = raw.case_metadata || {};
  const p = raw.patient_persona || {};
  const d = raw.clinical_dossier || {};

  // Program area
  let pa = m.program_area;
  if (!pa) {
    const sl = (m.specialty || "").toLowerCase();
    if (["nursing","laboratory","pharmacy"].some(k => sl.includes(k))) pa = "Basic Program";
    else pa = "Specialty Program";
  }

  // Difficulty
  const dm = { easy:"Easy", intermediate:"Intermediate", hard:"Hard", beginner:"Easy", advanced:"Hard" };
  const diff = dm[(m.difficulty || "Intermediate").toLowerCase()] || "Intermediate";

  // Clean HPI (convert arrays to strings)
  const hpi = d.history_of_presenting_illness;
  const cleanHpi = hpi ? {
    onset: toStr(hpi.onset),
    location: toStr(hpi.location),
    radiation: toStr(hpi.radiation),
    character: toStr(hpi.character),
    severity: typeof hpi.severity === "number" ? hpi.severity : parseInt(hpi.severity) || undefined,
    timing_and_duration: toStr(hpi.timing_and_duration),
    exacerbating_factors: toStr(hpi.exacerbating_factors),
    relieving_factors: toStr(hpi.relieving_factors),
    associated_symptoms: hpi.associated_symptoms || [],
  } : undefined;

  // Clean social history
  const sh = d.social_history;
  const cleanSh = sh ? {
    smoking_status: toStr(sh.smoking_status),
    alcohol_use: toStr(sh.alcohol_use),
    substance_use: toStr(sh.substance_use),
    diet_and_exercise: toStr(sh.diet_and_exercise),
    living_situation: toStr(sh.living_situation),
  } : undefined;

  return {
    version: raw.version || 3.1,
    description: raw.description || (m.title || "Medical") + " case simulation",
    system_instruction: raw.system_instruction || "Role-play as a patient with the chief complaint.",
    case_metadata: {
      case_id: m.case_id || "CASE-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      title: m.title || "Untitled Case",
      specialty: m.specialty || "General Medicine",
      program_area: pa,
      module: m.module || undefined,
      difficulty: diff,
      location: m.location || "Emergency Department",
      tags: m.tags || [],
    },
    patient_persona: {
      name: p.name || "Unknown Patient",
      age: p.age || 30,
      gender: p.gender || "Unknown",
      occupation: p.occupation || undefined,
      chief_complaint: p.chief_complaint || "Chief complaint not specified",
      emotional_tone: p.emotional_tone || "Neutral",
      background_story: p.background_story || undefined,
      speaks_for: p.speaks_for || undefined,
    },
    initial_prompt: raw.initial_prompt || "You are speaking with a patient.",
    clinical_dossier: {
      hidden_diagnosis: d.hidden_diagnosis || "Unknown Diagnosis",
      history_of_presenting_illness: cleanHpi,
      review_of_systems: d.review_of_systems || undefined,
      past_medical_history: d.past_medical_history || [],
      medications: d.medications || [],
      allergies: d.allergies || [],
      surgical_history: d.surgical_history || undefined,
      family_history: d.family_history || undefined,
      social_history: cleanSh,
    },
    simulation_triggers: {
      end_session: raw.simulation_triggers?.end_session || { condition_keyword: "diagnosis", patient_response: "Thank you." },
      invalid_input: raw.simulation_triggers?.invalid_input || { response: "I don't understand." },
    },
    evaluation_criteria: raw.evaluation_criteria || { Assessment: "Evaluate skills" },
    status: "published",
  };
}

// Main
async function main() {
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  if (await Case.countDocuments({}) > 0) {
    if (process.argv.includes("--force") || process.argv.includes("-f")) {
      console.log("Clearing existing cases...");
      await Case.deleteMany({});
    } else {
      console.log("Cases exist. Use --force to reload.");
      await mongoose.disconnect();
      return;
    }
  }

  const files = fs.readdirSync(CASES_DIR).filter(f => f.endsWith(".json")).sort();
  let ok = 0, err = 0;

  for (const file of files) {
    console.log("\nProcessing:", file);
    const cases = JSON.parse(fs.readFileSync(path.join(CASES_DIR, file), "utf-8"));
    const arr = Array.isArray(cases) ? cases : [cases];

    for (const c of arr) {
      try {
        const t = transformCase(c);
        const exists = await Case.findOne({ "case_metadata.case_id": t.case_metadata.case_id });
        if (exists) { console.log("  Skip:", t.case_metadata.case_id); continue; }
        await Case.create(t);
        ok++;
        console.log("  OK:", t.case_metadata.case_id, "-", t.case_metadata.title, "(" + t.case_metadata.program_area + ")");
      } catch (e) {
        err++;
        console.error("  ERROR:", e.message);
      }
    }
  }

  console.log("\nDone! Imported:", ok, "Errors:", err);
  const counts = await Case.aggregate([{ $group: { _id: "$case_metadata.program_area", count: { $sum: 1 } } }]);
  counts.forEach(c => console.log(" ", c._id + ":", c.count));
  console.log("Total:", await Case.countDocuments({}));
  await mongoose.disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
