export function isAllowedBlobUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname.endsWith(".public.blob.vercel-storage.com") ||
       url.hostname.endsWith(".private.blob.vercel-storage.com"));
  } catch {
    return false;
  }
}
