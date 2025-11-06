# 🛍️ Ezar Commerce API

A simple and modern e-commerce backend built with **Node.js**, **TypeScript**, and **Prisma ORM**.  
This project provides core API endpoints for authentication, product management, cart, orders, and payments — designed to be easily deployed on [Railway](https://railway.app).

---

## 🚀 Tech Stack

- **Node.js** — JavaScript runtime environment
- **TypeScript** — Type-safe development
- **Express.js** — Fast web framework
- **Prisma ORM** — Database modeling and migration
- **PostgreSQL** — Primary database
- **Railway** — Cloud deployment (backend + PostgreSQL)

---

## 📂 Project Structure

```

backend-ecomm/
├── prisma/              # Prisma schema & migrations
├── src/                 # Source code (controllers, routes, middlewares, etc)
├── .env.example         # Example environment variables
├── package.json         # Project configuration
├── tsconfig.json        # TypeScript configuration
└── Dockerfile           # Optional for containerized deployment

```

---

## ⚙️ Environment Variables

Create a `.env` file in the project root.  
Example configuration (you can copy from `.env.example`):

```

DATABASE_URL=postgresql://user:password@host:port/dbname
JWT_SECRET=your_jwt_secret
PORT=4001

```

---

## 🧱 Installation & Development

Clone the repository:

```bash
git clone https://github.com/ezarelz/be-ezcommerce-api.git
cd ezar-commerce-api
```

Install dependencies:

```bash
npm install
```

Generate Prisma client:

```bash
npx prisma generate
```

Run database migrations:

```bash
npx prisma migrate dev
```

Start development server:

```bash
npm run dev
```

---

## 🏗️ Build & Production

Build TypeScript to JavaScript:

```bash
npm run build
```

Start production server:

```bash
npm start
```

---

## 🌐 Deployment (Railway)

1. Push this repo to GitHub.
2. Create a new project in [Railway](https://railway.app).
3. Connect to your GitHub repo.
4. Add environment variables (`DATABASE_URL`, `JWT_SECRET`, etc).
5. Deploy 🚀

---

## 📜 License

This project is licensed under the **MIT License** — feel free to use and modify it.

---

### ✨ Author

**Manggala Eleazar (Ezar)**
🌍 [https://github.com/ezarelz](https://github.com/ezarelz)
