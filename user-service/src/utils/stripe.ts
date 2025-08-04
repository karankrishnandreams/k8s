// import dotenv from "dotenv";
// import path from "path";
import Stripe from "stripe";

// Load environment variables from .env file (relative to this file)
// dotenv.config({ path: path.join(__dirname, "../../.env") });
// Create a Stripe instance with the secret key and specify API version
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  //@ts-ignore
  apiVersion: "2024-06-20", // Current latest stable version as of June 2024
});

export default stripe;
