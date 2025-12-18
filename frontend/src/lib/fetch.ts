"use server"
import { API_URL } from "@/common/constants/api";
import { getErrorMessage } from "./errors";
import { cookies } from "next/headers";
import { AUTHENTICATION_COOKIE } from "@/common/constants/auth-cookie";
import authenticated from "./authenticated";

const getHeaders = async () => {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get(AUTHENTICATION_COOKIE);
    
    console.log('Auth cookie value:', authCookie?.value);
    console.log('All cookies:', cookieStore.getAll().map(c => c.name));

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (authCookie?.value) {
        headers['Authorization'] = `Bearer ${authCookie.value}`;
    }

    return headers;
};

export const post = async <T>(path: string, data: any) => {
    // console.log("hitting ...", `${API_URL}/${path}`)
    const res = await fetch(`${API_URL}/${path}`, {
        method: "POST",
        headers: {"Content-Type": "application/json", ...(await getHeaders()) },
        body: JSON.stringify(data)
    })

    const parsedRes = await res.json();
    console.log("request response: ", parsedRes, "status code: ", res.status)
    if(res.status === 400){
        return {error: parsedRes, data: null,  status: res.status}
    }
    if(!res.ok){
        return {error: parsedRes, data: null, status: res.status}
    }
    return { error: "", data: parsedRes as T, status: res.status }

}


export const get = async <T>(path: string) => {
    try {
        const headers = await getHeaders();
        console.log('Request headers:', headers);
        console.log('Request URL:', `${API_URL}/${path}`);

        const res = await fetch(`${API_URL}/${path}`, {
            headers: headers,
            credentials: 'include',
            cache: 'no-store'
        });

        console.log('Response status:', res.status);
        console.log('Response headers:', Object.fromEntries(res.headers.entries()));

        // Check if response is JSON
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const parsedRes = await res.json() as T;
            console.log('Response data:', parsedRes);
            
            if(res.status === 400){
                return {error: parsedRes}
            }
            if(!res.ok){
                return {error: parsedRes, data: null, status: res.status}
            }
           
            return {error: null, data: parsedRes as T, status: res.status};
        } else {
            // Handle non-JSON responses
            const textResponse = await res.text();
            console.error('Non-JSON response:', textResponse.substring(0, 200));
            
            if(!res.ok){
                return {error: {message: `Server returned status ${res.status}`}, data: null, status: res.status}
            }
            
            return {error: null, data: null, status: res.status};
        }
    } catch (error) {
        console.error('Fetch error:', error);
        return {error: {message: 'Network error occurred'}, data: null, status: 0};
    }
}

export const patch = async (path: string, data: any) => {
    // console.log("hitting ...", `${API_URL}/${path}`)
    const res = await fetch(`${API_URL}/${path}`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json", ...(await getHeaders()) },
        body: JSON.stringify(data)
    })

    const parsedRes = await res.json();
    console.log("request response: ", parsedRes, "status code: ", res.status)
    if(res.status === 400){
        return {error: parsedRes}
    }
    if(!res.ok){
        return {error: getErrorMessage(parsedRes)}
    }
    return { error: "" }

}