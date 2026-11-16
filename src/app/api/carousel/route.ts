import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma, hasDatabaseUrl } from "@/lib/prisma";
import {
  getStoredCarouselSlides,
  saveStoredCarouselSlides,
  CarouselSlide,
} from "@/lib/storage";
import { requireStaffRole } from "@/lib/auth";

const RESTAURANT_SLUG = "my-oh-my-andheri";

async function getRestaurantId(staffRestaurantId?: string) {
  if (staffRestaurantId) return staffRestaurantId;
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: RESTAURANT_SLUG },
    select: { id: true },
  });
  return restaurant?.id;
}

function toSlide(slide: {
  id: string;
  title: string;
  sub: string;
  image: string;
  isActive: boolean;
}): CarouselSlide {
  return {
    id: slide.id,
    title: slide.title,
    sub: slide.sub,
    image: slide.image,
    isActive: slide.isActive,
  };
}

export async function GET() {
  try {
    if (hasDatabaseUrl()) {
      const restaurantId = await getRestaurantId();
      if (!restaurantId) {
        return NextResponse.json({ error: "Restaurant is not configured." }, { status: 503 });
      }
      const slides = await prisma.carouselSlide.findMany({
        where: { restaurantId },
        orderBy: { displayOrder: "asc" },
      });
      return NextResponse.json({ slides: slides.map(toSlide) });
    }

    return NextResponse.json({ slides: getStoredCarouselSlides() });
  } catch (error) {
    console.error("Error loading carousel slides:", error);
    return NextResponse.json({ error: "Failed to load carousel slides" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { staff, errorResponse } = await requireStaffRole(request, ["manager"]);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    if (Array.isArray(body.slides)) {
      if (hasDatabaseUrl()) {
        const restaurantId = await getRestaurantId(staff!.restaurantId);
        if (!restaurantId) {
          return NextResponse.json({ error: "Restaurant is not configured." }, { status: 503 });
        }
        await prisma.$transaction(
          body.slides.map((slide: CarouselSlide, index: number) =>
            prisma.carouselSlide.updateMany({
              where: { id: slide.id, restaurantId },
              data: { displayOrder: index },
            })
          )
        );
        const slides = await prisma.carouselSlide.findMany({
          where: { restaurantId },
          orderBy: { displayOrder: "asc" },
        });
        return NextResponse.json({ success: true, slides: slides.map(toSlide) });
      }
      saveStoredCarouselSlides(body.slides);
      return NextResponse.json({ success: true, slides: body.slides });
    }

    const { title, sub, image } = body;
    if (typeof title !== "string" || !title.trim() || typeof image !== "string" || !image.trim()) {
      return NextResponse.json({ error: "Title and Image URL are required" }, { status: 400 });
    }

    if (hasDatabaseUrl()) {
      const restaurantId = await getRestaurantId(staff!.restaurantId);
      if (!restaurantId) {
        return NextResponse.json({ error: "Restaurant is not configured." }, { status: 503 });
      }
      const displayOrder = await prisma.carouselSlide.count({ where: { restaurantId } });
      const created = await prisma.carouselSlide.create({
        data: {
          restaurantId,
          title: title.trim(),
          sub: typeof sub === "string" && sub.trim() ? sub.trim() : "Featured Special",
          image: image.trim(),
          displayOrder,
        },
      });
      return NextResponse.json({ success: true, slide: toSlide(created) }, { status: 201 });
    }

    const slides = getStoredCarouselSlides();
    const newSlide: CarouselSlide = {
      id: randomUUID(),
      title: title.trim(),
      sub: typeof sub === "string" && sub.trim() ? sub.trim() : "Featured Special",
      image: image.trim(),
      isActive: true,
    };
    slides.push(newSlide);
    saveStoredCarouselSlides(slides);
    return NextResponse.json({ success: true, slide: newSlide, slides }, { status: 201 });
  } catch (error) {
    console.error("Error creating carousel slide:", error);
    return NextResponse.json({ error: "Failed to create carousel slide" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { staff, errorResponse } = await requireStaffRole(request, ["manager"]);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { id, title, sub, image, isActive } = body;
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Slide ID is required" }, { status: 400 });
    }

    if (hasDatabaseUrl()) {
      const restaurantId = await getRestaurantId(staff!.restaurantId);
      if (!restaurantId) {
        return NextResponse.json({ error: "Restaurant is not configured." }, { status: 503 });
      }
      const existing = await prisma.carouselSlide.findFirst({ where: { id, restaurantId } });
      if (!existing) return NextResponse.json({ error: "Slide not found" }, { status: 404 });
      const updated = await prisma.carouselSlide.update({
        where: { id },
        data: {
          ...(typeof title === "string" && { title: title.trim() }),
          ...(typeof sub === "string" && { sub: sub.trim() }),
          ...(typeof image === "string" && { image: image.trim() }),
          ...(typeof isActive === "boolean" && { isActive }),
        },
      });
      return NextResponse.json({ success: true, slide: toSlide(updated) });
    }

    const slides = getStoredCarouselSlides();
    const index = slides.findIndex((slide) => slide.id === id);
    if (index === -1) return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    slides[index] = {
      ...slides[index],
      ...(typeof title === "string" && { title: title.trim() }),
      ...(typeof sub === "string" && { sub: sub.trim() }),
      ...(typeof image === "string" && { image: image.trim() }),
      ...(typeof isActive === "boolean" && { isActive }),
    };
    saveStoredCarouselSlides(slides);
    return NextResponse.json({ success: true, slide: slides[index], slides });
  } catch (error) {
    console.error("Error updating carousel slide:", error);
    return NextResponse.json({ error: "Failed to update carousel slide" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { staff, errorResponse } = await requireStaffRole(request, ["manager"]);
    if (errorResponse) return errorResponse;

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Slide ID is required" }, { status: 400 });

    if (hasDatabaseUrl()) {
      const restaurantId = await getRestaurantId(staff!.restaurantId);
      if (!restaurantId) {
        return NextResponse.json({ error: "Restaurant is not configured." }, { status: 503 });
      }
      const result = await prisma.carouselSlide.deleteMany({ where: { id, restaurantId } });
      if (!result.count) return NextResponse.json({ error: "Slide not found" }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    const slides = getStoredCarouselSlides();
    const remaining = slides.filter((slide) => slide.id !== id);
    if (remaining.length === slides.length) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }
    saveStoredCarouselSlides(remaining);
    return NextResponse.json({ success: true, slides: remaining });
  } catch (error) {
    console.error("Error deleting carousel slide:", error);
    return NextResponse.json({ error: "Failed to delete carousel slide" }, { status: 500 });
  }
}
