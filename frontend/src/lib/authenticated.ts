import { AUTHENTICATION_COOKIE } from "@/common/constants/auth-cookie";
import { cookies } from "next/headers";

export default async function authenticated() {
    const cookieStore = cookies(); // Resolve the Promise
    const authCookie = (await cookieStore).get(AUTHENTICATION_COOKIE); // Access `get` method
    return !!authCookie?.value; // Safely return the boolean value
}


