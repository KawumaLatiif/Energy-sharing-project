import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { LoadingScreen } from "@/components/ui";

export default function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Redirect href="/(auth)/login" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
