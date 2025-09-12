import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Homework 1",
  description: "Artificial Intelligence",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
