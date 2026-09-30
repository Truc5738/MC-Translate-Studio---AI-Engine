import { handleCallback } from "@vercel/queue";

export const POST = handleCallback(async (message: unknown) => {
  console.log("translation queue event", message);
});
