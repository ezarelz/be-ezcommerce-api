import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

/**
 * Seed script for the e‑commerce database. This script populates the
 * database with a default admin user, a handful of categories, a demo shop
 * owned by the admin and several products per category. Run it with:
 *
 *     npx prisma db seed
 *
 * or via the npm script `prisma:seed` defined in package.json.
 */
const db = new PrismaClient();

async function main() {
  // Create a demo admin user with a hashed password. In a real application
  // you'll want to change this email/password and restrict who can log in.
  const passwordHash = await bcrypt.hash('password', 10);
  const user = await db.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@example.com',
      password: passwordHash,
      isSeller: true,
    },
  });

  // Create a few default categories if they don't already exist.
  const categoryNames = ['Shirts', 'Pants', 'Shoes'];
  const categories = await Promise.all(
    categoryNames.map((name) =>
      db.category.upsert({
        where: { slug: name.toLowerCase() },
        update: {},
        create: {
          name,
          slug: name.toLowerCase(),
        },
      })
    )
  );

  // Create a shop for the admin user.
  const shop = await db.shop.upsert({
    where: { ownerId: user.id },
    update: {},
    create: {
      name: 'Demo Shop',
      slug: 'demo-shop',
      ownerId: user.id,
      description: 'Demo shop for seeded data',
    },
  });

  // Create a handful of products across the categories. Each product is
  // associated with the shop and one category. Images are stored as an
  // array of URLs; update the seed values if you have real image files.
  const productData = categories.flatMap((category) =>
    Array.from({ length: 5 }, (_, idx) => ({
      title: `${category.name} Product ${idx + 1}`,
      description: `A sample ${category.name.toLowerCase()} product`,
      price: 50000 + idx * 10000,
      images: ['https://placehold.co/400'],
      stock: 10,
      categoryId: category.id,
      shopId: shop.id,
    }))
  );

  await db.product.createMany({ data: productData });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });