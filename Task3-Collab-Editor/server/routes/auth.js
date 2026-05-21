// Import Express framework
const express = require('express');

// Create router object
const router = express.Router();

// Import User model
const User = require('../models/User');

// Import authentication middleware and token generator
const {
  generateToken,
  protect
} = require('../middleware/auth');


// ==========================================
// Register User Route
// POST /api/auth/register
// ==========================================
router.post('/register', async (req, res) => {

  // Extract user details from request body
  const { name, email, password } = req.body;

  // Validate required fields
  if (!name || !email || !password) {

    return res.status(400).json({
      message: 'Please provide all fields'
    });
  }

  try {

    // Check if user already exists
    const existing = await User.findOne({ email });

    if (existing) {

      return res.status(400).json({
        message: 'User already exists'
      });
    }

    // Predefined profile colors
    const colors = [
      '#534AB7',
      '#0F6E56',
      '#993C1D',
      '#185FA5',
      '#993556',
      '#3B6D11'
    ];

    // Assign random color to user
    const color =
      colors[Math.floor(Math.random() * colors.length)];

    // Create new user in database
    const user = await User.create({
      name,
      email,
      password,
      color
    });

    // Send user data and token
    res.status(201).json({

      _id: user._id,

      name: user.name,

      email: user.email,

      color: user.color,

      // Generate JWT token
      token: generateToken(user._id),

    });

  } catch (err) {

    // Handle server errors
    res.status(500).json({
      message: err.message
    });
  }
});


// ==========================================
// Login User Route
// POST /api/auth/login
// ==========================================
router.post('/login', async (req, res) => {

  // Extract login credentials
  const { email, password } = req.body;

  // Validate required fields
  if (!email || !password) {

    return res.status(400).json({
      message: 'Please provide email and password'
    });
  }

  try {

    // Find user by email
    // Include password field explicitly
    const user = await User.findOne({ email })
      .select('+password');

    // Validate user and password
    if (
      !user ||
      !(await user.matchPassword(password))
    ) {

      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    // Send logged-in user data
    res.json({

      _id: user._id,

      name: user.name,

      email: user.email,

      color: user.color,

      // Generate JWT token
      token: generateToken(user._id),

    });

  } catch (err) {

    // Handle server errors
    res.status(500).json({
      message: err.message
    });
  }
});


// ==========================================
// Get Current Logged-In User
// GET /api/auth/me
// ==========================================
router.get('/me', protect, async (req, res) => {

  // Send authenticated user data
  res.json(req.user);
});


// Export router
module.exports = router;
