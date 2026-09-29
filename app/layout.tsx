import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MC Translate Studio",
  description: "AI translation, repair and validation studio for Minecraft packs and plugins."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}