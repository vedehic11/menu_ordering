import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const ALLOWED_EXTENSIONS = new Map([
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

function getUploadsDirectory(): string {
  const configured = process.env.UPLOADS_DIR;
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new Error("UPLOADS_DIR must point to a persistent volume in production.");
  }
  if (process.env.NODE_ENV === "production" && configured && !path.isAbsolute(configured)) {
    throw new Error("UPLOADS_DIR must be an absolute path in production.");
  }
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), ".data", "uploads");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(filename)) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  let uploadsDirectory: string;
  try {
    uploadsDirectory = getUploadsDirectory();
  } catch (error) {
    console.error("Image storage configuration error:", error);
    return NextResponse.json({ error: "Image storage is not configured." }, { status: 503 });
  }

  try {
    const extension = path.extname(filename).toLowerCase();
    const image = await readFile(path.join(uploadsDirectory, filename));
    return new NextResponse(image, {
      headers: {
        "Content-Type": ALLOWED_EXTENSIONS.get(extension) || "application/octet-stream",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Image read error:", error);
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }
}
