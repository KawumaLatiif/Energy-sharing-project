import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { LoadingScreen } from "@/components/ui";

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Redirect href="/(app)/(tabs)" />;
  return <Redirect href="/(auth)/login" />;
}
