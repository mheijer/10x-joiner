import type { ReactNode } from "react";

export const metadata = {
  title: "The Next 10x Joiner",
  description: "Find the rocketship startups that fit you, scored with HBS LTV frameworks.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
