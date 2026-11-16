import { NextRequest, NextResponse } from "next/server";
import { prisma, hasDatabaseUrl } from "@/lib/prisma";
import { MOCK_CATEGORIES, MOCK_RESTAURANT, MOCK_TABLES } from "@/lib/mock-data";
import { getStoredMenuItems, getStoredCarouselSlides } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (hasDatabaseUrl()) {
      try {
        const table = await prisma.diningTable.findUnique({
          where: { qrToken: token },
          include: { restaurant: true },
        });

        if (!table || !table.isActive) {
          return NextResponse.json(
            { error: "Table not found or currently inactive." },
            { status: 404 }
          );
        }

        const categories = await prisma.menuCategory.findMany({
          where: { restaurantId: table.restaurantId, isActive: true },
          include: {
            menuItems: {
              where: { isAvailable: true },
              orderBy: { displayOrder: "asc" },
            },
          },
          orderBy: { displayOrder: "asc" },
        });

        const items = categories.flatMap((c) =>
          c.menuItems.map((item) => ({
            id: item.id,
            category_id: item.categoryId,
            name: item.name,
            description: item.description,
            price_paise: item.pricePaise,
            image_url: item.imageUrl,
            calories: item.calories,
            protein_grams: item.proteinGrams,
            carbs_grams: item.carbsGrams,
            fat_grams: item.fatGrams,
            station: item.station,
            is_available: item.isAvailable,
            is_vegetarian: item.isVegetarian,
            is_chef_special: item.isChefSpecial,
            display_order: item.displayOrder,
            created_at: item.createdAt.toISOString(),
            updated_at: item.updatedAt.toISOString(),
          }))
        );

        return NextResponse.json({
          restaurant: {
            id: table.restaurant.id,
            name: table.restaurant.name,
            slug: table.restaurant.slug,
            address: table.restaurant.address,
            phone: table.restaurant.phone,
            email: table.restaurant.email,
            currency: table.restaurant.currency,
            is_open: table.restaurant.isOpen,
          },
          table: {
            id: table.id,
            table_number: table.tableNumber,
            qr_token: table.qrToken,
            is_active: table.isActive,
          },
          categories: categories.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            station: c.station,
            display_order: c.displayOrder,
            is_active: c.isActive,
          })),
          items,
          carouselSlides: (
            await prisma.carouselSlide.findMany({
              where: { restaurantId: table.restaurantId, isActive: true },
              orderBy: { displayOrder: "asc" },
            })
          ).map((slide) => ({
            id: slide.id,
            image: slide.image,
            title: slide.title,
            sub: slide.sub,
            isActive: slide.isActive,
          })),
        });
      } catch (err) {
        console.error("Prisma menu GET error:", err);
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json({ error: "Menu service is temporarily unavailable." }, { status: 503 });
        }
      }
    }

    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Menu service is not configured." }, { status: 503 });
    }

    // Resilient fallback mode
    const matchedTable = MOCK_TABLES.find((t) => t.qr_token === token);
    if (!matchedTable) {
      return NextResponse.json({ error: "Table not found or currently inactive." }, { status: 404 });
    }
    const items = getStoredMenuItems();

    return NextResponse.json({
      restaurant: MOCK_RESTAURANT,
      table: {
        ...matchedTable,
        qr_token: token,
      },
      categories: MOCK_CATEGORIES,
      items: items,
      carouselSlides: getStoredCarouselSlides(),
    });
  } catch (error) {
    console.error("Error loading menu:", error);
    return NextResponse.json(
      { error: "Internal server error loading menu." },
      { status: 500 }
    );
  }
}
