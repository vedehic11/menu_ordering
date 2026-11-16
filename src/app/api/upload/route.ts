import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 256 * 1024;
const MIME_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
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

function hasExpectedSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/png") {
    return bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return mimeType === "image/webp" &&
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export async function POST(request: NextRequest) {
  const { errorResponse } = await requireStaffRole(request, ["manager"]);
  if (errorResponse) return errorResponse;

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 413 });
  }

  try {
    if (!(request.headers.get("content-type") || "").includes("multipart/form-data")) {
      return NextResponse.json({ error: "Upload an image using multipart form data." }, { status: 415 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image file was uploaded." }, { status: 400 });
    }
    if (!MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, and WebP images are supported." }, { status: 415 });
    }
    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Image must be between 1 byte and 5 MB." }, { status: 413 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasExpectedSignature(bytes, file.type)) {
      return NextResponse.json({ error: "The uploaded file is not a valid image of the selected type." }, { status: 415 });
    }

    const fileName = `${randomUUID()}${MIME_TYPES.get(file.type)}`;
    const uploadDirectory = getUploadsDirectory();
    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(path.join(uploadDirectory, fileName), bytes, { flag: "wx" });

    return NextResponse.json({
      success: true,
      url: `/api/uploads/${fileName}`,
      fileName,
    }, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to save image. Verify persistent upload storage is configured." }, { status: 500 });
  }
}
