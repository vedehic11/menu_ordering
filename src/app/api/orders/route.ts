import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, hasDatabaseUrl } from "@/lib/prisma";
import { MOCK_RESTAURANT, MOCK_TABLES } from "@/lib/mock-data";
import {
  getStoredOrders,
  saveStoredOrders,
  getStoredMenuItems,
  getOrCreateActiveSession,
} from "@/lib/storage";
import { KitchenStation, KitchenStatus } from "@/types/database";
import { requireStaffRole, logAuditEvent } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { getOrCreateActiveSession as getOrCreateDatabaseSession } from "@/lib/active-session";
import { calculateRestaurantTax } from "@/lib/tax";

const orderSchema = z.object({
  tableToken: z.string(),
  customer: z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    phone: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian phone number"),
    email: z.string().email("Please enter a valid email address").max(254),
  }),
  items: z.array(
    z.object({
      menuItemId: z.string(),
      quantity: z.number().int().min(1).max(50),
      specialInstructions: z.string().optional(),
    })
  ).min(1, "Cart cannot be empty").max(30),
  specialInstructions: z.string().optional(),
  idempotencyKey: z.string().uuid(),
  paymentMethod: z.literal("counter").default("counter"),
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const body = orderSchema.parse(rawBody);

    // 1. Strict PostgreSQL Mode (Single Source of Truth)
    if (hasDatabaseUrl()) {
      try {
        const result = await prisma.$transaction(
          async (tx) => {
            // 1. Verify Table
            const table = await tx.diningTable.findUnique({
              where: { qrToken: body.tableToken },
              include: { restaurant: true },
            });

            if (!table || !table.isActive) {
              throw new Error("INVALID_TABLE");
            }

            if (!table.restaurant.isOpen) {
              throw new Error("RESTAURANT_CLOSED");
            }

            // 2. Find or create single active dining session
            const session = await getOrCreateDatabaseSession(tx, table.id);
            if (session.status === "closing") {
              throw new Error("SESSION_CLOSING");
            }

            // 3. Check Idempotency Key
            const existing = await tx.order.findUnique({
              where: { idempotencyKey: body.idempotencyKey },
            });

            if (existing) {
              return {
                order: existing,
                totalPaise: existing.totalPaise,
                tableNumber: table.tableNumber,
                roundNumber: existing.roundNumber,
              };
            }

            // 4. Fetch Dishes & Validate Availability
            const itemIds = [...new Set(body.items.map((i) => i.menuItemId))];
            const menuItems = await tx.menuItem.findMany({
              where: {
                id: { in: itemIds },
                isAvailable: true,
                category: { restaurantId: table.restaurantId },
              },
            });

            if (menuItems.length !== itemIds.length) {
              throw new Error("DISH_UNAVAILABLE");
            }

            const menuMap = new Map(menuItems.map((m) => [m.id, m]));
            const lineItems = body.items.map((item) => {
              const menu = menuMap.get(item.menuItemId)!;
              return {
                menuItemId: menu.id,
                itemName: menu.name,
                station: menu.station,
                unitPricePaise: menu.pricePaise,
                quantity: item.quantity,
                specialInstructions: item.specialInstructions || null,
                lineTotalPaise: menu.pricePaise * item.quantity,
              };
            });

            // 5. Accurate F&B GST Calculation (2.5% CGST + 2.5% SGST)
            const subtotal = lineItems.reduce((sum, i) => sum + i.lineTotalPaise, 0);
            const { cgstPaise: cgst, sgstPaise: sgst, totalPaise: tax } =
              calculateRestaurantTax(subtotal);
            const total = subtotal + tax;

            // 6. Concurrency-Safe Round Number Allocation (Database Atomic Max)
            const maxRoundAgg = await tx.order.aggregate({
              where: { sessionId: session.id },
              _max: { roundNumber: true },
            });
            const nextRoundNumber = (maxRoundAgg._max.roundNumber || 0) + 1;

            // 7. Upsert Customer
            const customer = await tx.customer.create({
              data: {
                name: body.customer.name,
                phone: body.customer.phone,
                email: body.customer.email,
              },
            });

            // 8. Create Order Round with nested OrderItems atomically
            const order = await tx.order.create({
              data: {
                sessionId: session.id,
                customerId: customer.id,
                roundNumber: nextRoundNumber,
                kitchenStatus: "accepted",
                subtotalPaise: subtotal,
                taxPaise: tax,
                cgstPaise: cgst,
                sgstPaise: sgst,
                totalPaise: total,
                specialInstructions: body.specialInstructions || null,
                idempotencyKey: body.idempotencyKey,
                items: {
                  create: lineItems.map((li) => ({
                    menuItemId: li.menuItemId,
                    itemName: li.itemName,
                    station: li.station,
                    unitPricePaise: li.unitPricePaise,
                    quantity: li.quantity,
                    specialInstructions: li.specialInstructions,
                    lineTotalPaise: li.lineTotalPaise,
                  })),
                },
              },
              include: { items: true },
            });

            return {
              order,
              totalPaise: total,
              tableNumber: table.tableNumber,
              roundNumber: nextRoundNumber,
            };
          }
        );

        return NextResponse.json(
          {
            success: true,
            order: {
              id: result.order.id,
              order_number: result.order.orderNumber,
              round_number: result.roundNumber,
              table_number: result.tableNumber,
              created_at: result.order.createdAt.toISOString(),
            },
            totalPaise: result.totalPaise,
          },
          { status: 201 }
        );
      } catch (txError: unknown) {
        const message = txError instanceof Error ? txError.message : "";
        if (message === "INVALID_TABLE") {
          return NextResponse.json({ error: "Invalid dining table. Please rescan QR." }, { status: 404 });
        }
        if (message === "RESTAURANT_CLOSED") {
          return NextResponse.json({ error: "Restaurant is currently closed for orders." }, { status: 409 });
        }
        if (message === "DISH_UNAVAILABLE") {
          return NextResponse.json({ error: "One or more dishes are sold out. Please refresh menu." }, { status: 409 });
        }
        if (message === "SESSION_CLOSING") {
          return NextResponse.json(
            { error: "Table bill is being settled at the counter. Please request staff to open a new tab." },
            { status: 409 }
          );
        }
        // Unique round conflict on concurrent submission -> P2002
        if (
          typeof txError === "object" &&
          txError !== null &&
          "code" in txError &&
          txError.code === "P2002"
        ) {
          return NextResponse.json(
            { error: "A concurrent order was placed for this table. Please retry sending order." },
            { status: 409 }
          );
        }

        console.error("Prisma Transaction error:", txError);
        // STRICT: Never fall back to JSON storage in production! Return error so cart is retained.
        return NextResponse.json(
          { error: "Unable to record order in database. Your cart is preserved. Please try again." },
          { status: 503 }
        );
      }
    }

    // 2. Offline Local Dev Mode Only (When DATABASE_URL is not configured)
    const table = MOCK_TABLES.find((t) => t.qr_token === body.tableToken);
    if (!table) {
      return NextResponse.json({ error: "Invalid dining table. Please rescan QR." }, { status: 404 });
    }
    const session = getOrCreateActiveSession(table.id, table.table_number);

    if (session.status === "closing" || session.status === "settled") {
      return NextResponse.json(
        { error: "This table is currently settling at the cashier. Please request staff to open a new tab." },
        { status: 409 }
      );
    }

    const storedItems = getStoredMenuItems();
    const menuMap = new Map(storedItems.map((item) => [item.id, item]));

    const items = body.items.flatMap((item) => {
      const menu = menuMap.get(item.menuItemId);
      if (!menu || !menu.is_available) return [];
      return {
        id: `oi-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        order_id: "",
        menu_item_id: menu.id,
        item_name: menu.name,
        station: menu.station || ("mains" as KitchenStation),
        unit_price_paise: menu.price_paise,
        quantity: item.quantity,
        special_instructions: item.specialInstructions || null,
        line_total_paise: menu.price_paise * item.quantity,
        is_done: false,
        created_at: new Date().toISOString(),
      };
    });
    if (items.length !== body.items.length) {
      return NextResponse.json(
        { error: "One or more dishes are sold out or unavailable. Please refresh menu." },
        { status: 409 },
      );
    }

    const subtotal = items.reduce((sum, item) => sum + item.unit_price_paise * item.quantity, 0);
    const cgst = Math.round(subtotal * 0.025);
    const sgst = Math.round(subtotal * 0.025);
    const tax = cgst + sgst;
    const total = subtotal + tax;

    const orders = getStoredOrders();
    const existing = orders.find((o) => o.idempotency_key === body.idempotencyKey);
    if (existing) {
      return NextResponse.json({
        success: true,
        order: existing,
        totalPaise: existing.total_paise,
      });
    }

    const sessionOrders = orders.filter((o) => o.session_id === session.id);
    const roundNumber = sessionOrders.length + 1;

    const newOrderId = `ord-${Date.now()}`;
    const newOrderNumber = 1000 + orders.length + 1;
    const newOrder = {
      id: newOrderId,
      order_number: newOrderNumber,
      session_id: session.id,
      restaurant_id: MOCK_RESTAURANT.id,
      table_id: table.id,
      table_number: table.table_number,
      customer_id: `cust-${Date.now()}`,
      round_number: roundNumber,
      kitchen_status: "accepted" as KitchenStatus,
      order_status: "accepted" as KitchenStatus,
      payment_method: "counter" as const,
      payment_status: "pending" as const,
      subtotal_paise: subtotal,
      tax_paise: tax,
      cgst_paise: cgst,
      sgst_paise: sgst,
      total_paise: total,
      special_instructions: body.specialInstructions || null,
      idempotency_key: body.idempotencyKey,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      customer: {
        name: body.customer.name,
        phone: body.customer.phone,
        email: body.customer.email,
      },
      items: items.map((i) => ({ ...i, order_id: newOrderId })),
    };

    orders.unshift(newOrder);
    saveStoredOrders(orders);

    return NextResponse.json(
      {
        success: true,
        order: {
          id: newOrder.id,
          order_number: newOrder.order_number,
          round_number: roundNumber,
          table_number: table.table_number,
          created_at: newOrder.created_at,
        },
        totalPaise: total,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid order information." },
        { status: 400 }
      );
    }
    console.error("Order creation failed:", error);
    return NextResponse.json(
      { error: "Unable to place your order. Please notify a team member." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const tableToken = searchParams.get("tableToken");
    const sessionId = searchParams.get("sessionId");
    const station = searchParams.get("station") as KitchenStation | null;

    let staff: Awaited<ReturnType<typeof requireStaffRole>>["staff"] = null;
    if (!tableToken || sessionId || station) {
      const auth = await requireStaffRole(request, ["chef", "captain", "cashier", "manager"]);
      staff = auth.staff;
      const { errorResponse } = auth;
      if (errorResponse) return errorResponse;
    }

    if (hasDatabaseUrl()) {
      try {
        if (id) {
          const table = tableToken
            ? await prisma.diningTable.findUnique({ where: { qrToken: tableToken }, select: { id: true } })
            : null;
          if (tableToken && !table) {
            return NextResponse.json({ error: "Table not found" }, { status: 404 });
          }
          const order = await prisma.order.findFirst({
            where: {
              OR: [{ id }, { orderNumber: Number(id) || -1 }],
              ...(table ? { session: { tableId: table.id } } : {}),
              ...(staff ? { session: { table: { restaurantId: staff.restaurantId } } } : {}),
            },
            include: {
              session: { include: { table: true, settlement: true } },
              ...(staff ? { customer: true } : {}),
              items: true,
            },
          });

          if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
          }

          return NextResponse.json({
            order: {
              ...order,
              table_id: order.session.tableId,
              session_id: order.sessionId,
              order_number: order.orderNumber,
              round_number: order.roundNumber,
              table_number: order.session.table.tableNumber,
              total_paise: order.totalPaise,
              subtotal_paise: order.subtotalPaise,
              tax_paise: order.taxPaise,
              kitchen_status: order.kitchenStatus,
              order_status: order.kitchenStatus,
              payment_method: "counter",
              payment_status: order.session.settlement ? "paid" : "pending",
              ...(staff && "customer" in order
                ? {
                    customer: {
                      name: order.customer.name,
                      phone: order.customer.phone,
                      email: order.customer.email,
                    },
                  }
                : {}),
              items: order.items.map((item) => ({
                ...item,
                order_id: item.orderId,
                menu_item_id: item.menuItemId,
                item_name: item.itemName,
                unit_price_paise: item.unitPricePaise,
                line_total_paise: item.lineTotalPaise,
                is_done: item.isDone,
                is_voided: item.isVoided,
                void_reason: item.voidReason,
                created_at: item.createdAt.toISOString(),
              })),
              created_at: order.createdAt.toISOString(),
            },
          });
        }

        // Public QR scan only returns active session orders
        const whereClause: Prisma.OrderWhereInput = {};
        if (sessionId) {
          whereClause.session = {
            id: sessionId,
            table: { restaurantId: staff!.restaurantId },
          };
        } else if (tableToken) {
          const table = await prisma.diningTable.findUnique({ where: { qrToken: tableToken } });
          if (!table) return NextResponse.json({ orders: [] });

          const activeSession = await prisma.tableSession.findFirst({
            where: {
              tableId: table.id,
              status: { in: ["open", "bill_requested", "closing"] },
            },
          });
          if (!activeSession) return NextResponse.json({ orders: [] });
          whereClause.sessionId = activeSession.id;
        } else if (staff) {
          whereClause.session = { table: { restaurantId: staff.restaurantId } };
        }

        const orders = await prisma.order.findMany({
          where: whereClause,
          include: {
            items: station ? { where: { station } } : true,
            ...(staff ? { customer: true } : {}),
            session: { include: { table: true, settlement: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        const formatted = orders
          .filter((o) => !station || o.items.length > 0)
          .map((o) => ({
            ...o,
            table_id: o.session.tableId,
            session_id: o.sessionId,
            order_number: o.orderNumber,
            round_number: o.roundNumber,
            table_number: o.session.table.tableNumber,
            total_paise: o.totalPaise,
            subtotal_paise: o.subtotalPaise,
            tax_paise: o.taxPaise,
            kitchen_status: o.kitchenStatus,
            order_status: o.kitchenStatus,
            payment_method: "counter",
            payment_status: o.session.settlement ? "paid" : "pending",
            ...(staff && "customer" in o
              ? {
                  customer: {
                    name: o.customer.name,
                    phone: o.customer.phone,
                    email: o.customer.email,
                  },
                }
              : {}),
            items: o.items.map((item) => ({
              ...item,
              order_id: item.orderId,
              menu_item_id: item.menuItemId,
              item_name: item.itemName,
              unit_price_paise: item.unitPricePaise,
              line_total_paise: item.lineTotalPaise,
              is_done: item.isDone,
              is_voided: item.isVoided,
              void_reason: item.voidReason,
              created_at: item.createdAt.toISOString(),
            })),
            created_at: o.createdAt.toISOString(),
          }));

        return NextResponse.json({ orders: formatted });
      } catch (err) {
        console.error("Prisma GET error:", err);
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json({ error: "Order service is temporarily unavailable." }, { status: 503 });
        }
        return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
      }
    }

    // Local fallback
    const stored = getStoredOrders();
    if (id) {
      const order = stored.find((o) => o.id === id || String(o.order_number) === id);
      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      if (tableToken) {
        const table = MOCK_TABLES.find((candidate) => candidate.qr_token === tableToken);
        if (!table || order.table_id !== table.id) {
          return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }
      }
      if (!staff) {
        return NextResponse.json({ order: { ...order, customer: undefined } });
      }
      return NextResponse.json({ order });
    }

    let filtered = stored;
    if (sessionId) {
      filtered = filtered.filter((o) => o.session_id === sessionId);
    } else if (tableToken) {
      const matchedTable = MOCK_TABLES.find((t) => t.qr_token === tableToken);
      filtered = matchedTable ? filtered.filter((o) => o.table_id === matchedTable.id) : [];
      return NextResponse.json({
        orders: staff
          ? filtered
          : filtered.map((order) => ({ ...order, customer: undefined })),
        table: matchedTable,
      });
    }

    if (station) {
      filtered = filtered
        .map((o) => ({ ...o, items: o.items.filter((item) => item.station === station) }))
        .filter((o) => o.items.length > 0);
    }

    return NextResponse.json({
      orders: staff
        ? filtered
        : filtered.map((order) => ({ ...order, customer: undefined })),
    });
  } catch (error) {
    console.error("Error retrieving orders:", error);
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Role check: Only kitchen staff (chef), cashier, manager, or owner can advance ticket status
    const { staff, errorResponse } = await requireStaffRole(request, ["chef", "captain", "cashier", "manager", "owner"]);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { id, kitchenStatus, orderStatus } = body;
    const targetStatus = (kitchenStatus || orderStatus) as KitchenStatus;

    if (!id) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    if (typeof body.itemId === "string") {
      if (body.isDone !== true) {
        return NextResponse.json({ error: "Dish completion must be marked done." }, { status: 400 });
      }

      if (hasDatabaseUrl()) {
        try {
          const updated = await prisma.$transaction(async (tx) => {
            const ownedOrder = await tx.order.findFirst({
              where: { id, session: { table: { restaurantId: staff!.restaurantId } } },
              select: { id: true },
            });
            if (!ownedOrder) return null;
            const result = await tx.orderItem.updateMany({
              where: { id: body.itemId, orderId: id },
              data: { isDone: true },
            });
            if (result.count === 0) return null;

            const items = await tx.orderItem.findMany({
              where: {
                orderId: id,
                isVoided: false,
                order: { session: { table: { restaurantId: staff!.restaurantId } } },
              },
            });
            const allDone = items.length > 0 && items.every((item) => item.isDone);
            return tx.order.update({
              where: { id },
              data: allDone ? { kitchenStatus: "served" } : {},
              include: { items: true },
            });
          });

          if (!updated) {
            return NextResponse.json({ error: "Dish not found for this order." }, { status: 404 });
          }

          await logAuditEvent({
            action: "ORDER_ITEM_DONE",
            actorId: staff?.staffId || "staff-kds",
            staffName: staff?.name || "Kitchen Chef",
            details: { orderId: id, itemId: body.itemId },
          });

          return NextResponse.json({
            success: true,
            order: {
              id: updated.id,
              kitchen_status: updated.kitchenStatus,
              items: updated.items.map((item) => ({ ...item, is_done: item.isDone })),
            },
          });
        } catch (err) {
          console.error("Prisma dish completion error:", err);
          return NextResponse.json({ error: "Failed to mark dish done in database." }, { status: 500 });
        }
      }

      const orders = getStoredOrders();
      const orderIndex = orders.findIndex((order) => order.id === id || String(order.order_number) === id);
      if (orderIndex === -1) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      const item = orders[orderIndex].items.find((orderItem) => orderItem.id === body.itemId);
      if (!item) {
        return NextResponse.json({ error: "Dish not found for this order." }, { status: 404 });
      }
      item.is_done = true;
      const unfinishedItems = orders[orderIndex].items.filter((orderItem) => !orderItem.is_voided);
      if (unfinishedItems.length > 0 && unfinishedItems.every((orderItem) => orderItem.is_done)) {
        orders[orderIndex].kitchen_status = "served";
        orders[orderIndex].order_status = "served";
      }
      orders[orderIndex].updated_at = new Date().toISOString();
      saveStoredOrders(orders);
      return NextResponse.json({ success: true, order: orders[orderIndex] });
    }

    if (!targetStatus) {
      return NextResponse.json({ error: "Kitchen status is required" }, { status: 400 });
    }

    if (hasDatabaseUrl()) {
      try {
        const updated = await prisma.order.update({
          where: {
            id,
            session: { table: { restaurantId: staff!.restaurantId } },
          },
          data: { kitchenStatus: targetStatus },
          include: { items: true, session: { include: { table: true } } },
        });

        await logAuditEvent({
          action: `TICKET_${targetStatus.toUpperCase()}`,
          actorId: staff?.staffId || "staff-kds",
          staffName: staff?.name || "Kitchen Chef",
          details: { orderId: id, orderNumber: updated.orderNumber, status: targetStatus },
        });

        return NextResponse.json({
          success: true,
          order: {
            ...updated,
            order_number: updated.orderNumber,
            round_number: updated.roundNumber,
            table_number: updated.session.table.tableNumber,
            kitchen_status: updated.kitchenStatus,
            order_status: updated.kitchenStatus,
          },
        });
      } catch (err) {
        console.error("Prisma PATCH error:", err);
        return NextResponse.json({ error: "Failed to update ticket status in database." }, { status: 500 });
      }
    }

    // Local fallback
    const orders = getStoredOrders();
    const orderIndex = orders.findIndex((o) => o.id === id || String(o.order_number) === id);
    if (orderIndex === -1) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    orders[orderIndex].kitchen_status = targetStatus;
    orders[orderIndex].order_status = targetStatus;
    orders[orderIndex].updated_at = new Date().toISOString();
    saveStoredOrders(orders);

    return NextResponse.json({ success: true, order: orders[orderIndex] });
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
