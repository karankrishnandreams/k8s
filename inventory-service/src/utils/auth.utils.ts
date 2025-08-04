import jwt, { SignOptions } from 'jsonwebtoken';
import { TokenPayload, RefreshTokenPayload, Tokens } from '../types/jwt';
import logger from '@utils/logger';
import fs from 'fs';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import xlsx from 'xlsx';

dotenv.config();

const configFilePath: any = path.join(
  __dirname,
  "..",
  "..",
  "config",
  "default.json"
);

// Type-safe environment configuration
const getJwtConfig = () => {
  const {
    JWT_SECRET,
    JWT_EXPIRES_IN = '1h',//0000
    REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_EXPIRES_IN = '7d',
  } = process.env;

  if (!JWT_SECRET) throw new Error('JWT_SECRET is required');
  if (!REFRESH_TOKEN_SECRET) throw new Error('REFRESH_TOKEN_SECRET is required');

  return {
    jwtSecret: JWT_SECRET,
    jwtExpiresIn: JWT_EXPIRES_IN,
    refreshSecret: REFRESH_TOKEN_SECRET,
    refreshExpiresIn: REFRESH_TOKEN_EXPIRES_IN,
  };
};

const { jwtSecret, jwtExpiresIn, refreshSecret, refreshExpiresIn } = getJwtConfig();

/**
 * Generate JWT access token with proper typing
 */
export const generateToken = (payload: TokenPayload): string => {
  // Create options with correct typing
  const options: SignOptions = {
    expiresIn: jwtExpiresIn as any, // Explicit type assertion
  };

  return jwt.sign(payload, jwtSecret, options);
};

/**
 * Generate refresh token with proper typing
 */
export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  const options: SignOptions = {
    expiresIn: refreshExpiresIn as any, // Explicit type assertion
  };

  return jwt.sign(payload, refreshSecret, options);
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, jwtSecret) as TokenPayload;
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, refreshSecret) as RefreshTokenPayload;
};

/**
 * Refresh token pair
 */
export const refreshTokens = (refreshToken: string): Tokens => {
  const payload = verifyRefreshToken(refreshToken);

  const accessToken = generateToken(payload); // Reuse all fields
  const newRefreshToken = generateRefreshToken(payload); // Optional: rotate token

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
};


export const readJSONFile = (filePath: string) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading or parsing the file:', error);
    return null;
  }
};

export const readConfigFile = () => {
  try {
    const data: any = fs.readFileSync(configFilePath, "utf-8");
    const config: any = JSON.parse(data);
    return config;
  } catch (error: any) {
    // console.error('Error reading JSON file:', error?.message);
    return null;
  }
};

export const uploadParallel = async (
  file: any,
  moduleName: string,
  res: any,
  uploadType?: any
): Promise<string> => {
  try {
    const imageMimeTypes = [
      "image/jpeg", // .jpg, .jpeg
      "image/png", // .png
      "image/webp", // .webp

    ];

    const allowedMimeTypes = [
      ...imageMimeTypes

    ];

    let fileBuffer: Buffer;
    let fileExtension: string;
    const config = readConfigFile();
    const bucket =
      config?.aws_credential?.bucket_name || process.env.BUCKET_NAME;

    // Validate MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`Unsupported file type: ${file.mimetype}`);
    }

    const s3 = new S3Client({
      region: config?.aws_credential?.region || process.env.REGION,
      credentials: {
        accessKeyId:
          config?.aws_credential?.access_key_id ||
          process.env.ACCESS_KEY_ID ||
          "",
        secretAccessKey:
          config?.aws_credential?.secret_access_key ||
          process.env.SECRET_ACCESS_KEY ||
          "",
      },
      useAccelerateEndpoint: false,
    });

    if (uploadType === "googleImageUrl") {
      // If the input is a URL, download the file
      const response = await axios.get(file, { responseType: "arraybuffer" });
      fileBuffer = Buffer.from(response.data);
      const urlParts = file.split(".");
      fileExtension = urlParts[urlParts.length - 1].split("?")[0]; // Handle potential query strings
    } else {
      fileBuffer = file.buffer;
      fileExtension = file.originalname.split(".").pop();
    }

    const uniqueId = uuidv4();
    const fileName = `${Date.now()}-${uniqueId}.${fileExtension}`;
    const fileKey = `${moduleName}/${fileName}`;

    const params = {
      Bucket: bucket,
      Key: fileKey,
      Body: fileBuffer,
      ContentType: file.mimetype || `image/${fileExtension}`,
    };

    // Parallel upload with configurations
    const uploadParallel = new Upload({
      client: s3,
      queueSize: 10,
      partSize: 5 * 1024 * 1024,
      leavePartsOnError: false,
      params,
    });

    await uploadParallel.done();
    return fileKey;
  } catch (error: any) {
    console.error("Error during S3 upload:", error);
    throw new Error("Failed to upload file to S3");
  }
};

export const getS3Parallel = async (fileKey: string): Promise<string> => {
  try {
    const configJson = readConfigFile();

    const s3 = new S3Client({
      region: configJson?.aws_credential?.region || process.env.REGION,
      credentials: {
        accessKeyId:
          configJson?.aws_credential?.access_key_id ||
          process.env.ACCESS_KEY_ID ||
          "",
        secretAccessKey:
          configJson?.aws_credential?.secret_access_key ||
          process.env.SECRET_ACCESS_KEY ||
          "",
      },
      useAccelerateEndpoint: false,
    });

    const getObjectParams = {
      Bucket:
        configJson?.aws_credential?.bucket_name || process.env.BUCKET_NAME!,
      Key: fileKey,
    };

    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand(getObjectParams),
      { expiresIn: 432000 } // 5 days in seconds
    );

    return signedUrl;
  } catch (error) {
    throw new Error("Failed to generate signed URL");
  }
};

export const getItemImage = async (image: string) => {
  let finalImage: any[] = [];

  if (image.length > 0) {
    for (const item of image) {
      const uploadedKey = await getS3Parallel(item);
      finalImage.push(uploadedKey);
    }
    return finalImage;
  }
  return [];
}

export const slugify = (text: string): string => {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")       // Remove all non-alphanumeric chars except spaces and hyphens
    .replace(/\s+/g, "-")               // Replace spaces with -
    .replace(/-+/g, "-");               // Collapse multiple dashes
};

export const handleImageUpdate = async (images: string[]) => {
  const cleaned: string[] = [];

  for (const url of images) {
    try {
      const parsedUrl = new URL(url);
      const key = parsedUrl.pathname.startsWith("/")
        ? parsedUrl.pathname.slice(1)
        : parsedUrl.pathname;
      cleaned.push(key);
    } catch {
      // fallback: push original if it's not a valid URL
      cleaned.push(url);
    }
  }

  return cleaned;
}


export const groupDataBySheetName = (workbook: any, sheetNames: any) => {
  let purchaseProposals: any[] = [];
  let items: any[] = [];

  for (const sheet of sheetNames) {
    const sheetData = workbook.Sheets[sheet];
    const rows = xlsx.utils.sheet_to_json(sheetData, { defval: null });

    if (sheet.toLowerCase().includes("purchase")) {
      purchaseProposals = rows;
    } else if (sheet.toLowerCase().includes("items")) {
      items = rows;
    }
  }

  // Group items by proposalSno
  const itemsGroupedByProposalSno: { [key: number]: any[] } = {};
  for (const item of items) {
    const key = item.pSno;
    if (!itemsGroupedByProposalSno[key]) {
      itemsGroupedByProposalSno[key] = [];
    }
    // Remove proposalSno from nested item
    const { proposalSno, ...cleanItem } = item;
    itemsGroupedByProposalSno[key].push(cleanItem);
  }

  // Merge into grouped result
  const finalGroupedData = purchaseProposals.map((proposal: any) => {
    const { sno, ...rest } = proposal;
    return {
      ...rest,
      items: itemsGroupedByProposalSno[sno] || [],
    };
  });

  return finalGroupedData;
};
