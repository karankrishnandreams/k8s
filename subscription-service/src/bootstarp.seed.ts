import path from "node:path";
import { addAliases } from "module-alias";
import dotenv from "dotenv";

// Load correct .env file via CLI arg like --env=localrun
const envArg = process.argv.find((arg) => arg.startsWith("--env="));
const envName = envArg ? envArg.split("=")[1] : "development";
const envPath = path.resolve(__dirname, `../../.env.${envName}`);
dotenv.config({ path: envPath });

// Setup module aliases
const root = path.resolve(__dirname, "..");
const aliasDirs = [
  "config",
  "controllers",
  "interfaces",
  "middlewares",
  "models",
  "routes",
  "services",
  "utils",
  "validations",
];

const isProd = process.env.NODE_ENV === "production";
const targets: Record<string, string> = {};

for (const dir of aliasDirs) {
  targets[`@${dir}`] = path.join(root, isProd ? `dist/${dir}` : `src/${dir}`);
}

addAliases(targets);
