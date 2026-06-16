"use client";

import { useEffect, useMemo, useState } from "react";

type HistoryItem = {
  requestText: string;
  responseText: string;
  kind: "CON" | "END" | "OTHER";
};

type PhoneOption = {
  phone_number: string;
  email: string;
};

type MeterOption = {
  meter_no: string;
  email: string;
};

function createSessionId() {
  return `WEB-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function getKind(message: string): "CON" | "END" | "OTHER" {
  const text = message.trim();
  if (text.startsWith("CON ")) return "CON";
  if (text.startsWith("END ")) return "END";
  return "OTHER";
}

export default function UssdSimulatorPage() {
  const [sessionId, setSessionId] = useState(createSessionId());
  const [serviceCode, setServiceCode] = useState("*123#");
  const [phoneNumber, setPhoneNumber] = useState("+256701234567");
  const [phoneOptions, setPhoneOptions] = useState<PhoneOption[]>([]);
  const [meterOptions, setMeterOptions] = useState<MeterOption[]>([]);
  const [pathParts, setPathParts] = useState<string[]>([]);
  const [nextReply, setNextReply] = useState("1");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [loadingPhones, setLoadingPhones] = useState(true);

  const currentText = useMemo(() => pathParts.join("*"), [pathParts]);
  const lastItem = history[history.length - 1];
  const canContinue = !lastItem || lastItem.kind === "CON" || lastItem.kind === "OTHER";
  const currentPrompt = lastItem?.responseText ?? "Dial to start";
  const expectsMeterNumberInput = useMemo(() => {
    const prompt = currentPrompt.toLowerCase();
    return prompt.includes("receiver meter number") || prompt.includes("enter meter number");
  }, [currentPrompt]);

  useEffect(() => {
    async function loadPhones() {
      try {
        const res = await fetch("/api/ussd/phones", { cache: "no-store" });
        const data = await res.json();
        const options: PhoneOption[] = data?.results ?? [];
        setPhoneOptions(options);
        if (options.length > 0) {
          setPhoneNumber((prev) => prev || options[0].phone_number);
        }
      } catch {
        setPhoneOptions([]);
      } finally {
        setLoadingPhones(false);
      }
    }
    loadPhones();
  }, []);

  useEffect(() => {
    async function loadMeters() {
      if (!phoneNumber) {
        setMeterOptions([]);
        return;
      }

      try {
        const res = await fetch(`/api/ussd/meters?phoneNumber=${encodeURIComponent(phoneNumber)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        const options: MeterOption[] = data?.results ?? [];
        setMeterOptions(options);
      } catch {
        setMeterOptions([]);
      }
    }

    void loadMeters();
  }, [phoneNumber]);

  useEffect(() => {
    if (!expectsMeterNumberInput) return;
    if (meterOptions.length === 0) return;

    const exists = meterOptions.some((m) => m.meter_no === nextReply);
    if (!exists) {
      setNextReply(meterOptions[0].meter_no);
    }
  }, [expectsMeterNumberInput, meterOptions, nextReply]);

  async function send(textValue: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ussd/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          serviceCode,
          phoneNumber,
          text: textValue,
        }),
      });
      const data = await res.json();
      const responseText: string = data?.response || data?.error || "No response";
      setHistory((prev) => [
        ...prev,
        {
          requestText: textValue,
          responseText,
          kind: getKind(responseText),
        },
      ]);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function startNewSession() {
    setSessionId(createSessionId());
    setPathParts([]);
    setNextReply("1");
    setHistory([]);
    setError("");
  }

  function clearPath() {
    setPathParts([]);
    setNextReply("1");
  }

  async function openMenu() {
    setPathParts([]);
    await send("");
  }

  async function submitReply() {
    if (!nextReply.trim()) return;
    const next = [...pathParts, nextReply.trim()];
    setPathParts(next);
    setNextReply("1");
    await send(next.join("*"));
  }

  return (
    <div className="mx-auto max-w-6xl p-3 sm:p-6">
      <h1 className="mb-4 text-xl font-bold sm:mb-6 sm:text-2xl">USSD Simulator</h1>
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="rounded-3xl bg-neutral-900 p-4 shadow-2xl">
          <div className="rounded-2xl bg-[#111827] p-3 sm:p-4">
            <p className="mb-3 text-xs text-neutral-400">Africa&apos;s Talking style session</p>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs text-neutral-300">Phone Number</span>
              <select
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={loading || loadingPhones}
              >
                {loadingPhones ? <option>Loading phone numbers...</option> : null}
                {!loadingPhones && phoneOptions.length === 0 ? (
                  <option value={phoneNumber}>{phoneNumber || "No numbers found"}</option>
                ) : null}
                {phoneOptions.map((opt) => (
                  <option key={opt.phone_number} value={opt.phone_number}>
                    {opt.phone_number} ({opt.email})
                  </option>
                ))}
              </select>
            </label>

            <label className="mb-3 block">
              <span className="mb-1 block text-xs text-neutral-300">Dial Code</span>
              <input
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
                value={serviceCode}
                onChange={(e) => setServiceCode(e.target.value)}
              />
            </label>

            <div className="mb-3 rounded-md border border-neutral-700 bg-neutral-950 p-3">
              <p className="mb-1 text-xs text-neutral-400">USSD Screen</p>
              <pre className="max-h-64 whitespace-pre-wrap break-words text-sm text-neutral-100">
                {currentPrompt}
              </pre>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs text-neutral-300">Reply</span>
              {expectsMeterNumberInput ? (
                <select
                  className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
                  value={nextReply}
                  onChange={(e) => setNextReply(e.target.value)}
                  disabled={loading || !canContinue || meterOptions.length === 0}
                >
                  {meterOptions.length === 0 ? <option value="">No receiver meters available</option> : null}
                  {meterOptions.map((opt) => (
                    <option key={opt.meter_no} value={opt.meter_no}>
                      {opt.meter_no} ({opt.email})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
                  placeholder="Enter option (e.g 1)"
                  value={nextReply}
                  onChange={(e) => setNextReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitReply();
                  }}
                  disabled={loading || !canContinue}
                />
              )}
            </label>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                className="rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
                onClick={openMenu}
                disabled={loading}
              >
                Dial
              </button>
              <button
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
                onClick={submitReply}
                disabled={loading || !canContinue}
              >
                Send
              </button>
              <button
                className="rounded-md border border-neutral-600 px-3 py-2 text-sm text-white"
                onClick={clearPath}
                disabled={loading}
              >
                Clear
              </button>
              <button
                className="rounded-md border border-neutral-600 px-3 py-2 text-sm text-white"
                onClick={startNewSession}
                disabled={loading}
              >
                New Session
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded border bg-white p-4">
            <p className="text-sm font-medium">Session Details</p>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div className="rounded border p-3">
                <p className="text-xs text-gray-500">Session ID</p>
                <input
                  className="mt-1 w-full rounded border px-2 py-1 text-sm font-mono"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                />
              </div>
              <div className="rounded border p-3">
                <p className="text-xs text-gray-500">Current text path</p>
                <p className="mt-1 font-mono text-sm">{currentText || "(empty)"}</p>
              </div>
            </div>
          </div>

          {error ? <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">{error}</div> : null}

          <div className="rounded border bg-white p-4">
            <p className="mb-3 text-sm font-medium">Conversation Log</p>
            <div className="space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-gray-500">No requests yet. Press Dial to start.</p>
              ) : (
                history.map((item, idx) => (
                  <div key={`${idx}-${item.requestText}`} className="rounded border p-3">
                    <p className="text-xs text-gray-500">
                      Request text: <span className="font-mono">{item.requestText || "(empty)"}</span>
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-sm">{item.responseText}</pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
