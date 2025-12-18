// // import { User } from "@/interface/user.interface";
// // import { get } from "./fetch"

import { authFetch } from "./auth";

// import { authFetch } from "./auth";

// // export const getUserConfig = async <T>() => {
// //     try{
// //         const response = await get("auth/get-user-config/");
// //         return response.data as T
// //     } catch(error){
// //         return null
// //     }
    
// // }


const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api/v1';

// export const getUserConfig = async <T>(): Promise<T | null> => {
//   try {
//     const response = await authFetch(`${API_BASE}/auth/get-user-config/`);
    
//     if (!response.ok) {
//       console.error('Failed to fetch user config:', response.status);
//       return null;
//     }

//     const data = await response.json();
//     return data as T;
//   } catch (error) {
//     console.error('Error fetching user config:', error);
//     return null;
//   }
// };

export const getUserConfig = async <T>(): Promise<T | null> => {
  try {
    const response = await authFetch(`${API_BASE}/auth/get-user-config/`);
    
    if (!response.ok) {
      console.error('Failed to fetch user config:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('🔄 User Config Received:', {
      id: data.id,
      email: data.email,
      is_admin: data.is_admin,
      user_role: data.user_role
    });
    
    return data as T;
  } catch (error) {
    console.error('Error fetching user config:', error);
    return null;
  }
};