import { lstat, open, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { readImageDimensions } from "@/shared/imageDimensions";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith("../") && !isAbsolute(rel);
}

/** Resolve through existing ancestors as well, so missing output paths cannot hide a symlink. */
export async function projectImagePath(root: string, path: string): Promise<string> {
  if (isAbsolute(path) || !path.trim()) throw new Error("Image paths must be project-relative");
  const canonicalRoot = await realpath(root);
  const target = resolve(canonicalRoot, path);
  if (!inside(canonicalRoot, target)) throw new Error("Image path is outside the project");
  let ancestor = target;
  for (;;) {
    try {
      if (!inside(canonicalRoot, await realpath(ancestor)))
        throw new Error("Image path resolves outside the project");
      return target;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      ancestor = dirname(ancestor);
    }
  }
}

export async function requireNewImagePath(root: string, path: string): Promise<void> {
  const target = await projectImagePath(root, path);
  try {
    await lstat(target);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  throw new Error("Image output already exists; choose a new path");
}

/** Header-validate bounded raster bytes; never treat a text report as an image result. */
export async function readProjectImage(root: string, path: string) {
  const target = await projectImagePath(root, path);
  const file = await open(target, "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size === 0 || stat.size > MAX_IMAGE_BYTES)
      throw new Error("Image must be a nonempty file of at most 20 MiB");
    const buffer = Buffer.alloc(stat.size + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await file.read(buffer, size, buffer.length - size, null);
      if (bytesRead === 0) break;
      size += bytesRead;
    }
    if (size > stat.size)
      throw new Error("Image changed while reading; retry after the task finishes");
    const bytes = buffer.subarray(0, size);
    const mime = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "image/png"
      : bytes[0] === 255 && bytes[1] === 216
        ? "image/jpeg"
        : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
          ? "image/webp"
          : undefined;
    const base64 = bytes.toString("base64");
    const dimensions = mime && readImageDimensions(base64, { kind: "base64", mime });
    if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0)
      throw new Error("Output is not a supported raster image");
    return { path: target, mime, ...dimensions, dataUrl: `data:${mime};base64,${base64}` };
  } finally {
    await file.close();
  }
}
