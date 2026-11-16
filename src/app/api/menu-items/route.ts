import { NextRequest, NextResponse } from "next/server";
import { prisma, hasDatabaseUrl } from "@/lib/prisma";
import { getStoredMenuItems, saveStoredMenuItems } from "@/lib/storage";
import { MenuItem, KitchenStation } from "@/types/database";
import { requireStaffRole } from "@/lib/auth";

function hasValidNutrition(body: Record<string, unknown>) {
  const values = [
    [body.calories, true],
    [body.protein_grams, false],
    [body.carbs_grams, false],
    [body.fat_grams, false],
  ] as const;

  return values.every(([value, integerOnly]) => {
    if (value === undefined || value === null) return true;
    return typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      (!integerOnly || Number.isInteger(value));
  });
}

export async function GET(request: NextRequest) {
  try {
    const { staff, errorResponse } = await requireStaffRole(request, ["manager"]);
    if (errorResponse) return errorResponse;

    if (hasDatabaseUrl()) {
      try {
        const items = await prisma.menuItem.findMany({
          where: { category: { restaurantId: staff!.restaurantId } },
          orderBy: { displayOrder: "asc" },
        });
        return NextResponse.json({
          items: items.map((i) => ({
            id: i.id,
            category_id: i.categoryId,
            name: i.name,
            description: i.description,
            price_paise: i.pricePaise,
            image_url: i.imageUrl,
            calories: i.calories,
            protein_grams: i.proteinGrams,
            carbs_grams: i.carbsGrams,
            fat_grams: i.fatGrams,
            is_available: i.isAvailable,
            is_vegetarian: i.isVegetarian,
            is_chef_special: i.isChefSpecial,
            station: (i.station || "mains") as KitchenStation,
            display_order: i.displayOrder,
          })),
        });
      } catch (err) {
        console.error("Prisma menu-items error:", err);
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json({ error: "Menu service is temporarily unavailable." }, { status: 503 });
        }
      }
    }

    const items = getStoredMenuItems();
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error loading menu items:", error);
    return NextResponse.json({ error: "Failed to load menu items" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { staff, errorResponse } = await requireStaffRole(request, ["manager"]);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    if (!hasValidNutrition(body)) {
      return NextResponse.json({ error: "Nutrition values must be non-negative numbers." }, { status: 400 });
    }
    const {
      name,
      description,
      price_paise,
      priceRupees,
      category_id,
      station,
      is_vegetarian,
      is_chef_special = false,
      image_url,
      calories,
      protein_grams,
      carbs_grams,
      fat_grams,
      is_available = true,
    } = body;

    if (!name || (!price_paise && !priceRupees)) {
      return NextResponse.json(
        { error: "Dish name and price are required." },
        { status: 400 }
      );
    }

    const finalPricePaise = price_paise ? Number(price_paise) : Math.round(Number(priceRupees) * 100);
    const finalStation: KitchenStation = station || "mains";
    const finalCategoryId = category_id || "cat-1";
    const newId = `m-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    if (hasDatabaseUrl()) {
      try {
        const category = await prisma.menuCategory.findFirst({
          where: { id: finalCategoryId, restaurantId: staff!.restaurantId },
          select: { id: true },
        });
        if (!category) {
          return NextResponse.json({ error: "Menu category not found." }, { status: 404 });
        }
        const created = await prisma.menuItem.create({
          data: {
            id: newId,
            categoryId: finalCategoryId,
            name,
            description: description || null,
            pricePaise: finalPricePaise,
            imageUrl: image_url || null,
            calories: calories ?? null,
            proteinGrams: protein_grams ?? null,
            carbsGrams: carbs_grams ?? null,
            fatGrams: fat_grams ?? null,
            station: finalStation,
            isVegetarian: Boolean(is_vegetarian),
            isChefSpecial: Boolean(is_chef_special),
            isAvailable: Boolean(is_available),
            displayOrder: 99,
          },
        });
        return NextResponse.json({ success: true, item: created }, { status: 201 });
      } catch (err) {
        console.error("Prisma create menu-item error:", err);
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json({ error: "Menu service is temporarily unavailable." }, { status: 503 });
        }
      }
    }

    const items = getStoredMenuItems();
    const newItem: MenuItem = {
      id: newId,
      category_id: finalCategoryId,
      name,
      description: description || null,
      price_paise: finalPricePaise,
      image_url: image_url || null,
      calories: calories ?? null,
      protein_grams: protein_grams ?? null,
      carbs_grams: carbs_grams ?? null,
      fat_grams: fat_grams ?? null,
      station: finalStation,
      is_vegetarian: Boolean(is_vegetarian),
      is_chef_special: Boolean(is_chef_special),
      is_available: Boolean(is_available),
      display_order: items.length + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    items.push(newItem);
    saveStoredMenuItems(items);

    return NextResponse.json({ success: true, item: newItem }, { status: 201 });
  } catch (error) {
    console.error("Error creating menu item:", error);
    return NextResponse.json({ error: "Failed to create menu item" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { staff, errorResponse } = await requireStaffRole(request, ["manager"]);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    if (!hasValidNutrition(body)) {
      return NextResponse.json({ error: "Nutrition values must be non-negative numbers." }, { status: 400 });
    }
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    // Fast-path: simple 86 availability toggle
    if (Object.keys(body).length === 2 && typeof body.isAvailable === "boolean") {
      const isAvailable = body.isAvailable;

      if (hasDatabaseUrl()) {
        try {
          const result = await prisma.menuItem.updateMany({
            where: { id, category: { restaurantId: staff!.restaurantId } },
            data: { isAvailable },
          });
          if (!result.count) return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
          const updated = await prisma.menuItem.findUnique({ where: { id } });
          return NextResponse.json({ success: true, item: updated });
        } catch (err) {
          console.error("Prisma update menu-item error:", err);
          if (process.env.NODE_ENV === "production") {
            return NextResponse.json({ error: "Menu service is temporarily unavailable." }, { status: 503 });
          }
        }
      }

      const items = getStoredMenuItems();
      const index = items.findIndex((i) => i.id === id);
      if (index === -1) {
        return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
      }

      items[index].is_available = isAvailable;
      saveStoredMenuItems(items);

      return NextResponse.json({ success: true, item: items[index] });
    }

    // Fast-path: simple Chef's Special toggle
    if (typeof body.isChefSpecial === "boolean") {
      const isChefSpecial = body.isChefSpecial;

      if (hasDatabaseUrl()) {
        try {
          const result = await prisma.menuItem.updateMany({
            where: { id, category: { restaurantId: staff!.restaurantId } },
            data: { isChefSpecial },
          });
          if (!result.count) return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
          const updated = await prisma.menuItem.findUnique({ where: { id } });
          return NextResponse.json({ success: true, item: updated });
        } catch (err) {
          console.error("Prisma update chef-special error:", err);
          if (process.env.NODE_ENV === "production") {
            return NextResponse.json({ error: "Menu service is temporarily unavailable." }, { status: 503 });
          }
        }
      }

      const items = getStoredMenuItems();
      const index = items.findIndex((i) => i.id === id);
      if (index === -1) {
        return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
      }

      items[index].is_chef_special = isChefSpecial;
      saveStoredMenuItems(items);

      return NextResponse.json({ success: true, item: items[index] });
    }

    // Full item update
    const {
      name,
      description,
      price_paise,
      priceRupees,
      category_id,
      station,
      is_vegetarian,
      is_chef_special,
      image_url,
      calories,
      protein_grams,
      carbs_grams,
      fat_grams,
      is_available,
    } = body;

    const finalPricePaise = price_paise !== undefined
      ? Number(price_paise)
      : priceRupees !== undefined
      ? Math.round(Number(priceRupees) * 100)
      : undefined;

    if (hasDatabaseUrl()) {
      try {
        if (category_id !== undefined) {
          const category = await prisma.menuCategory.findFirst({
            where: { id: category_id, restaurantId: staff!.restaurantId },
            select: { id: true },
          });
          if (!category) {
            return NextResponse.json({ error: "Menu category not found." }, { status: 404 });
          }
        }
        const result = await prisma.menuItem.updateMany({
          where: { id, category: { restaurantId: staff!.restaurantId } },
          data: {
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
            ...(finalPricePaise !== undefined && { pricePaise: finalPricePaise }),
            ...(category_id !== undefined && { categoryId: category_id }),
            ...(station !== undefined && { station }),
            ...(is_vegetarian !== undefined && { isVegetarian: Boolean(is_vegetarian) }),
            ...(is_chef_special !== undefined && { isChefSpecial: Boolean(is_chef_special) }),
            ...(image_url !== undefined && { imageUrl: image_url }),
            ...(calories !== undefined && { calories }),
            ...(protein_grams !== undefined && { proteinGrams: protein_grams }),
            ...(carbs_grams !== undefined && { carbsGrams: carbs_grams }),
            ...(fat_grams !== undefined && { fatGrams: fat_grams }),
            ...(is_available !== undefined && { isAvailable: Boolean(is_available) }),
          },
        });
        if (!result.count) return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
        const updated = await prisma.menuItem.findUnique({ where: { id } });
        return NextResponse.json({ success: true, item: updated });
      } catch (err) {
        console.error("Prisma full update error:", err);
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json({ error: "Menu service is temporarily unavailable." }, { status: 503 });
        }
      }
    }

    const items = getStoredMenuItems();
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    }

    items[index] = {
      ...items[index],
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(finalPricePaise !== undefined && { price_paise: finalPricePaise }),
      ...(category_id !== undefined && { category_id }),
      ...(station !== undefined && { station }),
      ...(is_vegetarian !== undefined && { is_vegetarian: Boolean(is_vegetarian) }),
      ...(is_chef_special !== undefined && { is_chef_special: Boolean(is_chef_special) }),
      ...(image_url !== undefined && { image_url }),
      ...(calories !== undefined && { calories }),
      ...(protein_grams !== undefined && { protein_grams }),
      ...(carbs_grams !== undefined && { carbs_grams }),
      ...(fat_grams !== undefined && { fat_grams }),
      ...(is_available !== undefined && { is_available: Boolean(is_available) }),
      updated_at: new Date().toISOString(),
    };

    saveStoredMenuItems(items);

    return NextResponse.json({ success: true, item: items[index] });
  } catch (error) {
    console.error("Error updating menu item:", error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { staff, errorResponse } = await requireStaffRole(request, ["manager"]);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    if (hasDatabaseUrl()) {
      try {
        const result = await prisma.menuItem.deleteMany({
          where: { id, category: { restaurantId: staff!.restaurantId } },
        });
        if (!result.count) return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
        return NextResponse.json({ success: true });
      } catch (err) {
        console.error("Prisma delete menu-item error:", err);
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json({ error: "Menu service is temporarily unavailable." }, { status: 503 });
        }
      }
    }

    let items = getStoredMenuItems();
    items = items.filter((i) => i.id !== id);
    saveStoredMenuItems(items);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting menu item:", error);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
