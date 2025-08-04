import createHttpError from "http-errors";

export const handleAxiosError = (error: any) => {
  // Axios error with a response
  if (error.response) {
    const status = error.response.status || 500;
    const message =
      error.response?.data?.message ||
      error.response?.data?.error?.message ||
      error.response?.statusText ||
      "Internal Server Error";

    return createHttpError(status, message);
  }

  // Axios error with request sent but no response
  if (error.request) {
    return createHttpError(502, "No response received from upstream service");
  }

  // Other errors (e.g., in setup)
  return createHttpError(500, error.message || "Unexpected error occurred");
};
