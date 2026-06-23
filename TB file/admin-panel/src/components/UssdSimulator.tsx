import { useCallback, useEffect, useState } from "react";

const SERVICE_CODE = "*384*33921#";

type SessionState = "idle" | "active" | "ended";

function newSessionId() {
  return `sim-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseUssd(raw: string): { continue: boolean; message: string } {
  const text = raw.trim();
  if (text.startsWith("CON")) return { continue: true, message: text.slice(3).replace(/^\s+/, "") };
  if (text.startsWith("END")) return { continue: false, message: text.slice(3).replace(/^\s+/, "") };
  return { continue: false, message: text };
}

const KEYPAD: { key: string; sub?: string }[][] = [
  [{ key: "1" }, { key: "2", sub: "ABC" }, { key: "3", sub: "DEF" }],
  [{ key: "4", sub: "GHI" }, { key: "5", sub: "JKL" }, { key: "6", sub: "MNO" }],
  [{ key: "7", sub: "PQRS" }, { key: "8", sub: "TUV" }, { key: "9", sub: "WXYZ" }],
  [{ key: "*" }, { key: "0", sub: "+" }, { key: "#" }],
];

function UssdMessageDisplay({ message }: { message: string }) {
  const lines = message.split("\n");
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        if (!line.trim() && i > 0) return <div key={i} className="h-1" />;
        if (i === 0 && line.includes("Energy Wallet"))
          return <p key={i} className="font-bold text-base text-gray-900">{line}</p>;
        if (line === "MAIN MENU")
          return <p key={i} className="font-bold text-xs tracking-wide text-gray-700 mt-2 mb-1">{line}</p>;
        if (line.startsWith("Welcome "))
          return <p key={i} className="text-sm text-gray-700">{line}</p>;
        if (/^\d+\.\s/.test(line))
          return <p key={i} className="text-sm text-gray-800 leading-snug">{line}</p>;
        if (line.startsWith("Balance:"))
          return <p key={i} className="text-xs text-gray-600 border-t border-gray-200 pt-2 mt-2">{line}</p>;
        if (line.startsWith("Dial "))
          return <p key={i} className="text-[10px] text-gray-400 text-center pt-1">{line}</p>;
        return <p key={i} className="text-sm text-gray-800 whitespace-pre-wrap">{line || "\u00A0"}</p>;
      })}
    </div>
  );
}

function shouldAutoSend(message: string, input: string): boolean {
  if (/MAIN MENU/.test(message) && /^[1-9]$/.test(input)) return true;
  if (/Enter.*PIN/i.test(message) && /^\d{4}$/.test(input)) return true;
  if (/1\. Confirm/i.test(message) && /^[12]$/.test(input)) return true;
  if (/1\. Full repayment/i.test(message) && /^[12]$/.test(input)) return true;
  if (/Select meter:/i.test(message) && /^\d$/.test(input)) return true;
  if (/Manage Account/i.test(message) && /^[1-4]$/.test(input)) return true;
  return false;
}

export interface UssdSimulatorProps {
  open: boolean;
  onClose: () => void;
  phoneNumber: string;
  editablePhone?: boolean;
  onPhoneChange?: (phone: string) => void;
}

export default function UssdSimulator({
  open,
  onClose,
  phoneNumber,
  editablePhone = false,
  onPhoneChange,
}: UssdSimulatorProps) {
  const [sessionId, setSessionId] = useState(newSessionId);
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [accumulatedText, setAccumulatedText] = useState("");
  const [currentInput, setCurrentInput] = useState("");
  const [displayMessage, setDisplayMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = useCallback(() => {
    setSessionId(newSessionId());
    setSessionState("idle");
    setAccumulatedText("");
    setCurrentInput("");
    setDisplayMessage("");
    setError("");
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function sendRequest(text: string) {
    if (!phoneNumber.trim()) {
      setError("Enter a phone number first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body = new URLSearchParams({
        sessionId,
        phoneNumber: phoneNumber.trim(),
        serviceCode: SERVICE_CODE,
        text,
      });
      const res = await fetch("/api/ussd/callback", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Request failed (${res.status})`);
      }
      const raw = await res.text();
      const parsed = parseUssd(raw);
      setDisplayMessage(parsed.message);
      setSessionState(parsed.continue ? "active" : "ended");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not reach USSD service.");
      setSessionState("ended");
    } finally {
      setLoading(false);
    }
  }

  function pressKey(key: string) {
    if (loading || sessionState === "idle" || sessionState === "ended") return;
    const next = currentInput + key;
    if (shouldAutoSend(displayMessage, next)) {
      const nextText = accumulatedText ? `${accumulatedText}*${next}` : next;
      setAccumulatedText(nextText);
      setCurrentInput("");
      sendRequest(nextText);
    } else {
      setCurrentInput(next);
    }
  }

  function handleAction() {
    if (loading) return;
    if (sessionState === "idle") {
      setSessionState("active");
      sendRequest("");
      return;
    }
    if (sessionState === "ended") {
      setSessionId(newSessionId());
      setSessionState("active");
      setAccumulatedText("");
      setCurrentInput("");
      setDisplayMessage("");
      setError("");
      sendRequest("");
      return;
    }
    const nextText = accumulatedText
      ? `${accumulatedText}*${currentInput}`
      : currentInput;
    setAccumulatedText(nextText);
    setCurrentInput("");
    sendRequest(nextText);
  }

  function backspace() {
    if (loading) return;
    setCurrentInput(prev => prev.slice(0, -1));
  }

  if (!open) return null;

  const showDialCode = sessionState === "idle" && !displayMessage;
  const actionLabel =
    sessionState === "idle" ? "Dial" : sessionState === "ended" ? "Dial again" : "Send";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ussd-simulator-title"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[320px] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0"
          style={{ background: "linear-gradient(135deg, #071A3E, #0D2657)" }}
        >
          <div className="min-w-0">
            <h2 id="ussd-simulator-title" className="text-white font-bold text-base">USSD Simulator</h2>
            <p className="text-gpawa-cyan text-[10px] mt-0.5 truncate">Test without Africa&apos;s Talking</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/20"
          >
            Close
          </button>
        </div>

        {editablePhone && (
          <div className="px-4 pt-3 shrink-0">
            <label className="block text-xs font-medium text-gray-500 mb-1">Simulate as phone number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={e => onPhoneChange?.(e.target.value)}
              disabled={sessionState === "active"}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gpawa-blue disabled:bg-gray-50"
              placeholder="+256701234567"
            />
          </div>
        )}

        <div className="p-3 flex justify-center overflow-y-auto min-h-0 flex-1">
          <div className="w-[220px] bg-gray-900 rounded-[1.5rem] p-2 shadow-xl shrink-0">
            <div className="bg-white rounded-[1rem] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-3 py-1.5 text-[10px] text-gray-500 border-b border-gray-100 shrink-0">
                <span className="font-semibold text-gray-700">gPawa</span>
                <span className="text-gray-400">{SERVICE_CODE}</span>
              </div>

              <div className="px-3 py-3 max-h-[140px] overflow-y-auto shrink-0">
                {showDialCode ? (
                  <p className="text-center text-lg font-light text-gray-800 tracking-wide py-4">{SERVICE_CODE}</p>
                ) : (
                  <div className="space-y-1">
                    <UssdMessageDisplay message={displayMessage} />
                    {currentInput && sessionState === "active" && (
                      <p className="text-base font-mono text-gpawa-blue border-t border-gray-100 pt-1">{currentInput}</p>
                    )}
                  </div>
                )}
                {loading && (
                  <p className="text-center text-[10px] text-gray-400 mt-2 animate-pulse">Connecting…</p>
                )}
                {sessionState === "ended" && !loading && (
                  <p className="text-center text-[10px] text-amber-600 mt-1 font-medium">Session ended</p>
                )}
                {error && (
                  <p className="text-center text-[10px] text-red-600 mt-1">{error}</p>
                )}
              </div>

              <div className="border-t border-gray-100 px-2 pb-2 pt-1 shrink-0">
                {KEYPAD.map((row, ri) => (
                  <div key={ri} className="grid grid-cols-3 gap-0.5 mb-0.5">
                    {row.map(({ key, sub }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => pressKey(key)}
                        disabled={loading || sessionState === "idle" || sessionState === "ended"}
                        className="flex flex-col items-center justify-center py-1.5 rounded-md hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 transition-colors"
                      >
                        <span className="text-lg font-light text-gpawa-blue">{key}</span>
                        {sub && <span className="text-[8px] text-gray-400 tracking-widest leading-none">{sub}</span>}
                      </button>
                    ))}
                  </div>
                ))}

                <div className="flex items-center justify-center gap-4 mt-1">
                  {sessionState === "active" && (
                    <button
                      type="button"
                      onClick={backspace}
                      disabled={loading || !currentInput}
                      className="text-[10px] text-gray-500 hover:text-gray-800 disabled:opacity-40"
                    >
                      ⌫
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAction}
                    disabled={loading || (sessionState === "active" && !currentInput)}
                    title={actionLabel}
                    className="w-11 h-11 rounded-full bg-green-500 hover:bg-green-600 active:scale-95 disabled:opacity-50 flex items-center justify-center shadow-md transition-all"
                  >
                    {sessionState === "active" ? (
                      <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                      </svg>
                    )}
                  </button>
                  {sessionState !== "idle" && (
                    <button
                      type="button"
                      onClick={reset}
                      disabled={loading}
                      className="text-[10px] text-gray-500 hover:text-red-600 disabled:opacity-40"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-3 text-center text-[10px] text-gray-400 shrink-0 border-t border-gray-50 pt-2">
          {!editablePhone && phoneNumber && (
            <p className="mb-0.5">As <strong className="text-gray-600">{phoneNumber}</strong></p>
          )}
          <p>Click outside or Close · Esc to dismiss</p>
        </div>
      </div>
    </div>
  );
}
