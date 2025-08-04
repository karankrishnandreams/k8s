import axios, {
    AxiosInstance,
    AxiosRequestConfig,
    InternalAxiosRequestConfig,
    AxiosHeaders,
  } from 'axios';
  
  const KONG_BASE_URL = process.env.KONG_BASE_URL;
  
  const kongAxios: AxiosInstance = axios.create({
    baseURL: KONG_BASE_URL,
    timeout: 10000,
  });
  
  // Custom config (extends public type, which is more flexible)
  export interface CustomAxiosRequestConfig extends AxiosRequestConfig {
    token?: string;
    skipAuth?: boolean;
  }
  
  kongAxios.interceptors.request.use(
    (config: CustomAxiosRequestConfig): InternalAxiosRequestConfig => {
      // Create a new config object to avoid mutating the original
      const newConfig: InternalAxiosRequestConfig = {
        ...config,
        headers: new AxiosHeaders(),
      };
  
      // Copy existing headers if they exist
      if (config.headers) {
        if (config.headers instanceof AxiosHeaders) {
          newConfig.headers = config.headers;
        } else {
          for (const [key, value] of Object.entries(config.headers)) {
            if (value !== undefined) {
              newConfig.headers.set(key, value as string);
            }
          }
        }
      }
  
      // Add Authorization header if needed
      if (!config.skipAuth && config.token) {
        newConfig.headers.set('Authorization', `${config.token}`);
      }
      
      return newConfig;
    },
    (error) => Promise.reject(error)
  );
  
  export default kongAxios;
  