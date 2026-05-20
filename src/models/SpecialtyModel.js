import mongoose from 'mongoose';

const specialtySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    // Program area - basic, specialty, or internal_medicine
    programArea: {
        type: String,
        required: true,
        enum: ['basic', 'specialty', 'internal_medicine'],
        default: 'basic'
    },
    description: {
        type: String,
        default: ''
    },
    active: {
        type: Boolean,
        default: true
    },
    // Specialty visibility management fields
    isVisible: {
        type: Boolean,
        default: true
    },
    lastModified: {
        type: Date,
        default: Date.now
    },
    modifiedBy: {
        type: String,
        default: 'system'
    }
}, {
    timestamps: true
});

const Specialty = mongoose.model('Specialty', specialtySchema);

export default Specialty;