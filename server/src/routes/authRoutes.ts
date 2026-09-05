import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/env';
import User from '../models/User';

const router = Router();
const memoryUsers: Array<{ id: string; name: string; email: string; password: string; role: 'user' | 'admin' }> = [];

const normalizeEmail = (email: string) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

const isEmailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));

const isEmailAllowed = (email: string) => {
  const normalized = normalizeEmail(email);
  if (!isEmailValid(normalized)) return false;
  const envAllowed = config.allowedEmailDomains;
  if (!envAllowed || envAllowed.trim() === '*' || envAllowed.trim() === '') {
    return true;
  }
  const allowed = envAllowed.split(',').map((d) => d.trim().toLowerCase());
  const parts = normalized.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1].toLowerCase();
  return allowed.some((d) => domain === d || domain.endsWith('.' + d));
};

const createToken = (user: { id: string; role: 'user' | 'admin'; email: string }) => {
  return jwt.sign(
    { id: user.id, role: user.role, email: normalizeEmail(user.email) },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
};

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const normalizedEmail = normalizeEmail(email);

    if (!trimmedName) {
      return res.status(400).json({ message: 'Name is required.' });
    }
    if (!isEmailValid(normalizedEmail) || !isEmailAllowed(normalizedEmail) || !password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingFromDb = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') } }
      ]
    }).catch(() => null);
    const existingInMemory = memoryUsers.find((user) => normalizeEmail(user.email) === normalizedEmail);

    if (existingFromDb || existingInMemory) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name: trimmedName, email: normalizedEmail, password: hashed });

    const userId = String(user._id || (user as any).id);
    const userRole = user.role || 'user';
    const token = createToken({ id: userId, role: userRole, email: normalizedEmail });

    console.log(`[AUTH] register request = ${normalizedEmail}`);
    console.log(`[AUTH] user created in DB = true, userId = ${userId}`);

    res.status(201).json({
      token,
      user: {
        id: userId,
        name: user.name || trimmedName,
        email: normalizedEmail,
        role: userRole
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = normalizeEmail(email);

    if (!isEmailValid(normalizedEmail) || !isEmailAllowed(normalizedEmail) || !password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    // Lookup user by normalized email first, then fallback to case-insensitive match for existing legacy records
    const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let userFromDb = await User.findOne({ email: normalizedEmail }).catch(() => null);
    if (!userFromDb) {
      userFromDb = await User.findOne({ email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') } }).catch(() => null);
    }
    const userInMemory = memoryUsers.find((item) => normalizeEmail(item.email) === normalizedEmail);
    const user = userFromDb || userInMemory;

    console.log(`[AUTH] login email = ${normalizedEmail}`);
    console.log(`[AUTH] user found = ${Boolean(user)} (fromDb: ${Boolean(userFromDb)}, inMemory: ${Boolean(userInMemory)})`);

    if (!user) {
      console.log(`[AUTH] login failed: user not found`);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    console.log(`[AUTH] bcrypt match = ${valid}`);

    if (!valid) {
      console.log(`[AUTH] login failed: password mismatch`);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const userId = (user as any)._id ? String((user as any)._id) : user.id;
    const userRole = (user as any).role || 'user';
    const finalEmail = normalizeEmail(user.email) || normalizedEmail;

    const token = createToken({ id: userId, role: userRole, email: finalEmail });
    console.log(`[AUTH] jwt generated = ${Boolean(token)}, userId = ${userId}`);
    res.json({
      token,
      user: {
        id: userId,
        name: user.name,
        email: finalEmail,
        role: userRole
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!isEmailValid(normalizedEmail) || !newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ message: 'Please provide a valid email and new password (minimum 6 characters).' });
    }

    const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const user = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') } }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: 'User account not found.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    console.log(`[AUTH] password reset successfully for: ${normalizedEmail}`);
    res.json({ message: 'Password updated successfully. Please sign in with your new password.' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Password reset failed.' });
  }
});

export default router;
