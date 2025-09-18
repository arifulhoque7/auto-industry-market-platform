const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const CryptoJS = require('crypto-js');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId;
    }
  },
  role: {
    type: String,
    enum: ['car_owner', 'repair_shop', 'vendor'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: false,
    set: function(value) {
      if (!value) return value;
      return CryptoJS.AES.encrypt(value, process.env.ENCRYPTION_KEY).toString();
    },
    get: function(value) {
      if (!value) return value;
      const bytes = CryptoJS.AES.decrypt(value, process.env.ENCRYPTION_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    }
  },
  address: {
    type: String,
    set: function(value) {
      if (!value) return value;
      return CryptoJS.AES.encrypt(value, process.env.ENCRYPTION_KEY).toString();
    },
    get: function(value) {
      if (!value) return value;
      const bytes = CryptoJS.AES.decrypt(value, process.env.ENCRYPTION_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    }
  },
  googleId: String,
  refreshToken: String,
  businessName: {
    type: String,
    required: function() {
      return this.role === 'repair_shop' || this.role === 'vendor';
    }
  },
  businessLicense: {
    type: String,
    required: function() {
      return this.role === 'repair_shop' || this.role === 'vendor';
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { getters: true },
  toObject: { getters: true }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Update timestamp
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Create text index for searchable encrypted fields
userSchema.index({ email: 'text', name: 'text', businessName: 'text' });

module.exports = mongoose.model('User', userSchema);