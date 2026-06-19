import { router } from "expo-router";
import { ScrollView, Text } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { API_URL } from "@/constants/config";
import {
  Button,
  Card,
  Screen,
  StatRow,
  Subtitle,
  Title,
} from "@/components/ui";

export default function AccountScreen() {
  const { user, signOut } = useAuth();

  async function handleLogout() {
    await signOut();
    router.replace("/(auth)/login");
  }

  return (
    <ScrollView>
      <Screen>
        <Title>My Account</Title>
        <Subtitle>Profile & settings</Subtitle>

        <Card>
          <StatRow label="Name" value={`${user?.first_name} ${user?.last_name}`} />
          <StatRow label="Email" value={user?.email ?? ""} />
          <StatRow label="Role" value={user?.user_role ?? ""} />
        </Card>

        <Card>
          <Text style={{ color: "#64748b", fontSize: 13, marginBottom: 8 }}>
            API endpoint
          </Text>
          <Text style={{ fontSize: 12, fontFamily: "SpaceMono" }}>{API_URL}</Text>
        </Card>

        <Button label="Sign Out" onPress={handleLogout} variant="secondary" />
      </Screen>
    </ScrollView>
  );
}
