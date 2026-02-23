import { getUser } from "@/actions/get-user";
import { User } from "@/interface/user.interface";
import { useEffect, useState } from "react";

export const useAccount = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const result = await getUser();
        if (mounted) {
          setUser(result);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  return { user, loading, error };
};
