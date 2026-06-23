import { useState } from "react";
import { ScrollView, Text } from "react-native";
import { router } from "expo-router";
import { changeRequiredPassword } from "@/lib/auth-api";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import {
  Button,
  Card,
  ErrorText,
  FieldLabel,
  Input,
  Screen,
  Subtitle,
  Title,
} from "@/components/ui";

export default function ChangePasswordScreen() {
  const { refreshUser } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword === "1234") {
      setError("Choose a password other than the temporary default (1234).");
      return;
    }
    setLoading(true);
    try {
      await changeRequiredPassword(newPassword, confirmPassword);
      await refreshUser();
      router.replace("/(app)/(tabs)");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView>
      <Screen>
        <Title>Set your password</Title>
        <Subtitle>Your account was created by an administrator</Subtitle>

        <Card>
          <Text style={{ color: "#64748b", marginBottom: 12, lineHeight: 20 }}>
            For security, choose a new password before using gPawa. Your temporary password was{" "}
            <Text style={{ fontWeight: "700" }}>1234</Text>.
          </Text>
          <FieldLabel>New password</FieldLabel>
          <Input
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoComplete="new-password"
          />
          <FieldLabel>Confirm password</FieldLabel>
          <Input
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
          />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label="Save and continue" onPress={handleSubmit} loading={loading} />
        </Card>
      </Screen>
    </ScrollView>
  );
}
