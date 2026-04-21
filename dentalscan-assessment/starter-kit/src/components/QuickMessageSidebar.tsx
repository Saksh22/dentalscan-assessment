"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare, Send, RotateCcw } from "lucide-react";

type Sender = "patient" | "dentist";
type DeliveryState = "sent" | "sending" | "failed";

type MessageRecord = {
  id: string;
  content: string;
  sender: Sender;
  createdAt: string;
  deliveryState?: DeliveryState;
};

type MessagingResponse = {
  threadId: string | null;
  patientId?: string;
  scanId?: string | null;
  messages: Array<{
    id: string;
    content: string;
    sender: Sender;
    createdAt: string;
  }>;
};

type SendMessageResponse = {
  threadId: string;
  patientId: string;
  scanId?: string | null;
  message: {
    id: string;
    content: string;
    sender: Sender;
    createdAt: string;
  };
};

type StreamMessagePayload = {
  threadId: string;
  patientId: string;
  scanId?: string | null;
  message: {
    id: string;
    content: string;
    sender: Sender;
    createdAt: string;
  };
};

type QuickMessageSidebarProps = {
  patientId: string;
  scanId: string;
};

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getOptimisticId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function upsertConfirmedMessage(
  current: MessageRecord[],
  incoming: StreamMessagePayload["message"]
) {
  const nextMessage: MessageRecord = {
    ...incoming,
    deliveryState: "sent",
  };
  const exactMatchIndex = current.findIndex((message) => message.id === incoming.id);

  if (exactMatchIndex >= 0) {
    return current.map((message, index) =>
      index === exactMatchIndex ? nextMessage : message
    );
  }

  const pendingMatchIndex = current.findIndex(
    (message) =>
      message.sender === incoming.sender &&
      message.content === incoming.content &&
      message.deliveryState === "sending"
  );

  if (pendingMatchIndex >= 0) {
    return current.map((message, index) =>
      index === pendingMatchIndex ? nextMessage : message
    );
  }

  return [...current, nextMessage];
}

function mergeServerMessages(
  current: MessageRecord[],
  incoming: MessagingResponse["messages"]
) {
  let next = [...current];

  for (const message of incoming) {
    next = upsertConfirmedMessage(next, message);
  }

  return next;
}

export default function QuickMessageSidebar({
  patientId,
  scanId,
}: QuickMessageSidebarProps) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  const loadMessages = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoading(true);
    }

    setLoadError(null);

    try {
      const response = await fetch(
        `/api/messaging?scanId=${encodeURIComponent(scanId)}`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as MessagingResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Unable to load messages.");
      }

      setThreadId(data.threadId);
      setMessages((current) =>
        options?.silent
          ? mergeServerMessages(current, data.messages)
          : data.messages.map((message) => ({
              ...message,
              deliveryState: "sent",
            }))
      );
    } catch (error) {
      console.error("Unable to load messaging history:", error);
      setLoadError("Could not load the clinic thread. Try refreshing the panel.");
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  }, [scanId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadMessages({ silent: true });
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadMessages]);

  useEffect(() => {
    if (loadError) {
      setIsLive(false);
      return;
    }

    const searchParams = new URLSearchParams();

    if (threadId) {
      searchParams.set("threadId", threadId);
    } else {
      searchParams.set("scanId", scanId);
    }

    const eventSource = new EventSource(`/api/messaging/stream?${searchParams.toString()}`);

    eventSource.addEventListener("connected", () => {
      setIsLive(true);
    });

    eventSource.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data) as StreamMessagePayload;

        setThreadId(payload.threadId);
        setMessages((current) => upsertConfirmedMessage(current, payload.message));
      } catch (error) {
        console.error("Unable to process live messaging event:", error);
      }
    });

    eventSource.onerror = () => {
      setIsLive(false);
    };

    return () => {
      setIsLive(false);
      eventSource.close();
    };
  }, [loadError, scanId, threadId]);

  const persistMessage = useCallback(
    async (content: string, optimisticId: string) => {
      setIsSending(true);
      setComposerError(null);

      try {
        const response = await fetch("/api/messaging", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            threadId,
            patientId,
            scanId,
            content,
            sender: "patient",
          }),
        });

        const data = (await response.json()) as SendMessageResponse & { error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Unable to send message.");
        }

        setThreadId(data.threadId);
        setMessages((current) => upsertConfirmedMessage(current, data.message));
      } catch (error) {
        console.error("Message send failed:", error);
        setMessages((current) =>
          current.map((message) =>
            message.id === optimisticId
              ? { ...message, deliveryState: "failed" }
              : message
          )
        );
        setComposerError("Message not sent. Retry from the failed bubble below.");
      } finally {
        setIsSending(false);
      }
    },
    [patientId, scanId, threadId]
  );

  const handleSend = useCallback(async () => {
    const content = draft.trim();

    if (!content || isSending) {
      return;
    }

    const optimisticId = getOptimisticId();

    setMessages((current) => [
      ...current,
      {
        id: optimisticId,
        content,
        sender: "patient",
        createdAt: new Date().toISOString(),
        deliveryState: "sending",
      },
    ]);
    setDraft("");

    await persistMessage(content, optimisticId);
  }, [draft, isSending, persistMessage]);

  const retryMessage = useCallback(
    async (messageId: string, content: string) => {
      if (isSending) {
        return;
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, deliveryState: "sending" }
            : message
        )
      );

      await persistMessage(content, messageId);
    },
    [isSending, persistMessage]
  );

  const orderedMessages = useMemo(
    () =>
      [...messages].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      ),
    [messages]
  );

  return (
    <aside className="flex w-full max-w-md flex-col rounded-[2rem] border border-white/10 bg-zinc-950/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-blue-300/90">
            Patient-Dentist Messaging
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            Quick message to your clinic
          </h3>
          <p className="mt-2 text-sm text-zinc-400">
            Ask follow-up questions without leaving the scan results screen.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-3 text-blue-100">
            <MessageSquare size={18} />
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium ${
              isLive
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-zinc-700 bg-zinc-900 text-zinc-400"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isLive ? "bg-emerald-300" : "bg-zinc-600"
              }`}
            />
            {isLive ? "Live" : "Reconnecting"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex min-h-[18rem] flex-1 flex-col">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
            <Loader2 size={16} className="mr-2 animate-spin" />
            Loading conversation...
          </div>
        ) : loadError ? (
          <div className="flex flex-1 flex-col items-start justify-center rounded-3xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            <p>{loadError}</p>
            <button
              onClick={() => void loadMessages()}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300/30 px-3 py-2 text-xs font-medium text-amber-50 transition hover:border-amber-200/60"
            >
              <RotateCcw size={14} />
              Reload thread
            </button>
          </div>
        ) : orderedMessages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-center">
            <MessageSquare size={20} className="text-blue-300" />
            <p className="mt-3 text-sm font-medium text-white">
              Connect with a dentist.
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Send a quick note if you want help with next steps, timing, or treatment questions.
            </p>
          </div>
        ) : (
          <div className="flex max-h-[24rem] flex-1 flex-col gap-3 overflow-y-auto pr-1">
            {orderedMessages.map((message) => {
              const isPatient = message.sender === "patient";
              const isFailed = message.deliveryState === "failed";

              return (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded-3xl px-4 py-3 ${
                    isPatient
                      ? "ml-auto bg-blue-500 text-white"
                      : "mr-auto border border-white/10 bg-white/5 text-zinc-100"
                  }`}
                >
                  <p className="text-sm leading-6">{message.content}</p>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
                    <span className={isPatient ? "text-blue-100/80" : "text-zinc-500"}>
                      {formatTimestamp(message.createdAt)}
                    </span>
                    {message.deliveryState === "sending" && (
                      <span className={isPatient ? "text-blue-100/80" : "text-zinc-500"}>
                        Sending...
                      </span>
                    )}
                    {isFailed && (
                      <button
                        onClick={() => void retryMessage(message.id, message.content)}
                        className="inline-flex items-center gap-1 font-medium text-amber-200 transition hover:text-white"
                      >
                        <RotateCcw size={12} />
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <label htmlFor="clinic-message" className="sr-only">
          Message your clinic
        </label>
        <textarea
          id="clinic-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type a quick note to your dentist..."
          rows={4}
          maxLength={500}
          className="w-full resize-none rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-blue-400/40 focus:bg-white/[0.06]"
        />
        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="text-xs text-zinc-500">
            {composerError ?? `${draft.trim().length}/500 characters`}
          </div>
          <button
            onClick={() => void handleSend()}
            disabled={!draft.trim() || isSending || Boolean(loadError)}
            className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {isSending ? "Sending..." : threadId ? "Send message" : "Start thread"}
          </button>
        </div>
      </div>
    </aside>
  );
}
