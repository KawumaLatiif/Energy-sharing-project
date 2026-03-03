export interface ApiError {
  message?: string;
  [key: string]: unknown;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string | ApiError;
  status: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const formatErrorMessage = (message: string): string => {
  if (!message) {
    return message;
  }

  return message.charAt(0).toUpperCase() + message.slice(1);
};

const getFirstFieldError = (value: Record<string, unknown>): string | undefined => {
  for (const fieldValue of Object.values(value)) {
    if (Array.isArray(fieldValue) && typeof fieldValue[0] === "string") {
      return fieldValue[0];
    }

    if (typeof fieldValue === "string") {
      return fieldValue;
    }
  }

  return undefined;
};

export const getApiErrorMessage = (
  error: string | ApiError | undefined,
  fallback = "Unknown error occurred"
): string => {
  if (typeof error === "string") {
    return formatErrorMessage(error);
  }

  if (!error) {
    return fallback;
  }

  if (typeof error.message === "string" && error.message.trim().length > 0) {
    return formatErrorMessage(error.message);
  }

  const detail = error.detail;
  if (typeof detail === "string" && detail.trim().length > 0) {
    return formatErrorMessage(detail);
  }

  const nestedError = error.error;
  if (typeof nestedError === "string" && nestedError.trim().length > 0) {
    return formatErrorMessage(nestedError);
  }

  if (isRecord(error)) {
    const firstFieldError = getFirstFieldError(error);
    if (firstFieldError) {
      return formatErrorMessage(firstFieldError);
    }
  }

  return fallback;
};

export const toApiError = (
  value: unknown,
  fallback = "Unknown error occurred"
): string | ApiError => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (isRecord(value)) {
    const message =
      (typeof value.message === "string" && value.message) ||
      (typeof value.detail === "string" && value.detail) ||
      (typeof value.error === "string" && value.error) ||
      getFirstFieldError(value);

    if (message) {
      return { ...value, message };
    }

    return value as ApiError;
  }

  return fallback;
};
