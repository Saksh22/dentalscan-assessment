import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { publishMessagingEvent } from "@/lib/messaging-events";
import { prisma } from "@/lib/prisma";

type Sender = "patient" | "dentist";
type ThreadRecord = {
  id: string;
  patientId: string;
  scanId: string | null;
};

async function findThreadRecord(
  db: typeof prisma | Prisma.TransactionClient,
  {
    threadId,
    patientId,
    scanId,
  }: {
    threadId?: string;
    patientId?: string;
    scanId?: string;
  }
) {
  let query: Prisma.Sql | null = null;

  if (threadId) {
    query = Prisma.sql`
      SELECT id, patientId, scanId
      FROM "Thread"
      WHERE id = ${threadId}
      LIMIT 1
    `;
  } else if (scanId) {
    query = Prisma.sql`
      SELECT id, patientId, scanId
      FROM "Thread"
      WHERE scanId = ${scanId}
      ORDER BY updatedAt DESC
      LIMIT 1
    `;
  } else if (patientId) {
    query = Prisma.sql`
      SELECT id, patientId, scanId
      FROM "Thread"
      WHERE patientId = ${patientId}
      ORDER BY updatedAt DESC
      LIMIT 1
    `;
  }

  if (!query) {
    return null;
  }

  const rows = await db.$queryRaw<ThreadRecord[]>(query);
  return rows[0] ?? null;
}

async function createThreadRecord(
  db: Prisma.TransactionClient,
  { patientId, scanId }: { patientId: string; scanId?: string }
) {
  const id = crypto.randomUUID();

  await db.$executeRaw`
    INSERT INTO "Thread" (id, patientId, scanId, updatedAt)
    VALUES (${id}, ${patientId}, ${scanId ?? null}, CURRENT_TIMESTAMP)
  `;

  return {
    id,
    patientId,
    scanId: scanId ?? null,
  } satisfies ThreadRecord;
}

/**
 * CHALLENGE: MESSAGING SYSTEM
 * 
 * Your goal is to build a basic communication channel between the Patient and Dentist.
 * 1. Implement the POST handler to save a new message into a Thread.
 * 2. Implement the GET handler to retrieve message history for a given thread.
 * 3. Focus on data integrity and proper relations.
 */

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

  try {
    const thread = await findThreadRecord(prisma, { threadId, patientId, scanId });

    if (!thread) {
      return NextResponse.json({
        threadId: null,
        patientId,
        scanId: scanId || null,
        messages: [],
      });
    }

    const messages = await prisma.message.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        content: true,
        sender: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      threadId: thread.id,
      patientId: thread.patientId,
      scanId: thread.scanId,
      messages,
    });
  } catch (error) {
    console.error("Messaging history error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

    const payload = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const threadId = typeof payload.threadId === "string" ? payload.threadId.trim() : "";
    const patientId = typeof payload.patientId === "string" ? payload.patientId.trim() : "";
    const scanId = typeof payload.scanId === "string" ? payload.scanId.trim() : "";
    const content = typeof payload.content === "string" ? payload.content.trim() : "";
    const senderValue = typeof payload.sender === "string" ? payload.sender.trim() : "";

    if (!content) {
      return NextResponse.json({ error: "Message content is required." }, { status: 400 });
    }

    if (content.length > 500) {
      return NextResponse.json(
        { error: "Message content must be 500 characters or fewer." },
        { status: 422 }
      );
    }

    if (!["patient", "dentist"].includes(senderValue)) {
      return NextResponse.json(
        { error: "sender must be either patient or dentist." },
        { status: 400 }
      );
    }

    const sender = senderValue as Sender;

    if (!threadId && !patientId && !scanId) {
      return NextResponse.json(
        { error: "scanId or patientId is required when threadId is missing." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      let thread = await findThreadRecord(tx, { threadId, patientId, scanId });

      if (!thread && threadId) {
        return { error: "Thread not found." as const, status: 404 as const };
      }

      if (thread && patientId && thread.patientId !== patientId) {
        return {
          error: "Thread does not belong to this patient." as const,
          status: 409 as const,
        };
      }

      if (thread && scanId && thread.scanId && thread.scanId !== scanId) {
        return {
          error: "Thread does not belong to this scan." as const,
          status: 409 as const,
        };
      }

      if (!thread) {
        thread = await createThreadRecord(tx, {
          patientId,
          scanId,
        });
      }

      const message = await tx.message.create({
        data: {
          threadId: thread.id,
          content,
          sender,
        },
        select: {
          id: true,
          content: true,
          sender: true,
          createdAt: true,
        },
      });

      await tx.$executeRaw`
        UPDATE "Thread"
        SET updatedAt = CURRENT_TIMESTAMP
        WHERE id = ${thread.id}
      `;

      return {
        ok: true as const,
        status: 201 as const,
        threadId: thread.id,
        patientId: thread.patientId,
        scanId: thread.scanId,
        message,
      };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    publishMessagingEvent({
      threadId: result.threadId,
      patientId: result.patientId,
      scanId: result.scanId,
      message: {
        ...result.message,
        sender: result.message.sender as Sender,
      },
    });

    return NextResponse.json(result, { status: result.status });
  } catch (err) {
    console.error("Messaging API Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
