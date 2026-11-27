import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Start free · Blue Collar MCP" };

export default function Page() {
  return <AuthForm mode="signup" />;
}
