import { NextResponse } from "next/server";

import {
  subscribeToMessagingEvents,
  type MessagingEvent,
} from "@/lib/messaging-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializeEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const threadId = typeof searchParams.get("threadId") === "string" ? searchParams.get("threadId")!.trim() : "";
  const patientId = typeof searchParams.get("patientId") === "string" ? searchParams.get("patientId")!.trim() : "";
  const scanId = typeof searchParams.get("scanId") === "string" ? searchParams.get("scanId")!.trim() : "";

  if (!threadId && !patientId && !scanId) {
    return NextResponse.json(
      { error: "threadId, patientId, or scanId is required." },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  let teardown: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let isClosed = false;

      const send = (event: string, payload: unknown) => {
        if (isClosed) {
          return;
        }

        controller.enqueue(encoder.encode(serializeEvent(event, payload)));
      };

      send("connected", {
        ok: true,
        threadId: threadId || null,
        patientId: patientId || null,
        scanId: scanId || null,
      });

      const unsubscribe = subscribeToMessagingEvents(
        { threadId, patientId, scanId },
        (event: MessagingEvent) => {
          send("message", {
            threadId: event.threadId,
            patientId: event.patientId,
            scanId: event.scanId,
            message: {
              ...event.message,
              createdAt: event.message.createdAt.toISOString(),
            },
          });
        }
      );

      const heartbeat = setInterval(() => {
        send("heartbeat", { timestamp: new Date().toISOString() });
      }, 25000);

      const cleanup = () => {
        if (isClosed) {
          return;
        }

        isClosed = true;
        clearInterval(heartbeat);
        unsubscribe();
        req.signal.removeEventListener("abort", cleanup);

        try {
          controller.close();
        } catch {
          // Ignore close errors after disconnects.
        }
      };

      teardown = cleanup;
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      teardown?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
