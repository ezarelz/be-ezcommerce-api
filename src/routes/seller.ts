import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import upload from '../middlewares/upload';
import { authenticateUser } from '../middlewares/auth';
import { signToken } from '../utils/jwt'; // ✅ untuk refresh JWT

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * tags:
 *   name: Seller
 *   description: Seller activation & shop management
 */

/**
 * @swagger
 * /api/seller/activate:
 *   post:
 *     summary: Activate seller mode (create a shop for current user)
 *     description: Create a new shop and activate seller mode for the authenticated user. Automatically issues a refreshed JWT token with isSeller.
 *     tags: [Seller]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of your shop
 *                 example: "Elz Official Store"
 *               slug:
 *                 type: string
 *                 description: Custom slug for your shop (optional)
 *                 example: "elz-official-store"
 *               address:
 *                 type: string
 *                 description: Shop address
 *                 example: "Jl. Bekasi No. 7, Bekasi"
 *               logo:
 *                 type: string
 *                 format: binary
 *                 description: PNG/JPG/WEBP image (max 5MB)
 *     responses:
 *       201:
 *         description: Shop created and seller activated successfully
 *       400:
 *         description: Validation error or already activated
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  '/activate',
  authenticateUser,
  upload.single('logo'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId ? Number(req.user.userId) : undefined;
      const { name, slug, address } = req.body;

      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      if (!name?.trim()) {
        res.status(400).json({ message: 'Shop name is required' });
        return;
      }

      // ✅ Check if user already has a shop
      const existing = await prisma.shop.findUnique({ where: { userId } });
      if (existing) {
        res.status(400).json({ message: 'You already activated seller mode' });
        return;
      }

      // ✅ Upload logo
      const logoUrl = req.file?.path ?? null;

      // ✅ Create shop
      const shop = await prisma.shop.create({
        data: {
          name,
          slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
          address,
          logo: logoUrl,
          userId,
        },
      });

      // ✅ Update user role
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isSeller: true },
      });

      // ✅ Issue new JWT token (refreshed)
      const newToken = signToken({
        userId: updatedUser.id,
        isSeller: true,
      });

      res.status(201).json({
        success: true,
        message: 'Seller activated successfully',
        shop,
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          isSeller: true,
        },
        token: newToken,
      });
    } catch (error) {
      console.error('Error activating seller:', error);
      res.status(500).json({
        message: 'Error activating seller',
        error: (error as Error).message,
      });
    }
  }
);

/**
 * @swagger
 * /api/seller/shop:
 *   get:
 *     summary: Get my shop profile
 *     description: Retrieve the current user's shop profile and its products.
 *     tags: [Seller]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns shop data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Shop not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/shop',
  authenticateUser,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId ? Number(req.user.userId) : undefined;

      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const shop = await prisma.shop.findUnique({
        where: { userId },
        include: { products: true },
      });

      if (!shop) {
        res.status(404).json({ message: 'Shop not found' });
        return;
      }

      res.json(shop);
    } catch (error) {
      console.error('Error fetching shop:', error);
      res.status(500).json({
        message: 'Error fetching shop profile',
        error: (error as Error).message,
      });
    }
  }
);

/**
 * @swagger
 * /api/seller/shop:
 *   patch:
 *     summary: Update my shop profile
 *     description: Update your shop information and logo.
 *     tags: [Seller]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: New name of your shop
 *               slug:
 *                 type: string
 *                 description: New slug for your shop
 *               address:
 *                 type: string
 *                 description: New address
 *               logo:
 *                 type: string
 *                 format: binary
 *                 description: New logo file (optional)
 *     responses:
 *       200:
 *         description: Shop updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Shop not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  '/shop',
  authenticateUser,
  upload.single('logo'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId ? Number(req.user.userId) : undefined;
      const { name, slug, address } = req.body;

      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const shop = await prisma.shop.findUnique({ where: { userId } });
      if (!shop) {
        res.status(404).json({ message: 'Shop not found' });
        return;
      }

      const logoUrl = req.file?.path ?? shop.logo;

      const updated = await prisma.shop.update({
        where: { userId },
        data: {
          name: name || shop.name,
          slug: slug || shop.slug,
          address: address || shop.address,
          logo: logoUrl,
        },
      });

      res.json({
        success: true,
        message: 'Shop updated successfully',
        shop: updated,
      });
    } catch (error) {
      console.error('Error updating shop:', error);
      res.status(500).json({
        message: 'Error updating shop profile',
        error: (error as Error).message,
      });
    }
  }
);

export default router;
