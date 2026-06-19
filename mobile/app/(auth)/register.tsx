import { useState } from "react";
import { Link, router } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { register } from "@/lib/auth-api";
import { ApiError } from "@/lib/api";
import {
  Button,
  ErrorText,
  FieldLabel,
  Input,
  Screen,
  Subtitle,
  Title,
} from "@/components/ui";

export default function RegisterScreen() {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    password: "",
    confirm_password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleRegister() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await register({
        ...form,
        gender: "MALE",
        phone_number: form.phone_number.startsWith("+")
          ? form.phone_number
          : `+256${form.phone_number.replace(/^0/, "")}`,
      });
      setSuccess("Account created. Check your email to verify, then sign in.");
      setTimeout(() => router.replace("/(auth)/login"), 2500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <Screen>
          <Title>Create account</Title>
          <Subtitle>Join gPawa energy sharing</Subtitle>
          {error ? <ErrorText>{error}</ErrorText> : null}
          {success ? (
            <Text style={{ color: "#16a34a", marginBottom: 12 }}>{success}</Text>
          ) : null}
          <FieldLabel>First name</FieldLabel>
          <Input value={form.first_name} onChangeText={(v) => update("first_name", v)} />
          <FieldLabel>Last name</FieldLabel>
          <Input value={form.last_name} onChangeText={(v) => update("last_name", v)} />
          <FieldLabel>Email</FieldLabel>
          <Input
            value={form.email}
            onChangeText={(v) => update("email", v)}
            keyboardType="email-address"
          />
          <FieldLabel>Phone (MTN)</FieldLabel>
          <Input
            value={form.phone_number}
            onChangeText={(v) => update("phone_number", v)}
            keyboardType="phone-pad"
            placeholder="+2567XXXXXXXX"
          />
          <FieldLabel>Password</FieldLabel>
          <Input
            value={form.password}
            onChangeText={(v) => update("password", v)}
            secureTextEntry
          />
          <FieldLabel>Confirm password</FieldLabel>
          <Input
            value={form.confirm_password}
            onChangeText={(v) => update("confirm_password", v)}
            secureTextEntry
          />
          <Button label="Register" onPress={handleRegister} loading={loading} />
          <View style={{ marginTop: 20, alignItems: "center" }}>
            <Link href="/(auth)/login" style={{ color: "#0284c7", fontWeight: "600" }}>
              Already have an account? Sign in
            </Link>
          </View>
        </Screen>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
