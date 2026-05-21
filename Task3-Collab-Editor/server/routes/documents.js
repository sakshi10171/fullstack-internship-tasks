// Import Express framework
const express = require('express');

// Create router object
const router = express.Router();

// Import Document model
const Document = require('../models/Document');

// Import User model
const User = require('../models/User');

// Import authentication middleware
const { protect } = require('../middleware/auth');

// Import crypto module for generating share tokens
const crypto = require('crypto');


// ==========================================
// Get All Accessible Documents
// GET /api/documents
// ==========================================
router.get('/', protect, async (req, res) => {

  try {

    // Fetch documents where user is owner
    // or collaborator
    const docs = await Document.find({

      $or: [

        { owner: req.user._id },

        { 'collaborators.user': req.user._id },

      ],

    })

      // Populate owner details
      .populate('owner', 'name email color')

      // Populate collaborator details
      .populate(
        'collaborators.user',
        'name email color'
      )

      // Sort latest updated documents first
      .sort({ updatedAt: -1 });

    // Send documents
    res.json(docs);

  } catch (err) {

    // Handle server errors
    res.status(500).json({
      message: err.message
    });
  }
});


// ==========================================
// Create New Document
// POST /api/documents
// ==========================================
router.post('/', protect, async (req, res) => {

  try {

    // Create new document
    const doc = await Document.create({

      title:
        req.body.title || 'Untitled Document',

      content:
        req.body.content || '',

      owner: req.user._id,

    });

    // Fetch created document with owner info
    const fullDoc =
      await Document.findById(doc._id)

        .populate(
          'owner',
          'name email color'
        );

    console.log(
      'Document created:',
      fullDoc._id,
      'by user:',
      req.user._id
    );

    // Send created document
    res.status(201).json(fullDoc);

  } catch (err) {

    res.status(500).json({
      message: err.message
    });
  }
});


// ==========================================
// Get Single Document
// GET /api/documents/:id
// ==========================================
router.get('/:id', protect, async (req, res) => {

  try {

    // Fetch document by ID
    const doc =
      await Document.findById(req.params.id)

        .populate(
          'owner',
          'name email color'
        )

        .populate(
          'collaborators.user',
          'name email color'
        );

    // Return error if document not found
    if (!doc)

      return res.status(404).json({
        message: 'Document not found'
      });

    // Check ownership
    const isOwner =
      doc.owner._id.toString() ===
      req.user._id.toString();

    // Check collaborator access
    const isCollaborator =
      doc.collaborators.some(

        (c) =>
          c.user._id.toString() ===
          req.user._id.toString()

      );

    console.log(
      'GET doc:',
      doc._id,
      '| owner:',
      doc.owner._id,
      '| requester:',
      req.user._id,
      '| isOwner:',
      isOwner
    );

    // Restrict access if user has no permission
    if (
      !isOwner &&
      !isCollaborator &&
      !doc.isPublic
    ) {

      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Send document data
    res.json(doc);

  } catch (err) {

    res.status(500).json({
      message: err.message
    });
  }
});


// ==========================================
// Update Document
// PUT /api/documents/:id
// ==========================================
router.put('/:id', protect, async (req, res) => {

  try {

    // Find document
    const doc =
      await Document.findById(req.params.id);

    if (!doc)

      return res.status(404).json({
        message: 'Document not found'
      });

    // Check ownership
    const isOwner =
      doc.owner.toString() ===
      req.user._id.toString();

    // Check edit permission
    const isEditor =
      doc.collaborators.some(

        (c) =>
          c.user.toString() ===
          req.user._id.toString() &&
          c.permission === 'edit'

      );

    // Restrict unauthorized editing
    if (!isOwner && !isEditor) {

      return res.status(403).json({
        message: 'Edit access denied'
      });
    }

    // Update title if provided
    if (req.body.title !== undefined)
      doc.title = req.body.title;

    // Update content if provided
    if (req.body.content !== undefined)
      doc.content = req.body.content;

    // Track last editor
    doc.lastEditedBy = req.user._id;

    // Increment version number
    doc.version += 1;

    // Save updated document
    await doc.save();

    // Send updated document
    res.json(doc);

  } catch (err) {

    res.status(500).json({
      message: err.message
    });
  }
});


// ==========================================
// Delete Document
// DELETE /api/documents/:id
// ==========================================
router.delete('/:id', protect, async (req, res) => {

  try {

    // Find document
    const doc =
      await Document.findById(req.params.id);

    if (!doc)

      return res.status(404).json({
        message: 'Document not found'
      });

    // Only owner can delete
    if (
      doc.owner.toString() !==
      req.user._id.toString()
    ) {

      return res.status(403).json({
        message:
          'Only the owner can delete'
      });
    }

    // Delete document
    await doc.deleteOne();

    res.json({
      message: 'Document deleted'
    });

  } catch (err) {

    res.status(500).json({
      message: err.message
    });
  }
});


// ==========================================
// Share Document
// POST /api/documents/:id/share
// ==========================================
router.post('/:id/share', protect, async (req, res) => {

  try {

    // Find document
    const doc =
      await Document.findById(req.params.id);

    if (!doc)

      return res.status(404).json({
        message: 'Document not found'
      });

    // Only owner can share
    if (
      doc.owner.toString() !==
      req.user._id.toString()
    ) {

      return res.status(403).json({
        message:
          'Only owner can share'
      });
    }

    // Generate unique share token
    doc.shareToken =
      crypto.randomBytes(16).toString('hex');

    // Set document visibility
    doc.isPublic =
      req.body.isPublic ?? true;

    // Save changes
    await doc.save();

    // Send share details
    res.json({

      shareToken: doc.shareToken,

      isPublic: doc.isPublic

    });

  } catch (err) {

    res.status(500).json({
      message: err.message
    });
  }
});


// ==========================================
// Add Collaborator
// POST /api/documents/:id/collaborators
// ==========================================
router.post('/:id/collaborators', protect, async (req, res) => {

  try {

    // Find document
    const doc =
      await Document.findById(req.params.id);

    if (!doc)

      return res.status(404).json({
        message: 'Document not found'
      });

    // Only owner can add collaborators
    if (
      doc.owner.toString() !==
      req.user._id.toString()
    ) {

      return res.status(403).json({
        message:
          'Only owner can add collaborators'
      });
    }

    // Find target user by email
    const targetUser =
      await User.findOne({
        email: req.body.email
      });

    if (!targetUser)

      return res.status(404).json({
        message: 'User not found'
      });

    // Check if user already added
    const alreadyAdded =
      doc.collaborators.some(

        (c) =>
          c.user.toString() ===
          targetUser._id.toString()

      );

    if (alreadyAdded)

      return res.status(400).json({
        message:
          'Already a collaborator'
      });

    // Add collaborator with permission
    doc.collaborators.push({

      user: targetUser._id,

      permission:
        req.body.permission || 'edit'

    });

    // Save document
    await doc.save();

    // Populate collaborator details
    await doc.populate(
      'collaborators.user',
      'name email color'
    );

    // Send collaborators list
    res.json(doc.collaborators);

  } catch (err) {

    res.status(500).json({
      message: err.message
    });
  }
});


// ==========================================
// Debug Route
// GET /api/documents/:id/debug
// ==========================================
router.get('/:id/debug', protect, async (req, res) => {

  try {

    // Find document
    const doc =
      await Document.findById(req.params.id);

    if (!doc)

      return res.status(404).json({
        message: 'not found'
      });

    // Send ownership debugging details
    res.json({

      docId: doc._id,

      docOwner: doc.owner.toString(),

      requestingUser:
        req.user._id.toString(),

      match:
        doc.owner.toString() ===
        req.user._id.toString(),

    });

  } catch (err) {

    res.status(500).json({
      message: err.message
    });
  }
});


// Export router
module.exports = router;
