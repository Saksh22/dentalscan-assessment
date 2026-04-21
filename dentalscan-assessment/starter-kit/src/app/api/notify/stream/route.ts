import { NextResponse } from "next/server";

import {
  subscribeToNotificationEvents,
  type NotificationEvent,
} from "@/lib/notification-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializeEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const notificationId =
    typeof searchParams.get("notificationId") === "string"
      ? searchParams.get("notificationId")!.trim()
      : "";
  const scanId =
    typeof searchParams.get("scanId") === "string"
      ? searchParams.get("scanId")!.trim()
      : "";

  if (!notificationId && !scanId) {
    return NextResponse.json(
      { error: "notificationId or scanId is required." },
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
        notificationId: notificationId || null,
        scanId: scanId || null,
      });

      const unsubscribe = subscribeToNotificationEvents(
        { notificationId, scanId },
        (event: NotificationEvent) => {
          send("notification", {
            id: event.id,
            scanId: event.scanId,
            read: event.read,
            title: event.title,
            message: event.message,
            createdAt: event.createdAt?.toISOString() ?? null,
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
