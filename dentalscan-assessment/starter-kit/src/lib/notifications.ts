import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type ScanCompletedNotificationInput = {
  scanId: string;
  userId?: string;
  db?: PrismaClient | Prisma.TransactionClient;
};

export async function createScanCompletedNotification({
  scanId,
  userId = "clinic-demo",
  db = prisma,
}: ScanCompletedNotificationInput) {
  return db.notification.create({
    data: {
      scanId,
      userId,
      title: "Scan completed",
      message: `A patient scan is ready for telehealth review. Scan ID: ${scanId}`,
      read: false,
    },
  });
}

export async function dispatchScanCompletedNotification(scanId: string) {
  await new Promise((resolve) => setTimeout(resolve, 0));
  console.log(`[STUB] Clinic notification dispatched for scan ${scanId}`);
}
