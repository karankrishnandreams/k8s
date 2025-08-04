import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import axios from "axios";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const configFilePath: any = path.join(
    __dirname,
    "..",
    "..",
    "config",
    "default.json"
);

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
            "image/gif", // .gif
            "image/webp", // .webp
            "image/svg+xml", // .svg
            "image/bmp", // .bmp
            "image/tiff", // .tiff, .tif
            "image/x-icon", // .ico
            "image/vnd.microsoft.icon", // .ico
        ];
        const documentMimeTypes = [
            "application/pdf", // .pdf
            "application/msword", // .doc
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
            "application/vnd.ms-excel", // .xls
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
            "application/vnd.ms-powerpoint", // .ppt
            "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
            "text/plain", // .txt
            "text/csv", // .csv
            "application/rtf", // .rtf
            "application/vnd.oasis.opendocument.text", // .odt
            "application/vnd.oasis.opendocument.spreadsheet", // .ods
            "application/vnd.oasis.opendocument.presentation", // .odp
        ];
        const archiveMimeTypes = [
            "application/zip", // .zip
            "application/x-rar-compressed", // .rar
            "application/x-tar", // .tar
            "application/x-7z-compressed", // .7z
            "application/gzip", // .gz
            "application/x-bzip2", // .bz2
        ];
        const audioMimeTypes = [
            "audio/mpeg", // .mp3
            "audio/wav", // .wav
            "audio/x-wav", // .wav
            "audio/aac", // .aac
            "audio/ogg", // .ogg
            "audio/webm", // .weba
            "audio/x-m4a", // .m4a
        ];
        const videoMimeTypes = [
            "video/mp4", // .mp4
            "video/x-matroska", // .mkv
            "video/webm", // .webm
            "video/quicktime", // .mov
            "video/x-msvideo", // .avi
            "video/x-ms-wmv", // .wmv
            "video/mpeg", // .mpeg
        ];
        const allowedMimeTypes = [
            ...imageMimeTypes,
            ...documentMimeTypes,
            ...archiveMimeTypes,
            ...audioMimeTypes,
            ...videoMimeTypes,
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