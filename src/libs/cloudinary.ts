import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// --- Safety check agar ENV tidak kosong ---
const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
  process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.warn(
    '⚠️  Cloudinary environment variables are missing! ' +
      'Check your .env file: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET'
  );
}

// --- Cloudinary global configuration ---
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true, // ✅ always use https:// URLs
});

// --- Optional: test ping to Cloudinary (logs once at startup) ---
(async () => {
  try {
    const result = await cloudinary.api.ping();
    console.log(`☁️  Cloudinary connected: ${result.status}`);
  } catch {
    console.warn(
      '⚠️  Could not verify Cloudinary connection. Check your API keys.'
    );
  }
})();

export default cloudinary;
