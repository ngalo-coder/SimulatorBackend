import mongoose from 'mongoose';

const programAreaSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const ProgramArea = mongoose.model('ProgramArea', programAreaSchema);

export default ProgramArea;