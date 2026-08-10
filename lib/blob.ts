import { put, del } from "@vercel/blob";

export async function uploadCardImage(id: number, file: Blob | File): Promise<string> {
  const { url } = await put(`cards/${id}.png`, file, {
    access: "public",
    contentType: "image/png",
    // A stable pathname allows retries to replace the existing image.
    addRandomSuffix: false,
  });
  return url;
}

export async function deleteCardImage(imageUrl: string): Promise<void> {
  try {
    await del(imageUrl);
  } catch {
    // if it's already gone, or the URL is stale, don't block the DB delete on this
  }
}
