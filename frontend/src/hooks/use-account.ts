import { getUser } from "@/actions/get-user";
import {isAuth} from "@/actions/is-auth"
import { User } from "@/interface/user.interface";
import { fetcher } from "@/lib/utils";
import { useEffect, useState } from "react";
import useSWR from 'swr'

export const useAccount = () => {
   
  const { data, error, isLoading } = useSWR<User>(`/mid-api/user-config/`, fetcher)
  
  return {user: data, loading: isLoading, error};
  };