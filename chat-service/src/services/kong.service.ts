import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
  AxiosHeaders,
} from "axios";

const KONG_BASE_URL = process.env.KONG_BASE_URL || "http://host.docker.internal:18000";


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
    // Create a new AxiosHeaders instance and preserve any existing headers manually
    const headers = new AxiosHeaders();

    // If user provided headers as an object, manually copy them in
    if (
      config.headers &&
      typeof config.headers === "object" &&
      !(config.headers instanceof AxiosHeaders)
    ) {
      for (const [key, value] of Object.entries(config.headers)) {
        if (value !== undefined) {
          headers.set(key, value as string);
        }
      }
    }

    // Add Authorization header if needed
    if (!config.skipAuth && config.token) {
      headers.set("Authorization", `${config.token}`);
    }

    config.headers = headers;

    // Return properly typed config
    return config as InternalAxiosRequestConfig;
  },
  (error) => Promise.reject(error)
);

export default kongAxios;
