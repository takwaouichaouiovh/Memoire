import "./globals.css";
import type { Metadata } from "next";
import { ToastProvider } from "../components/ui/Toast";

export const metadata: Metadata = {
  title: "POSTIE — PO Copilot",
  description: "AI-powered Product Owner studio. Chat with docs, prioritize backlog, plan sprints.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
