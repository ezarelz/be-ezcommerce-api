// routes/cart.ts
import { Router, type Request, type Response } from 'express';
import prisma from '../libs/prisma';
import { authenticate } from '../middlewares/auth';
import type { Product, Shop, CartItem } from '@prisma/client';

type AuthedRequest = Request & { user?: { userId: number } };

const router = Router();

const toInt = (v: unknown, d = 0): number => {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : d;
};

/**
 * @swagger
 * tags:
 *   name: Cart
 *   description: Cart operations for the logged-in user
 *
 * components:
 *   schemas:
 *     CartLine:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 12 }
 *         productId: { type: integer, example: 101 }
 *         userId: { type: integer, example: 5 }
 *         quantity: { type: integer, example: 2 }
 *         product:
 *           type: object
 *           properties:
 *             id: { type: integer, example: 101 }
 *             title: { type: string, example: "Basic Tee" }
 *             price: { type: number, example: 99000 }
 *             shopId: { type: integer, example: 3 }
 *         subtotal:
 *           type: number
 *           example: 198000
 *     CartGroup:
 *       type: object
 *       properties:
 *         shop:
 *           type: object
 *           properties:
 *             id: { type: integer, example: 3 }
 *             name: { type: string, example: "EZ Store" }
 *             slug: { type: string, example: "ez-store" }
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CartLine'
 *         total:
 *           type: number
 *           example: 198000
 *     CartGetResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "OK" }
 *         data:
 *           type: object
 *           properties:
 *             groups:
 *               type: array
 *               items: { $ref: '#/components/schemas/CartGroup' }
 *             grandTotal:
 *               type: number
 *               example: 249000
 *     BasicOK:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "Cart cleared" }
 *     BadRequest:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: false }
 *         message: { type: string, example: "Invalid productId or qty" }
 *     ServerError:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: false }
 *         message: { type: string, example: "Internal Server Error" }
 */

/**
 * GET /api/cart
 * Returns items grouped by shop with a grand total for the logged-in user.
 *
 * @swagger
 * /api/cart:
 *   get:
 *     summary: Get my cart grouped by shop
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CartGetResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServerError'
 */
router.get('/', authenticate, async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const items = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          include: { shop: true },
        },
      },
    });

    type Line = CartItem & { product: Product & { shop: Shop } } & {
      subtotal: number;
    };
    type Group = {
      shop: Shop;
      items: Line[];
      total: number;
    };

    const groupsMap = new Map<number, Group>();

    for (const item of items) {
      const subtotal = item.quantity * item.product.price;
      const shopId = item.product.shopId;
      const existing = groupsMap.get(shopId);

      const line: Line = {
        ...(item as CartItem),
        product: item.product as Product & { shop: Shop },
        subtotal,
      };

      if (existing) {
        existing.items.push(line);
        existing.total += subtotal;
      } else {
        groupsMap.set(shopId, {
          shop: item.product.shop,
          items: [line],
          total: subtotal,
        });
      }
    }

    const groups = Array.from(groupsMap.values());
    const grandTotal = groups.reduce((acc, g) => acc + g.total, 0);

    res.json({ success: true, message: 'OK', data: { groups, grandTotal } });
  } catch {
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

/**
 * DELETE /api/cart
 * Removes all cart items for the logged-in user.
 *
 * @swagger
 * /api/cart:
 *   delete:
 *     summary: Clear my cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BasicOK'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServerError'
 */
router.delete('/', authenticate, async (req: AuthedRequest, res: Response) => {
  try {
    await prisma.cartItem.deleteMany({ where: { userId: req.user!.userId } });
    res.json({ success: true, message: 'Cart cleared' });
  } catch {
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

/**
 * POST /api/cart/items
 * Body: { productId: number, qty: number }
 * Adds to cart or increases quantity.
 *
 * @swagger
 * /api/cart/items:
 *   post:
 *     summary: Add item to cart (or increase quantity)
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, qty]
 *             properties:
 *               productId: { type: integer, example: 101 }
 *               qty: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: Item added or increased
 *       400:
 *         description: Invalid productId or qty
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BadRequest'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServerError'
 */
router.post(
  '/items',
  authenticate,
  async (req: AuthedRequest, res: Response) => {
    try {
      const productId = toInt(req.body.productId);
      const qty = toInt(req.body.qty, 1);

      if (!productId || qty <= 0) {
        res
          .status(400)
          .json({ success: false, message: 'Invalid productId or qty' });
        return;
      }

      const userId = req.user!.userId;

      const existing = await prisma.cartItem.findUnique({
        where: { userId_productId: { userId, productId } },
      });

      if (existing) {
        const updated = await prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + qty },
        });
        res.json({
          success: true,
          message: 'Quantity increased',
          data: { item: updated },
        });
        return;
      }

      const created = await prisma.cartItem.create({
        data: { userId, productId, quantity: qty },
      });

      res.json({
        success: true,
        message: 'Item added to cart',
        data: { item: created },
      });
    } catch {
      res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  }
);

/**
 * PATCH /api/cart/items/:id
 * Body: { qty: number }
 * Updates quantity of a cart item.
 *
 * @swagger
 * /api/cart/items/{id}:
 *   patch:
 *     summary: Update cart item quantity
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Cart item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [qty]
 *             properties:
 *               qty: { type: integer, example: 3 }
 *     responses:
 *       200:
 *         description: Cart item updated
 *       400:
 *         description: Invalid qty
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BadRequest'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       404:
 *         description: Cart item not found
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServerError'
 */
router.patch(
  '/items/:id',
  authenticate,
  async (req: AuthedRequest, res: Response) => {
    try {
      const id = toInt(req.params.id);
      const qty = toInt(req.body.qty);

      if (qty <= 0) {
        res.status(400).json({ success: false, message: 'Invalid qty' });
        return;
      }

      const item = await prisma.cartItem.findUnique({ where: { id } });
      if (!item || item.userId !== req.user!.userId) {
        res
          .status(404)
          .json({ success: false, message: 'Cart item not found' });
        return;
      }

      const updated = await prisma.cartItem.update({
        where: { id },
        data: { quantity: qty },
      });

      res.json({
        success: true,
        message: 'Cart item updated',
        data: { item: updated },
      });
    } catch {
      res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  }
);

/**
 * DELETE /api/cart/items/:id
 * Removes a specific cart item.
 *
 * @swagger
 * /api/cart/items/{id}:
 *   delete:
 *     summary: Remove a cart item
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Cart item ID
 *     responses:
 *       200:
 *         description: Cart item removed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BasicOK'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       404:
 *         description: Cart item not found
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServerError'
 */
router.delete(
  '/items/:id',
  authenticate,
  async (req: AuthedRequest, res: Response) => {
    try {
      const id = toInt(req.params.id);
      const item = await prisma.cartItem.findUnique({ where: { id } });

      if (!item || item.userId !== req.user!.userId) {
        res
          .status(404)
          .json({ success: false, message: 'Cart item not found' });
        return;
      }

      await prisma.cartItem.delete({ where: { id } });
      res.json({ success: true, message: 'Cart item removed' });
    } catch {
      res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  }
);

export default router;
