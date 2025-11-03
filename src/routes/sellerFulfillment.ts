import { Router, type Request, type Response } from 'express';
import prisma from '../libs/prisma';
import { authenticateUser, requireSeller } from '../middlewares/auth';
import { OrderItemStatus, Prisma } from '@prisma/client';

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
 *   name: Seller Fulfillment
 *   description: Seller views & actions for order items
 */

/**
 * @swagger
 * /api/seller-fulfillment/order-items:
 *   get:
 *     summary: List my shop's order items
 *     tags: [Seller Fulfillment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, DELIVERED, COMPLETED, CANCELLED]
 *           example: PENDING
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Items fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a seller or no shop found
 *       500:
 *         description: Server error
 */
router.get(
  '/order-items',
  authenticateUser,
  requireSeller,
  async (req: AuthedRequest, res: Response) => {
    try {
      const page = clamp(toInt(req.query.page, 1), 1, 10_000_000);
      const limit = clamp(toInt(req.query.limit, 10), 1, 100);
      const statusParam = req.query.status
        ? String(req.query.status).toUpperCase()
        : undefined;

      const shop = await prisma.shop.findFirst({
        where: { userId: req.user!.userId },
        select: { id: true },
      });
      if (!shop) {
        return res
          .status(403)
          .json({ success: false, message: 'Not a seller or no shop' });
      }

      const where: Prisma.OrderItemWhereInput = {
        product: { shop: { userId: req.user!.userId } },
      };

      if (statusParam) {
        const allowed = new Set(Object.values(OrderItemStatus) as string[]);
        if (!allowed.has(statusParam)) {
          return res.status(400).json({
            success: false,
            message: `Invalid status. Allowed: ${[...allowed].join(', ')}`,
          });
        }
        where.status = statusParam as OrderItemStatus;
      }

      const items = await prisma.orderItem.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { order: { createdAt: 'desc' } },
        include: {
          product: {
            select: { id: true, title: true, images: true, price: true },
          },
          order: {
            select: {
              id: true,
              createdAt: true,
              address: true,
              shipping: true,
              status: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      res.json({ success: true, message: 'OK', data: items });
    } catch {
      res.status(500).json({
        success: false,
        message: 'Internal Server Error',
      });
    }
  }
);

/**
 * @swagger
 * /api/seller-fulfillment/order-items/{id}:
 *   get:
 *     summary: Get a single order item I sold
 *     tags: [Seller Fulfillment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Order item found
 *       404:
 *         description: Order item not found
 *       500:
 *         description: Server error
 */
router.get(
  '/order-items/:id',
  authenticateUser,
  requireSeller,
  async (req: AuthedRequest, res: Response) => {
    try {
      const id = toInt(req.params.id);

      const item = await prisma.orderItem.findFirst({
        where: {
          id,
          product: { shop: { userId: req.user!.userId } },
        },
        include: {
          product: {
            select: { id: true, title: true, images: true, price: true },
          },
          order: {
            select: {
              id: true,
              createdAt: true,
              status: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      if (!item) {
        return res
          .status(404)
          .json({ success: false, message: 'Order item not found' });
      }

      res.json({ success: true, message: 'OK', data: item });
    } catch {
      res.status(500).json({
        success: false,
        message: 'Internal Server Error',
      });
    }
  }
);

/**
 * @swagger
 * /api/seller-fulfillment/order-items/{id}/status:
 *   patch:
 *     summary: Update an order item status (seller actions)
 *     description: Seller can update order item status to DELIVERED or CANCELLED.
 *     tags: [Seller Fulfillment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 12
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, DELIVERED, COMPLETED, CANCELLED]
 *                 example: DELIVERED
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid status or transition
 *       404:
 *         description: Order item not found
 *       500:
 *         description: Server error
 */
router.patch(
  '/order-items/:id/status',
  authenticateUser,
  requireSeller,
  async (req: AuthedRequest, res: Response) => {
    try {
      const id = toInt(req.params.id);
      const statusParam = String(req.body?.status ?? '').toUpperCase();

      if (!['CANCELLED', 'DELIVERED'].includes(statusParam)) {
        return res.status(400).json({
          success: false,
          message: 'Only CANCELLED or DELIVERED are allowed by seller',
        });
      }

      const item = await prisma.orderItem.findFirst({
        where: { id, product: { shop: { userId: req.user!.userId } } },
      });

      if (!item) {
        return res
          .status(404)
          .json({ success: false, message: 'Order item not found' });
      }

      if (item.status !== OrderItemStatus.PENDING) {
        return res.status(403).json({
          success: false,
          message: 'Invalid status transition (must be from PENDING)',
        });
      }

      const updated = await prisma.orderItem.update({
        where: { id },
        data: { status: statusParam as OrderItemStatus },
      });

      // If CANCELLED → return stock
      if (statusParam === 'CANCELLED') {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      res.json({
        success: true,
        message: 'Order item status updated',
        data: updated,
      });
    } catch (err) {
      console.error('Update status error:', err);
      res.status(500).json({
        success: false,
        message: 'Internal Server Error',
      });
    }
  }
);

/**
 * @swagger
 * /api/seller-fulfillment/order-items/{id}/deliver:
 *   patch:
 *     summary: Mark an order item as delivered (seller action)
 *     description:
 *       Seller marks an order item as DELIVERED (shipped).
 *       Buyer will later confirm receipt to mark it as COMPLETED.
 *     tags: [Seller Fulfillment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 7
 *     responses:
 *       200:
 *         description: Item marked as delivered successfully
 *       400:
 *         description: Invalid transition (only PENDING → DELIVERED allowed, or already delivered)
 *       404:
 *         description: Item not found
 *       500:
 *         description: Internal Server Error
 */
router.patch(
  '/order-items/:id/deliver',
  authenticateUser,
  requireSeller,
  async (req: AuthedRequest, res: Response) => {
    try {
      const id = toInt(req.params.id);

      const item = await prisma.orderItem.findFirst({
        where: { id, product: { shop: { userId: req.user!.userId } } },
      });

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Order item not found',
        });
      }

      // 🟡 prevent double deliver
      if (item.status === OrderItemStatus.DELIVERED) {
        return res.status(400).json({
          success: false,
          message: 'Item already marked as DELIVERED',
          data: item,
        });
      }

      // 🚫 prevent invalid transition
      if (item.status !== OrderItemStatus.PENDING) {
        return res.status(400).json({
          success: false,
          message: `Invalid transition. Current status: ${item.status}. Only PENDING → DELIVERED allowed.`,
          data: item,
        });
      }

      // ✅ update to DELIVERED
      const updated = await prisma.orderItem.update({
        where: { id },
        data: { status: OrderItemStatus.DELIVERED },
      });

      return res.json({
        success: true,
        message: 'Order item marked as DELIVERED',
        data: updated,
      });
    } catch (err) {
      console.error('Deliver error:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal Server Error',
      });
    }
  }
);

export default router;
