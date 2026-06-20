import { useEffect } from "react";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { LoadingScreen } from "@/components/ui";

export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace("/(app)/(tabs)/");
    } else {
      router.replace("/(auth)/login");
    }
  }, [user, loading]);

  return <LoadingScreen message="Starting gPawa…" />;
}
