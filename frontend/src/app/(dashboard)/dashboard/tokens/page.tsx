export const dynamic = "force-dynamic";

import { Suspense } from "react";
import TokenList from "./_components/tokenslist";
import GenerateTokenCard from "./_components/generate-token-card";
import DesktopSidebar from "../_components/desktop-sidebar";
import RightHeader from "../_components/right-header";
import { get } from "@/lib/fetch";
import { Token } from "@/interface/token.interface";

async function getTokens(): Promise<Token[]> {
  try {
    const response = await get<any>("meter/token/");
    if (response.error) return [];
    return Array.isArray(response.data?.data)
      ? response.data.data
      : response.data?.results ?? [];
  } catch {
    return [];
  }
}

async function getMeterInfo(): Promise<{ architecture: "STS" | "AMI"; hasMeter: boolean }> {
  try {
    const res = await get<any>("meter/my-meter/");
    if (!res.error && res.data?.success && res.data?.data?.has_meter) {
      return {
        architecture: (res.data.data.architecture as "STS" | "AMI") || "STS",
        hasMeter: true,
      };
    }
  } catch {}
  return { architecture: "STS", hasMeter: false };
}

async function getWalletBalance(): Promise<number> {
  try {
    const res = await get<any>("wallet/balance");
    if (!res.error && res.data?.success) {
      // wallet.balance is the kWh unit wallet balance
      return parseFloat(res.data?.wallet?.balance ?? res.data?.wallet_balance ?? "0") || 0;
    }
  } catch {}
  return 0;
}

const TokensPage = async () => {
  const [tokens, { architecture, hasMeter }, walletBalance] = await Promise.all([
    getTokens(),
    getMeterInfo(),
    getWalletBalance(),
  ]);

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <DesktopSidebar />
      <div className="flex min-w-0 flex-col overflow-x-hidden">
        <RightHeader />
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <div>
            <h1 className="text-lg font-semibold md:text-2xl">Tokens</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Generate and manage STS meter tokens
            </p>
          </div>

          {hasMeter && (
            <GenerateTokenCard
              architecture={architecture}
              walletBalance={walletBalance}
            />
          )}

          {!hasMeter && (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              Register a meter first to generate tokens.
            </div>
          )}

          <div className="flex min-w-0 flex-1 justify-center rounded-lg border border-dashed shadow-sm">
            <div className="flex min-w-0 flex-col gap-1 w-full">
              <Suspense fallback={<div className="p-4">Loading tokens...</div>}>
                <TokenList tokens={tokens} />
              </Suspense>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TokensPage;
