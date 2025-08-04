/* Email Service */
import { createLoggedAxiosInstance } from "../utils/createLoggedAxiosInstance";

const emailService = createLoggedAxiosInstance({
  baseURL: `${process.env.CLONE_SERVICE_URL}/api/emails`,
  serviceName: `${process.env.CLONESERVICE_NAME}`,
  timeout: parseInt(process.env.SERVICE_TIMEOUT || "5000"),
  jwtSecret: process.env.INTERNAL_JWT_SECRET || "",
  // jwtExpiresIn: process.env.INTERNAL_JWT_EXPIRES_IN || '5m',
});

export const callEmailService = async (
  method: "get" | "post" | "put" | "delete" | "patch",
  path: string,
  data?: any,
  headers: Record<string, string> = {},
  params?: any,
  isMultipart: boolean = false
) => {
  try {
    const config = {
      headers: {
        ...headers,
        ...(isMultipart ? { "Content-Type": "multipart/form-data" } : {}),
      },
      params: params || undefined,
    };

    let response;
    switch (method) {
      case "get":
        response = await emailService.get(path, config);
        break;
      case "delete":
        response = await emailService.delete(path, {
          ...config,
          data: data ?? {},
        });
        break;
      case "post":
      case "put":
      case "patch":
        response = await emailService[method](path, data ?? {}, config);
        break;
      default:
        throw new Error("Unsupported HTTP method");
    }

    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw {
        status: error.response.status,
        data: {
          error:
            typeof error?.response?.data?.error === "string" &&
            error.response.data.error.trim().length > 0
              ? error.response.data.error
              : error.response.data?.error?.message || "Service error",
        },
      };
    } else if (error.request) {
      throw {
        status: 503,
        data: { error: `${process.env.EMAILSERVICE_NAME} unavailable` },
      };
    } else {
      throw {
        status: 500,
        data: { error: "Internal server error" },
      };
    }
  }
};
