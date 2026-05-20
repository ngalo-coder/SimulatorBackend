import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Healthcare discipline enum
const HealthcareDiscipline = {
  MEDICINE: 'medicine',
  NURSING: 'nursing',
  LABORATORY: 'laboratory',
  RADIOLOGY: 'radiology',
  PHARMACY: 'pharmacy'
};

// User role enum
const UserRole = {
  STUDENT: 'student',
  EDUCATOR: 'educator',
  ADMIN: 'admin'
};

// Competency progress schema
const CompetencyProgressSchema = new mongoose.Schema({
  competencyId: {
    type: String,
    required: true
  },
  competencyName: {
    type: String,
    required: true
  },
  currentLevel: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  targetLevel: {
    type: Number,
    min: 0,
    max: 5,
    default: 3
  },
  lastAssessed: {
    type: Date,
    default: Date.now
  },
  evidenceCount: {
    type: Number,
    default: 0
  }
}, { _id: false });

// User preferences schema
const UserPreferencesSchema = new mongoose.Schema({
  language: {
    type: String,
    default: 'en'
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  notifications: {
    email: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: true
    },
    caseReminders: {
      type: Boolean,
      default: true
    },
    progressUpdates: {
      type: Boolean,
      default: true
    }
  },
  learningStyle: {
    type: String,
    enum: ['visual', 'auditory', 'kinesthetic', 'reading'],
    default: 'visual'
  },
  difficultyPreference: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'adaptive'],
    default: 'adaptive'
  }
}, { _id: false });

// User profile schema
const UserProfileSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required.'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required.'],
    trim: true
  },
  specialization: {
    type: String,
    trim: true
  },
  yearOfStudy: {
    type: Number,
    min: 1,
    max: 10
  },
  institution: {
    type: String,
    required: [true, 'Institution is required.'],
    trim: true
  },
  licenseNumber: {
    type: String,
    trim: true
  },
  competencyLevel: {
    type: String,
    enum: ['novice', 'advanced_beginner', 'competent', 'proficient', 'expert'],
    default: 'novice'
  },
  preferences: {
    type: UserPreferencesSchema,
    default: () => ({})
  }
}, { _id: false });

// Permission schema
const PermissionSchema = new mongoose.Schema({
  resource: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  conditions: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { _id: false });

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required.'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-zA-Z0-9]+$/, 'Username can only contain letters and numbers.']
  },
  email: {
    type: String,
    required: [true, 'Email is required.'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/\S+@\S+\.\S+/, 'Please use a valid email address.']
  },
  password: {
    type: String,
    required: [true, 'Password is required.'],
    minlength: [6, 'Password must be at least 6 characters long.']
  },
  primaryRole: {
    type: String,
    enum: Object.values(UserRole),
    required: [true, 'Primary role is required.'],
    default: UserRole.STUDENT
  },
  secondaryRoles: [{
    type: String,
    enum: Object.values(UserRole)
  }],
  discipline: {
    type: String,
    enum: Object.values(HealthcareDiscipline),
    required: [true, 'Healthcare discipline is required.']
  },
  profile: {
    type: UserProfileSchema,
    required: [true, 'User profile is required.']
  },
  competencies: [{
    type: CompetencyProgressSchema
  }],
  permissions: [{
    type: PermissionSchema
  }],
  lastLogin: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  passwordResetToken: String,
  passwordResetExpires: Date
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps
});

// Pre-save hook to hash password before saving
UserSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare entered password with hashed password in DB
UserSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to get all user roles (primary + secondary)
UserSchema.methods.getAllRoles = function() {
  const roles = [this.primaryRole];
  if (this.secondaryRoles && this.secondaryRoles.length > 0) {
    roles.push(...this.secondaryRoles);
  }
  return [...new Set(roles)]; // Remove duplicates
};

// Method to check if user has a specific role
UserSchema.methods.hasRole = function(role) {
  return this.getAllRoles().includes(role);
};

// Method to get user's full name
UserSchema.methods.getFullName = function() {
  if (this.profile && this.profile.firstName && this.profile.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.username;
};

// Method to add competency progress
UserSchema.methods.addCompetency = function(competencyData) {
  const existingIndex = this.competencies.findIndex(
    comp => comp.competencyId === competencyData.competencyId
  );
  
  if (existingIndex >= 0) {
    // Update existing competency
    this.competencies[existingIndex] = {
      ...this.competencies[existingIndex].toObject(),
      ...competencyData,
      lastAssessed: new Date()
    };
  } else {
    // Add new competency
    this.competencies.push({
      ...competencyData,
      lastAssessed: new Date()
    });
  }
};

// Method to update competency level
UserSchema.methods.updateCompetencyLevel = function(competencyId, newLevel, evidence = false) {
  const competency = this.competencies.find(comp => comp.competencyId === competencyId);
  if (competency) {
    competency.currentLevel = newLevel;
    competency.lastAssessed = new Date();
    if (evidence) {
      competency.evidenceCount += 1;
    }
  }
};

// Method to get competency progress for a specific competency
UserSchema.methods.getCompetencyProgress = function(competencyId) {
  return this.competencies.find(comp => comp.competencyId === competencyId);
};

// Method to add custom permission
UserSchema.methods.addPermission = function(resource, action, conditions = {}) {
  const existingIndex = this.permissions.findIndex(
    perm => perm.resource === resource && perm.action === action
  );
  
  if (existingIndex >= 0) {
    // Update existing permission
    this.permissions[existingIndex].conditions = conditions;
  } else {
    // Add new permission
    this.permissions.push({ resource, action, conditions });
  }
};

// Method to remove permission
UserSchema.methods.removePermission = function(resource, action) {
  this.permissions = this.permissions.filter(
    perm => !(perm.resource === resource && perm.action === action)
  );
};

// Method to update last login
UserSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save({ validateBeforeSave: false });
};

// Static method to find users by discipline
UserSchema.statics.findByDiscipline = function(discipline) {
  return this.find({ discipline: discipline, isActive: true });
};

// Static method to find users by role
UserSchema.statics.findByRole = function(role) {
  return this.find({
    $or: [
      { primaryRole: role },
      { secondaryRoles: role }
    ],
    isActive: true
  });
};

// Static method to find users by discipline and role
UserSchema.statics.findByDisciplineAndRole = function(discipline, role) {
  return this.find({
    discipline: discipline,
    $or: [
      { primaryRole: role },
      { secondaryRoles: role }
    ],
    isActive: true
  });
};

// Virtual for user's display name
UserSchema.virtual('displayName').get(function() {
  return this.getFullName();
});

// Ensure virtual fields are serialized
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

const User = mongoose.model('User', UserSchema);

// Export the model and enums
export default User;
export { HealthcareDiscipline, UserRole };
