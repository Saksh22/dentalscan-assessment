import { NextResponse } from "next/server";

import {
  createScanCompletedNotification,
  dispatchScanCompletedNotification,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const images = Array.isArray(body?.images)
      ? body.images.filter((image: unknown): image is string => typeof image === "string" && image.length > 0)
      : [];
    const userId = typeof body?.userId === "string" && body.userId.trim() ? body.userId.trim() : "clinic-demo";

    if (images.length !== 5) {
      return NextResponse.json(
        { error: "A completed scan must include all 5 captured views." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const scan = await tx.scan.create({
        data: {
          status: "completed",
          images: images.join(","),
        },
      });

      const notification = await createScanCompletedNotification({
        scanId: scan.id,
        userId,
        db: tx,
      });

      return { scan, notification };
    });

    void dispatchScanCompletedNotification(result.scan.id).catch((error) => {
      console.error("Async notification dispatch failed:", error);
    });

    return NextResponse.json(
      {
        ok: true,
        scanId: result.scan.id,
        notificationId: result.notification.id,
        notificationRead: result.notification.read,
        message: "Scan uploaded and clinic notification queued.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Scan submission error:", error);
    return NextResponse.json(
      { error: "Unable to submit scan right now." },
      { status: 500 }
    );
  }
}
