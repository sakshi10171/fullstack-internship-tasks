const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const crypto = require('crypto');

// GET /api/documents
router.get('/', protect, async (req, res) => {
  try {
    const docs = await Document.find({
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id },
      ],
    })
      .populate('owner', 'name email color')
      .populate('collaborators.user', 'name email color')
      .sort({ updatedAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/documents — create and immediately return with owner info
router.post('/', protect, async (req, res) => {
  try {
    const doc = await Document.create({
      title: req.body.title || 'Untitled Document',
      content: req.body.content || '',
      owner: req.user._id,
    });

    // Return full doc with owner populated
    const fullDoc = await Document.findById(doc._id).populate('owner', 'name email color');
    console.log('Document created:', fullDoc._id, 'by user:', req.user._id);
    res.status(201).json(fullDoc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/documents/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate('owner', 'name email color')
      .populate('collaborators.user', 'name email color');

    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const isOwner = doc.owner._id.toString() === req.user._id.toString();
    const isCollaborator = doc.collaborators.some(
      (c) => c.user._id.toString() === req.user._id.toString()
    );

    console.log('GET doc:', doc._id, '| owner:', doc.owner._id, '| requester:', req.user._id, '| isOwner:', isOwner);

    if (!isOwner && !isCollaborator && !doc.isPublic) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/documents/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const isOwner = doc.owner.toString() === req.user._id.toString();
    const isEditor = doc.collaborators.some(
      (c) => c.user.toString() === req.user._id.toString() && c.permission === 'edit'
    );

    if (!isOwner && !isEditor) {
      return res.status(403).json({ message: 'Edit access denied' });
    }

    if (req.body.title !== undefined) doc.title = req.body.title;
    if (req.body.content !== undefined) doc.content = req.body.content;
    doc.lastEditedBy = req.user._id;
    doc.version += 1;
    await doc.save();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    if (doc.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can delete' });
    }
    await doc.deleteOne();
    res.json({ message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/documents/:id/share
router.post('/:id/share', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    if (doc.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only owner can share' });
    }
    doc.shareToken = crypto.randomBytes(16).toString('hex');
    doc.isPublic = req.body.isPublic ?? true;
    await doc.save();
    res.json({ shareToken: doc.shareToken, isPublic: doc.isPublic });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/documents/:id/collaborators
router.post('/:id/collaborators', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    if (doc.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only owner can add collaborators' });
    }
    const targetUser = await User.findOne({ email: req.body.email });
    if (!targetUser) return res.status(404).json({ message: 'User not found' });
    const alreadyAdded = doc.collaborators.some(
      (c) => c.user.toString() === targetUser._id.toString()
    );
    if (alreadyAdded) return res.status(400).json({ message: 'Already a collaborator' });
    doc.collaborators.push({ user: targetUser._id, permission: req.body.permission || 'edit' });
    await doc.save();
    await doc.populate('collaborators.user', 'name email color');
    res.json(doc.collaborators);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DEBUG route — check who owns a document
router.get('/:id/debug', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'not found' });
    res.json({
      docId: doc._id,
      docOwner: doc.owner.toString(),
      requestingUser: req.user._id.toString(),
      match: doc.owner.toString() === req.user._id.toString(),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;