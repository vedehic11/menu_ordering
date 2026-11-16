import type { Prisma } from "@prisma/client";

const ACTIVE_SESSION_STATUSES = ["open", "bill_requested", "closing"] as const;

export async function getOrCreateActiveSession(
  tx: Prisma.TransactionClient,
  tableId: string,
  guestCount = 2,
) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(0, hashtext(${tableId}))`;

  const existing = await tx.tableSession.findFirst({
    where: {
      tableId,
      status: { in: [...ACTIVE_SESSION_STATUSES] },
    },
  });
  if (existing) return existing;

  return tx.tableSession.create({
    data: { tableId, status: "open", guestCount },
  });
}
