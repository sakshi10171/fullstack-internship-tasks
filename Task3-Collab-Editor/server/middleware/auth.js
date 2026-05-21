// Import JWT library for token generation and verification
const jwt = require('jsonwebtoken');

// Import User model
const User = require('../models/User');

// Middleware to protect private routes
const protect = async (req, res, next) => {

  let token;

  // Check if authorization header exists
  // and starts with "Bearer"
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {

    // Extract token from header
    token = req.headers.authorization.split(' ')[1];
  }

  // Return error if token is missing
  if (!token) {

    return res.status(401).json({
      message: 'Not authorized, no token'
    });
  }

  try {

    // Verify JWT token using secret key
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Find user from decoded token ID
    // Exclude password field
    req.user = await User.findById(decoded.id)
      .select('-password');

    // Return error if user does not exist
    if (!req.user) {

      return res.status(401).json({
        message: 'User not found'
      });
    }

    // Move to next middleware or route
    next();

  } catch (error) {

    // Return error if token verification fails
    return res.status(401).json({
      message: 'Not authorized, token failed'
    });
  }
};

// Function to generate JWT token
const generateToken = (id) => {

  return jwt.sign(

    // Store user ID inside token
    { id },

    // Secret key from environment variables
    process.env.JWT_SECRET,

    // Token expiration time
    { expiresIn: '7d' }
  );
};

// Export middleware and token generator
module.exports = {
  protect,
  generateToken
};
