import { User } from "@/interface/user.interface";
import { get } from "./fetch"

export const getUserConfig = async <T>() => {
    try{
        const response = await get("auth/get-user-config/");
        return response.data as T
    } catch(error){
        return null
    }
    
}

