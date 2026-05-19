const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    default: 'Untitled Document',
    trim: true,
  },
  content: {
    type: String,
    default: '',
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  collaborators: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      permission: { type: String, enum: ['view', 'edit'], default: 'edit' },
      addedAt: { type: Date, default: Date.now },
    },
  ],
  isPublic: {
    type: Boolean,
    default: false,
  },
  shareToken: {
    type: String,
    default: null,
  },
  lastEditedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  version: {
    type: Number,
    default: 1,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

documentSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Check if user has access to the document
documentSchema.methods.hasAccess = function (userId) {
  if (this.owner.toString() === userId.toString()) return true;
  if (this.isPublic) return true;
  return this.collaborators.some(
    (c) => c.user.toString() === userId.toString()
  );
};

documentSchema.methods.canEdit = function (userId) {
  if (this.owner.toString() === userId.toString()) return true;
  const collab = this.collaborators.find(
    (c) => c.user.toString() === userId.toString()
  );
  return collab && collab.permission === 'edit';
};

module.exports = mongoose.model('Document', documentSchema);
