// routes/reviews.ts
import { Router, type Request, type Response } from 'express';
import prisma from '../libs/prisma';
import { authenticateUser } from '../middlewares/auth';
import { OrderStatus, Prisma } from '@prisma/client';

type AuthedRequest = Request & { user?: { userId: number } };

const router = Router();

const toInt = (v: unknown, d = 0): number => {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : d;
};
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Product reviews by users
 *
 * components:
 *   schemas:
 *     ReviewBasic:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 1 }
 *         productId: { type: integer, example: 101 }
 *         userId: { type: integer, example: 5 }
 *         rating: { type: integer, example: 5 }
 *         comment: { type: string, example: "Mantap!" }
 *         createdAt: { type: string, format: date-time }
 *     CreateReviewPayload:
 *       type: object
 *       required: [productId, rating]
 *       properties:
 *         productId: { type: integer, example: 101 }
 *         rating: { type: integer, minimum: 1, maximum: 5, example: 5 }
 *         comment: { type: string, example: "Produk sesuai deskripsi." }
 */

/**
 * POST /api/reviews
 * Body: { productId, rating (1–5), comment }
 * Requires completed purchase.
 *
 * @swagger
 * /api/reviews:
 *   post:
 *     summary: Create or update my review for a product
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReviewPayload'
 *     responses:
 *       200:
 *         description: Review saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Review saved" }
 *                 data: { $ref: '#/components/schemas/ReviewBasic' }
 *       400:
 *         description: Invalid input or not eligible (no completed purchase)
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  '/',
  authenticateUser,
  async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const productId = toInt(req.body?.productId);
      const rating = toInt(req.body?.rating);
      const comment = String(req.body?.comment ?? '');

      if (!productId || rating < 1 || rating > 5) {
        res
          .status(400)
          .json({ success: false, message: 'Invalid productId or rating' });
        return;
      }

      // must have at least one COMPLETED order for this product
      const purchased = await prisma.orderItem.findFirst({
        where: { productId, order: { userId, status: OrderStatus.COMPLETED } },
      });
      if (!purchased) {
        res
          .status(400)
          .json({
            success: false,
            message: 'Complete a purchase before reviewing',
          });
        return;
      }

      // Since schema doesn't have @@unique([userId, productId]), do "find-or-create/update"
      const existing = await prisma.review.findFirst({
        where: { userId, productId },
      });

      let review;
      if (existing) {
        review = await prisma.review.update({
          where: { id: existing.id },
          data: { rating, comment },
        });
      } else {
        review = await prisma.review.create({
          data: { userId, productId, rating, comment },
        });
      }

      res.json({ success: true, message: 'Review saved', data: review });
    } catch {
      res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  }
);

/**
 * GET /api/reviews/product/:productId
 * Query: page=1, limit=10
 *
 * @swagger
 * /api/reviews/product/{productId}:
 *   get:
 *     summary: List reviews for a product
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Reviews fetched
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
router.get('/product/:productId', async (req: Request, res: Response) => {
  try {
    const productId = toInt(req.params.productId);
    const page = clamp(toInt(req.query.page, 1), 1, 10_000_000);
    const limit = clamp(toInt(req.query.limit, 10), 1, 100);

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    const reviews = await prisma.review.findMany({
      where: { productId },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true } } },
    });

    res.json({ success: true, message: 'OK', data: reviews });
  } catch {
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

/**
 * GET /api/reviews/my
 * Query: page, limit, rating?, q?
 *
 * @swagger
 * /api/reviews/my:
 *   get:
 *     summary: List my reviews
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: rating
 *         schema: { type: integer, minimum: 1, maximum: 5 }
 *       - in: query
 *         name: q
 *         schema: { type: string, example: "kaos" }
 *     responses:
 *       200:
 *         description: Reviews fetched
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  '/my',
  authenticateUser,
  async (req: AuthedRequest, res: Response) => {
    try {
      const page = clamp(toInt(req.query.page, 1), 1, 10_000_000);
      const limit = clamp(toInt(req.query.limit, 10), 1, 100);
      const rating = req.query.rating ? toInt(req.query.rating) : undefined;
      const q = req.query.q ? String(req.query.q) : undefined;

      const where: Prisma.ReviewWhereInput = { userId: req.user!.userId };
      if (typeof rating === 'number') where.rating = rating;
      if (q) {
        // Product di schema punya "title" + "images"
        where.OR = [
          { comment: { contains: q, mode: 'insensitive' } },
          { product: { title: { contains: q, mode: 'insensitive' } } },
        ];
      }

      const reviews = await prisma.review.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          product: {
            select: { id: true, title: true, images: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, message: 'OK', data: reviews });
    } catch {
      res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  }
);

/**
 * GET /api/reviews/my/eligible
 * Products user completed but hasn't reviewed.
 * Query: page=1, limit=10
 *
 * @swagger
 * /api/reviews/my/eligible:
 *   get:
 *     summary: Products eligible for me to review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Eligible products fetched
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  '/my/eligible',
  authenticateUser,
  async (req: AuthedRequest, res: Response) => {
    try {
      const page = clamp(toInt(req.query.page, 1), 1, 10_000_000);
      const limit = clamp(toInt(req.query.limit, 10), 1, 100);
      const userId = req.user!.userId;

      const completedItems = await prisma.orderItem.findMany({
        where: {
          order: { userId, status: OrderStatus.COMPLETED },
          NOT: { product: { reviews: { some: { userId } } } },
        },
        include: { product: true },
      });

      // deduplicate by productId
      const map = new Map<number, (typeof completedItems)[number]['product']>();
      for (const ci of completedItems) {
        map.set(ci.productId, ci.product);
      }
      const all = Array.from(map.values());
      const start = (page - 1) * limit;
      const paged = all.slice(start, start + limit);

      res.json({ success: true, message: 'OK', data: paged });
    } catch {
      res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  }
);

/**
 * DELETE /api/reviews/:id
 * Deletes my review.
 *
 * @swagger
 * /api/reviews/{id}:
 *   delete:
 *     summary: Delete my review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Review deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Review not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/:id',
  authenticateUser,
  async (req: AuthedRequest, res: Response) => {
    try {
      const id = toInt(req.params.id);
      const review = await prisma.review.findUnique({ where: { id } });
      if (!review || review.userId !== req.user!.userId) {
        res.status(404).json({ success: false, message: 'Review not found' });
        return;
      }
      await prisma.review.delete({ where: { id } });
      res.json({ success: true, message: 'Review deleted' });
    } catch {
      res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  }
);

export default router;
