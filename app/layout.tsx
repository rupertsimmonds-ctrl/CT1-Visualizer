import { Analytics } from "@vercel/analytics/next";

export const metadata = { title: "City Tower 1 · Live" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
