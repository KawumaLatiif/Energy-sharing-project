import { useState } from "react";
import { Link, router } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import {
  Button,
  ErrorText,
  FieldLabel,
  Input,
  Screen,
  Subtitle,
  Title,
} from "@/components/ui";
import { ApiError } from "@/lib/api";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const result = await signIn(email.trim(), password);
      if (result.mustChangePassword) {
        router.replace("/change-password");
      } else {
        router.replace("/(app)/(tabs)");
      }
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Login failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <Screen>
          <Title>gPawa</Title>
          <Subtitle>Sign in to manage your energy account</Subtitle>
          <Text style={{ color: "#64748b", marginBottom: 12, lineHeight: 20 }}>
            Admin-created accounts: use temporary password 1234, then set a new password.
          </Text>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <FieldLabel>Email</FieldLabel>
          <Input
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@example.com"
          />
          <FieldLabel>Password</FieldLabel>
          <Input
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="Your password"
          />
          <Button label="Sign In" onPress={handleLogin} loading={loading} />
          <Text style={{ marginTop: 20, textAlign: "center", color: "#64748b" }}>
            New here?{" "}
            <Link href="/(auth)/register" style={{ color: "#0284c7", fontWeight: "600" }}>
              Create an account
            </Link>
          </Text>
        </Screen>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
