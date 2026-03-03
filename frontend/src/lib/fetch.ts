"use server"
import { API_URL } from "@/common/constants/api";
import { cookies } from "next/headers";
import { AUTHENTICATION_COOKIE } from "@/common/constants/auth-cookie";
import { ApiResponse, toApiError } from "./api-response";

const getHeaders = async () => {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get(AUTHENTICATION_COOKIE);

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (authCookie?.value) {
        headers['Authorization'] = `Bearer ${authCookie.value}`;
    }

    return headers;
};

const parseResponseBody = async (res: Response): Promise<unknown> => {
    const contentType = res.headers.get("content-type");

    if (contentType?.includes("application/json")) {
        try {
            return await res.json();
        } catch {
            return undefined;
        }
    }

    const text = await res.text();
    if (!text) {
        return undefined;
    }

    return { message: text };
};

const buildErrorResponse = (body: unknown, status: number): ApiResponse<never> => ({
    error: toApiError(body, `Request failed with status ${status}`),
    status
});

const buildSuccessResponse = <T>(body: unknown, status: number): ApiResponse<T> => ({
    data: body as T,
    status
});

const buildRequestOptions = async (
    method?: "POST" | "PATCH" | "PUT" | "DELETE",
    body?: unknown
): Promise<RequestInit> => {
    const headers = await getHeaders();

    if (!method) {
        return {
            headers,
            credentials: "include",
            cache: "no-store",
        };
    }

    return {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    };
};

const request = async <T>(
    path: string,
    options: RequestInit
): Promise<ApiResponse<T>> => {
    try {
        const res = await fetch(`${API_URL}/${path}`, options);
        const parsedBody = await parseResponseBody(res);

        if (!res.ok) {
            return buildErrorResponse(parsedBody, res.status);
        }

        return buildSuccessResponse<T>(parsedBody, res.status);
    } catch {
        return {
            error: { message: "Network error occurred" },
            status: 0,
        };
    }
};

export const get = async <T>(path: string): Promise<ApiResponse<T>> => {
    const options = await buildRequestOptions();
    return request<T>(path, options);
};

export const post = async <T, B = unknown>(path: string, data: B): Promise<ApiResponse<T>> => {
    const options = await buildRequestOptions("POST", data);
    return request<T>(path, options);
};

export const patch = async <T = unknown, B = unknown>(path: string, data: B): Promise<ApiResponse<T>> => {
    const options = await buildRequestOptions("PATCH", data);
    return request<T>(path, options);
};

export const put = async <T, B = unknown>(path: string, data: B): Promise<ApiResponse<T>> => {
    const options = await buildRequestOptions("PUT", data);
    return request<T>(path, options);
};

export const del = async <T = unknown>(path: string): Promise<ApiResponse<T>> => {
    const options = await buildRequestOptions("DELETE");
    return request<T>(path, options);
};
