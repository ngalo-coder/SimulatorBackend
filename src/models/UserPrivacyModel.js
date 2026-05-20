import mongoose from 'mongoose';

const UserPrivacySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    dataCollection: {
      enabled: {
        type: Boolean,
        default: true
      },
      categories: [{
        category: String,
        enabled: Boolean
      }]
    },
    dataSharing: {
      withEducators: {
        type: Boolean,
        default: true
      },
      withPeers: {
        type: Boolean,
        default: false
      },
      withAnalytics: {
        type: Boolean,
        default: true
      }
    },
    dataRetention: {
      automaticDeletion: {
        type: Boolean,
        default: false
      },
      retentionPeriodDays: {
        type: Number,
        sparse: true
      }
    },
    gdprCompliance: {
      consentGiven: {
        type: Boolean,
        default: false
      },
      consentDate: {
        type: Date,
        sparse: true
      },
      dataExportRequested: {
        type: Boolean,
        default: false
      },
      dataExportRequestDate: {
        type: Date,
        sparse: true
      },
      deletionRequested: {
        type: Boolean,
        default: false
      },
      deletionRequestDate: {
        type: Date,
        sparse: true
      }
    },
    auditLog: [{
      action: String,
      timestamp: Date,
      changedBy: String
    }]
  },
  {
    collection: 'user_privacy',
    timestamps: true
  }
);

const UserPrivacy = mongoose.model('UserPrivacy', UserPrivacySchema);

export default UserPrivacy;
