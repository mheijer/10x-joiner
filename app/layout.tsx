import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "The Next 10x Joiner",
  description: "Find the rocketship startups that fit you, scored with HBS LTV frameworks.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
