// works in both Node.js and React
import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';
dotenv.config();

const SECRET_KEY: any = process.env.CRYPTO_SECRET_KEY; // Use .env in production

export const encrypt = (data: any, isUrl: boolean = true): string => {
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  const encrypted = CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
  return isUrl ? encodeURIComponent(encrypted) : encrypted;
};

export const decrypt = (cipherText: string, isUrl: boolean = true): any => {
  const decodedText = isUrl ? decodeURIComponent(cipherText) : cipherText;
  const decrypted = CryptoJS.AES.decrypt(decodedText, SECRET_KEY).toString(CryptoJS.enc.Utf8);

  try {
    return JSON.parse(decrypted);
  } catch {
    return decrypted;
  }
};
