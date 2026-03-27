const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');
const connectDB = require('../config/db');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const ensureSingleAdmin = async () => {
  const existingAdmins = await User.find({ role: 'admin' }).select('_id email');

  if (existingAdmins.length > 0) {
    if (existingAdmins.length > 1) {
      console.warn(`Multiple admin users found (${existingAdmins.length}). Keeping existing admins unchanged.`);
    } else {
      console.log(`Admin user already exists (${existingAdmins[0].email}).`);
    }
    return null;
  }

  const name = process.env.ADMIN_NAME || 'NestEase Admin';
  const email = process.env.ADMIN_EMAIL || 'admin@nestease.local';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123456';

  const admin = await User.create({
    name,
    email,
    password,
    role: 'admin',
    isVerified: true,
  });

  console.log(`Admin user created: ${admin.email}`);
  return admin;
};

if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await ensureSingleAdmin();
      process.exit(0);
    } catch (error) {
      console.error('Failed to seed admin:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = { ensureSingleAdmin };
