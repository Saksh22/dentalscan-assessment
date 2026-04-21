import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  createScanCompletedNotification,
  dispatchScanCompletedNotification,
} from "@/lib/notifications";
import { publishNotificationEvent } from "@/lib/notification-events";
import { prisma } from "@/lib/prisma";

function getNormalizedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * CHALLENGE: NOTIFICATION SYSTEM
 * 
 * Your goal is to implement a robust notification logic.
 * 1. When a scan is "completed", create a record in the Notification table.
 * 2. Return a success status to the client.
 * 3. Bonus: Handle potential errors (e.g., database connection issues).
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const notificationId = getNormalizedString(searchParams.get("notificationId"));

    if (!notificationId) {
      return NextResponse.json(
        { error: "notificationId is required." },
        { status: 400 }
      );
    }

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        scanId: true,
        read: true,
        title: true,
        message: true,
        createdAt: true,
        scan: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ notification });
  } catch (error) {
    console.error("Notification lookup error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const notificationId = getNormalizedString(
      (body as Record<string, unknown> | null)?.notificationId
    );
    const readValue = (body as Record<string, unknown> | null)?.read;

    if (!notificationId || typeof readValue !== "boolean") {
      return NextResponse.json(
        { error: "notificationId and boolean read are required." },
        { status: 400 }
      );
    }

    const notification = await prisma.notification.update({
      where: { id: notificationId },
      data: { read: readValue },
      select: {
        id: true,
        scanId: true,
        read: true,
        title: true,
        message: true,
        createdAt: true,
      },
    });

    publishNotificationEvent(notification);

    return NextResponse.json({ notification });
  } catch (error) {
    console.error("Notification update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let scanId = "";

  try {
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    scanId = getNormalizedString((body as Record<string, unknown> | null)?.scanId);
    const status = getNormalizedString((body as Record<string, unknown> | null)?.status);
    const userId = getNormalizedString((body as Record<string, unknown> | null)?.userId) || "clinic-demo";

    if (!scanId || !status) {
      return NextResponse.json(
        { error: "scanId and status are required." },
        { status: 400 }
      );
    }

    if (status !== "completed") {
      return NextResponse.json(
        { error: "Only completed scans can trigger notifications." },
        { status: 422 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const scan = await tx.scan.findUnique({
        where: { id: scanId },
        select: { id: true, status: true },
      });

      if (!scan) {
        return { error: "Scan not found." as const, status: 404 as const };
      }

      if (scan.status !== "completed") {
        return {
          error: "Notification can only be created for completed scans." as const,
          status: 409 as const,
        };
      }

      const existingNotification = await tx.notification.findFirst({
        where: { scanId },
        select: {
          id: true,
          read: true,
          createdAt: true,
        },
      });

      if (existingNotification) {
        return {
          ok: true as const,
          created: false as const,
          notification: existingNotification,
          status: 200 as const,
        };
      }

      const notification = await createScanCompletedNotification({
        scanId,
        userId,
        db: tx,
      });

      return {
        ok: true as const,
        created: true as const,
        notification: {
          id: notification.id,
          read: notification.read,
          createdAt: notification.createdAt,
        },
        status: 201 as const,
      };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (result.created) {
      publishNotificationEvent({
        id: result.notification.id,
        scanId,
        read: result.notification.read,
        createdAt: result.notification.createdAt,
      });

      void dispatchScanCompletedNotification(scanId).catch((error) => {
        console.error("Async notification dispatch failed:", error);
      });
    }

    return NextResponse.json(
      {
        ok: true,
        created: result.created,
        notificationId: result.notification.id,
        notificationRead: result.notification.read,
        createdAt: result.notification.createdAt,
        message: result.created
          ? "Notification triggered."
          : "Notification already exists for this scan.",
      },
      { status: result.status }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      if (scanId) {
        const notification = await prisma.notification.findFirst({
          where: { scanId },
          select: {
            id: true,
            read: true,
            createdAt: true,
          },
        });

        if (notification) {
          return NextResponse.json(
            {
              ok: true,
              created: false,
              notificationId: notification.id,
              notificationRead: notification.read,
              createdAt: notification.createdAt,
              message: "Notification already exists for this scan.",
            },
            { status: 200 }
          );
        }
      }
    }

    console.error("Notification API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
