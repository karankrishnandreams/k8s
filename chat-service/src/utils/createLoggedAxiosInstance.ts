import axios, { AxiosHeaders, AxiosInstance, AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import logger from './logger';
import slowLogger from './slowLogger';
import jwt from 'jsonwebtoken';
import { Secret, SignOptions } from 'jsonwebtoken';
import { InternalTokenPayload, TokenConfig } from '../types/jwt';

const SLOW_THRESHOLD_MS = 1000;

interface CustomAxiosRequestConfig extends AxiosRequestConfig {
  metadata?: {
    startTime: Date;
  };
}

interface CreateServiceOptions {
  baseURL: string;
  serviceName: string;
  timeout?: number;
  jwtSecret?: Secret;
  jwtExpiresIn?: string;
  retries?: number;
}

export const createLoggedAxiosInstance = ({
  baseURL,
  serviceName,
  timeout = 5000,
  jwtSecret,
  jwtExpiresIn,
  retries = 5,
}: CreateServiceOptions): AxiosInstance => {
  const jwtInternalConfig: TokenConfig = {
    secret: jwtSecret || '',
    expiresIn: jwtExpiresIn,
  };

  const signOptions: SignOptions = {};
  if (jwtInternalConfig.expiresIn) {
    signOptions.expiresIn = jwtInternalConfig.expiresIn as jwt.SignOptions['expiresIn'];
  }

  // Ensure 'expiresIn' is not set to make the token never expire
  if (!jwtInternalConfig.expiresIn) {
    delete signOptions.expiresIn;
  }

  const instance = axios.create({
    baseURL,
    timeout,
    headers: new AxiosHeaders({ 'Content-Type': 'application/json' }),
  });

  axiosRetry(instance, {
    retries,
    retryDelay: retryCount => retryCount * 1000,
    retryCondition: (error: any) => error.code === 'ECONNABORTED' || error.response?.status >= 500,
  });

  instance.interceptors.request.use(
    config => {
      const typedConfig = config as CustomAxiosRequestConfig;
      typedConfig.metadata = { startTime: new Date() };

      if (jwtSecret) {
        const payload: InternalTokenPayload = {
          service: 'api-gateway',
          timestamp: Date.now(),
        };

        const token = jwt.sign(payload, jwtInternalConfig.secret as Secret, signOptions);

        const headers = new AxiosHeaders(config.headers || {});
        headers.set('Authorization', `Bearer ${token}`);

        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }

        config.headers = headers;
      }

      logger.info(`[${serviceName}] Request: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    },
    error => {
      logger.error(`[${serviceName}] Request error:`, error);
      return Promise.reject(error);
    },
  );

  instance.interceptors.response.use(
    response => {
      const config = response.config as CustomAxiosRequestConfig;
      const start = config.metadata?.startTime?.getTime() ?? Date.now();
      const duration = Date.now() - start;

      // Convert milliseconds to hours, minutes, seconds
      const hours = Math.floor(duration / (1000 * 60 * 60));
      const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((duration % (1000 * 60)) / 1000);

      if (duration > SLOW_THRESHOLD_MS) {
        slowLogger.warn(`[${serviceName}] Slow response`, {
          method: config.method,
          url: config.url,
          params: config.params,
          requestBody: config.data,
          duration,
          hours,
          minutes,
          seconds,
          startTime: new Date(start).toISOString(),
          endTime: new Date().toISOString(),
        });
      }

      logger.info(`[${serviceName}] Response received`, {
        method: config.method,
        url: config.url,
        duration,
        hours,
        minutes,
        seconds,
      });

      return response;
    },
    error => {
      const config = error.config as CustomAxiosRequestConfig;
      const start = config?.metadata?.startTime?.getTime() ?? Date.now();
      const duration = Date.now() - start;

      // Convert milliseconds to hours, minutes, seconds
      const hours = Math.floor(duration / (1000 * 60 * 60));
      const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((duration % (1000 * 60)) / 1000);

      if (duration > SLOW_THRESHOLD_MS) {
        slowLogger.warn(`[${serviceName}] Slow error`, {
          method: config?.method,
          url: config?.url,
          params: config?.params,
          requestBody: config?.data,
          duration,
          hours,
          minutes,
          seconds,
          startTime: new Date(start).toISOString(),
          endTime: new Date().toISOString(),
          status: error?.response?.status,
          message: error?.message,
        });
      }

      logger.error(`[${serviceName}] Response error:`, {
        status: error?.response?.status,
        message: error?.message,
        url: config?.url,
        duration,
        hours,
        minutes,
        seconds,
      });

      return Promise.reject(error);
    },
  );

  return instance;
};
