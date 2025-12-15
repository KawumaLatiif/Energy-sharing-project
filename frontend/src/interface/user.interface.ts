import { Profile } from "./user-profile.interface"

export type Country = {
    code: string,
    name: string
}


export type User = {
    id: number,
    first_name: string,
    last_name: string,
    email: string,
    phone_number: string,
    profile: Profile,
    wallet: Wallet,
    gender: "MALE" | "FEMALE" 
}

export type Wallet = {
    wallet_id: string,
    balance: string,
    currency: string,
    total_earnings: number
}


