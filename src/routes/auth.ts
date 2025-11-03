import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { signToken } from '../utils/jwt';
import { authenticate, AuthRequest } from '../middlewares/auth';
import upload from '../middlewares/upload';

const prisma = new PrismaClient();
const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Endpoints for user registration, login, and profile management
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: secret123
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error or email already registered
 *       500:
 *         description: Internal server error
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res
        .status(400)
        .json({ error: 'name, email and password are required' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashed },
    });

    const token = signToken({ userId: user.id, isSeller: user.isSeller });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: { id: user.id, name: user.name, email: user.email },
      token,
    });
  } catch (err) {
    console.error('POST /register error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in and obtain JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: secret123
 *     responses:
 *       200:
 *         description: Successful login
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'email and password are required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ userId: user.id, isSeller: user.isSeller });

    return res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isSeller: user.isSeller,
      },
      token,
    });
  } catch (err) {
    console.error('POST /login error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user's info
 *       401:
 *         description: Unauthorized (missing/invalid token)
 *       404:
 *         description: User not found
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.user!.userId);
    if (Number.isNaN(userId))
      return res.status(400).json({ error: 'Invalid user id in token' });

    // fetch latest from DB (ensure isSeller updated)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        isSeller: true,
        createdAt: true,
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) {
    console.error('GET /me error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   patch:
 *     summary: Update current user's basic profile (supports avatar upload)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Updated Name
 *               phone:
 *                 type: string
 *                 example: "+62812345678"
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Updated user info
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.patch(
  '/me',
  authenticate,
  upload.single('avatar'),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = Number(req.user!.userId);
      if (Number.isNaN(userId))
        return res.status(400).json({ error: 'Invalid user id in token' });

      const { name, phone } = req.body;
      const avatarUrl = req.file?.path;

      // ✅ perbaikan disini:
      if (!name && !phone && !avatarUrl) {
        return res
          .status(400)
          .json({
            error: 'At least one field (name, phone, or avatar) required',
          });
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(name ? { name } : {}),
          ...(phone ? { phone } : {}),
          ...(avatarUrl ? { avatarUrl } : {}),
        },
      });

      return res.json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
          avatarUrl: updated.avatarUrl,
          isSeller: updated.isSeller,
        },
      });
    } catch (err) {
      console.error('PATCH /me error', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
