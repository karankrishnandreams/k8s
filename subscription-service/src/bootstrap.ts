// src/bootstrap.ts

import path from "node:path";
import { addAliases } from "module-alias";
import dotenv from "dotenv";

const envArg = process.argv.find((arg) => arg.startsWith("--env="));
if (envArg) {
  const envName = envArg ? envArg.split("=")[1] : "development";
  if (envName === "localrun") {
    const envPath = path.resolve(__dirname, `../../.env.${envName}`);

    dotenv.config({ path: envPath });
  }
} else {
  dotenv.config();
}

/** project root = /usr/src/app */
const root = path.resolve(__dirname, "..");

/** folders that need an alias */
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

/** map each alias to src/ or dist/ path depending on NODE_ENV */
const isProd = process.env.NODE_ENV === "production";
const targets: Record<string, string> = {};

for (const dir of aliasDirs) {
  targets[`@${dir}`] = path.join(root, isProd ? `dist/${dir}` : `src/${dir}`);
}

addAliases(targets);

// 👉 now start the real server
import("./server");
