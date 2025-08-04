// import axios from 'axios';
// import logger from '../utils/logger';
// import jwt, { Secret, SignOptions } from 'jsonwebtoken';
// import { InternalTokenPayload, TokenConfig } from '../types/jwt';
// import axiosRetry from 'axios-retry';

// // Internal Configuration
// const jwtInternalConfig: TokenConfig = {
//   secret: (process.env.INTERNAL_JWT_SECRET as Secret) || '',
//   // expiresIn: process.env.INTERNAL_JWT_EXPIRES_IN || '5m',
// };

// const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'http://localhost:4003';

// const generateInternalToken = (): string => {
//   const secret = jwtInternalConfig.secret;
//   if (!secret) {
//     throw new Error('INTERNAL_JWT_SECRET is not set');
//   }

//   const options: SignOptions = {};
//   if (jwtInternalConfig.expiresIn) {
//     //@ts-ignore
//     options.expiresIn = jwtInternalConfig.expiresIn;
//   }

//   const payload: InternalTokenPayload = {
//     service: 'api-gateway',
//     timestamp: Date.now(),
//   };

//   return jwt.sign(payload, secret as Secret, options);
// };

// const emailService = axios.create({
//   baseURL: `${EMAIL_SERVICE_URL}/api/emails`,
//   timeout: parseInt(process.env.EMAIL_SERVICE_TIMEOUT || '5000'),
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// axiosRetry(emailService, {
//   retries: 3,
//   retryDelay: retryCount => retryCount * 2000, // 1s, 2s
//   retryCondition: (error: any) =>
//     error.code === 'ECONNABORTED' || // Timeout
//     error.response?.status >= 500, // Server errors
// });

// // Request interceptor
// emailService.interceptors.request.use(
//   config => {
//     logger.info(
//       `Calling ${process.env.EMAILSERVICE_NAME}: ${config.method?.toUpperCase()} ${config.url}`,
//     );
//     return config;
//   },
//   error => {
//     logger.error(`${process.env.EMAILSERVICE_NAME} request error:`, error);
//     return Promise.reject(error);
//   },
// );

// // Response interceptor
// emailService.interceptors.response.use(
//   response => response,
//   error => {
//     const isTimeout = error.code === 'ECONNABORTED';

//     logger.error(`${process.env.EMAILSERVICE_NAME} response error:`, {
//       isTimeout,
//       timeout: emailService.defaults.timeout,
//       status: error.response?.status,
//       message: error.message,
//       url: error.config?.url,
//     });

//     return Promise.reject(error);
//   },
// );

// export const callEmailService = async (
//   method: 'get' | 'post' | 'put' | 'delete' | 'patch',
//   path: string,
//   data?: any,
//   headers: Record<string, string> = {},
//   params?: any,
//   isMultipart: boolean = false,
// ) => {
//   try {
//     const internalToken = generateInternalToken();

//     const config = {
//       headers: {
//         ...headers,
//         Authorization: `Bearer ${internalToken}`,
//         ...(isMultipart ? { 'Content-Type': 'multipart/form-data' } : {}),
//       },
//       params: params || undefined, // Use params if provided, otherwise undefined
//     };

//     let response;
//     switch (method) {
//       case 'get':
//         // GET only uses params (data is ignored as per REST conventions)
//         response = await emailService.get(path, config);
//         break;
//       case 'delete':
//         // DELETE can use both params and optionally data (body)
//         response = await emailService.delete(path, {
//           ...config,
//           data: data, // Some servers expect DELETE with body
//         });
//         break;
//       case 'post':
//       case 'put':
//       case 'patch':
//         // POST/PUT/PATCH use data as body and optionally params
//         response = await emailService[method](path, data, config);
//         break;
//       default:
//         throw new Error('Unsupported HTTP method');
//     }

//     return response.data;
//   } catch (error: any) {
//     if (error.response) {
//       // throw {
//       //   status: error.response.status,
//       //   data: error.response.data,
//       // };
//       throw {
//         status: error.response.status,
//         data: {
//           error:
//             typeof error?.response?.data?.error === 'string' &&
//             error.response.data.error.trim().length > 0
//               ? error.response.data.error
//               : error.response.data?.error?.message || 'Service error',
//         },
//       };
//     } else if (error.request) {
//       throw {
//         status: 503,
//         data: { error: `${process.env.EMAILSERVICE_NAME} unavailable` },
//       };
//     } else {
//       throw {
//         status: 500,
//         data: { error: 'Internal server error' },
//       };
//     }
//   }
// };

/* Email Service */
import { createLoggedAxiosInstance } from '../utils/createLoggedAxiosInstance';

const emailService = createLoggedAxiosInstance({
  baseURL: `${process.env.EMAIL_SERVICE_URL}/api/emails`,
  serviceName: `${process.env.EMAILSERVICE_NAME}`,
  timeout: parseInt(process.env.EMAIL_SERVICE_TIMEOUT || '5000'),
  jwtSecret: process.env.INTERNAL_JWT_SECRET || '',
  // jwtExpiresIn: process.env.INTERNAL_JWT_EXPIRES_IN || '5m',
});

export const callEmailService = async (
  method: 'get' | 'post' | 'put' | 'delete' | 'patch',
  path: string,
  data?: any,
  headers: Record<string, string> = {},
  params?: any,
  isMultipart: boolean = false,
) => {
  try {
    const config = {
      headers: {
        ...headers,
        ...(isMultipart ? { 'Content-Type': 'multipart/form-data' } : {}),
      },
      params: params || undefined,
    };

    let response;
    switch (method) {
      case 'get':
        response = await emailService.get(path, config);
        break;
      case 'delete':
        response = await emailService.delete(path, {
          ...config,
          data: data ?? {},
        });
        break;
      case 'post':
      case 'put':
      case 'patch':
        response = await emailService[method](path, data ?? {}, config);
        break;
      default:
        throw new Error('Unsupported HTTP method');
    }

    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw {
        status: error.response.status,
        data: {
          error:
            typeof error?.response?.data?.error === 'string' &&
            error.response.data.error.trim().length > 0
              ? error.response.data.error
              : error.response.data?.error?.message || 'Service error',
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
        data: { error: 'Internal server error' },
      };
    }
  }
};
