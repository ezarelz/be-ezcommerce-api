import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { signToken } from '../utils/jwt';
import { authenticate, AuthRequest } from '../middlewares/auth';

const prisma = new PrismaClient();
const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Endpoints for user registration and login
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
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
 *                 description: The user's name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: A unique email for the new user
 *               password:
 *                 type: string
 *                 description: A strong password
 *             example:
 *               name: Jane Doe
 *               email: jane@example.com
 *               password: securePassword
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error or email already in use
 */
router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password } = req.body as {
    name?: string;
    email?: string;
    password?: string;
  };
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  // Check if user exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(400).json({ error: 'Email already registered' });
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, email, password: hashed } });
  res.status(201).json({ id: user.id, name: user.name, email: user.email });
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in and obtain a token
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
 *                 format: email
 *               password:
 *                 type: string
 *           example:
 *             email: jane@example.com
 *             password: securePassword
 *     responses:
 *       200:
 *         description: Successful login
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: Bearer token to include in subsequent requests
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken({ userId: user.id, isSeller: user.isSeller });
  res.json({ token });
});

/**
 * @swagger
 * /api/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The authenticated user's profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 isSeller:
 *                   type: boolean
 *       401:
 *         description: Missing or invalid token
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, name: user.name, email: user.email, isSeller: user.isSeller });
});

/**
 * @swagger
 * /api/me:
 *   patch:
 *     summary: Update current user's basic profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *             example:
 *               name: Jane Updated
 *     responses:
 *       200:
 *         description: Updated profile
 *       400:
 *         description: Bad input
 *       401:
 *         description: Unauthorized
 */
router.patch('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const { name } = req.body as { name?: string };
  if (!name) return res.status(400).json({ error: 'name is required' });
  const userId = req.user!.userId;
  const user = await prisma.user.update({ where: { id: userId }, data: { name } });
  res.json({ id: user.id, name: user.name, email: user.email, isSeller: user.isSeller });
});

export default router;