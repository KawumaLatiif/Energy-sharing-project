import { useCallback, useState } from "react";
import {
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { generateToken, getTokens } from "@/lib/meter-api";
import { ApiError } from "@/lib/api";
import {
  Button,
  Card,
  ErrorText,
  FieldLabel,
  Input,
  LoadingScreen,
  Screen,
  Subtitle,
  Title,
} from "@/components/ui";
import type { MeterToken } from "@/types/api";

export default function TokensScreen() {
  const [tokens, setTokens] = useState<MeterToken[]>([]);
  const [units, setUnits] = useState("1");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [newToken, setNewToken] = useState("");

  const load = useCallback(async () => {
    try {
      const list = await getTokens();
      setTokens(list.filter((t) => !t.is_used));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  async function handleGenerate() {
    setError("");
    setNewToken("");
    const n = parseFloat(units);
    if (!n || n <= 0) {
      setError("Enter a valid kWh amount.");
      return;
    }
    setGenerating(true);
    try {
      const res = await generateToken(n);
      setNewToken(res.token);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not generate token.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <LoadingScreen />;

  return (
    <Screen style={{ paddingBottom: 0 }}>
      <Title>STS Tokens</Title>
      <Subtitle>Generate a token and enter it on your meter keypad</Subtitle>
      {error ? <ErrorText>{error}</ErrorText> : null}

      <Card>
        <FieldLabel>Units from wallet (kWh)</FieldLabel>
        <Input value={units} onChangeText={setUnits} keyboardType="decimal-pad" />
        <Button label="Generate Token" onPress={handleGenerate} loading={generating} />
        {newToken ? (
          <View style={{ marginTop: 16, padding: 12, backgroundColor: "#f0f9ff", borderRadius: 8 }}>
            <Text style={{ fontWeight: "600", marginBottom: 4 }}>Your token</Text>
            <Text style={{ fontSize: 18, letterSpacing: 1, fontFamily: "SpaceMono" }}>
              {newToken}
            </Text>
          </View>
        ) : null}
      </Card>

      <Text style={{ fontWeight: "600", marginBottom: 8 }}>Unused tokens</Text>
      <FlatList
        data={tokens}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          <Text style={{ color: "#64748b" }}>No unused tokens.</Text>
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={{ fontFamily: "SpaceMono", fontSize: 16 }}>{item.token}</Text>
            <Text style={{ color: "#64748b", marginTop: 4 }}>
              {item.units} kWh
            </Text>
          </Card>
        )}
      />
    </Screen>
  );
}
