"use client";

import { useMemo, useState } from "react";

type HistoryItem = {
  requestText: string;
  responseText: string;
  kind: "CON" | "END" | "OTHER";
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
  const [pathParts, setPathParts] = useState<string[]>([]);
  const [nextReply, setNextReply] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const currentText = useMemo(() => pathParts.join("*"), [pathParts]);
  const lastItem = history[history.length - 1];
  const canContinue = !lastItem || lastItem.kind === "CON" || lastItem.kind === "OTHER";

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
    setNextReply("");
    setHistory([]);
    setError("");
  }

  function clearPath() {
    setPathParts([]);
    setNextReply("");
  }

  async function openMenu() {
    setPathParts([]);
    await send("");
  }

  async function submitReply() {
    if (!nextReply.trim()) return;
    const next = [...pathParts, nextReply.trim()];
    setPathParts(next);
    setNextReply("");
    await send(next.join("*"));
  }

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">USSD Web Simulator</h1>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Session ID</span>
          <input
            className="rounded border px-3 py-2"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Service Code</span>
          <input
            className="rounded border px-3 py-2"
            value={serviceCode}
            onChange={(e) => setServiceCode(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Phone Number</span>
          <input
            className="rounded border px-3 py-2"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="rounded bg-black px-4 py-2 text-white" onClick={openMenu} disabled={loading}>
          Open Menu
        </button>
        <button className="rounded border px-4 py-2" onClick={submitReply} disabled={loading || !canContinue}>
          Send Reply
        </button>
        <button className="rounded border px-4 py-2" onClick={clearPath} disabled={loading}>
          Clear Path
        </button>
        <button className="rounded border px-4 py-2" onClick={startNewSession} disabled={loading}>
          New Session
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded border p-3">
          <p className="text-sm font-medium">Current text path</p>
          <p className="mt-1 font-mono text-sm">{currentText || "(empty)"}</p>
        </div>
        <div className="rounded border p-3">
          <p className="text-sm font-medium">Next reply value</p>
          <input
            className="mt-1 w-full rounded border px-3 py-2 font-mono"
            placeholder='Example: 2 or 1 or 50000'
            value={nextReply}
            onChange={(e) => setNextReply(e.target.value)}
          />
        </div>
      </div>

      {error ? <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">{error}</div> : null}

      <div className="rounded border p-4">
        <p className="mb-3 text-sm font-medium">Conversation</p>
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">No requests yet. Click Open Menu.</p>
          ) : (
            history.map((item, idx) => (
              <div key={`${idx}-${item.requestText}`} className="rounded border p-3">
                <p className="text-xs text-gray-500">Request text: <span className="font-mono">{item.requestText || "(empty)"}</span></p>
                <pre className="mt-2 whitespace-pre-wrap text-sm">{item.responseText}</pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
