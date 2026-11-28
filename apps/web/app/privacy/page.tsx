import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy · Blue Collar MCP" };

const P = ({ h, children }: { h: string; children: React.ReactNode }) => (
  <section className="mt-8"><h2 className="text-xl font-semibold">{h}</h2><p className="mt-2 text-ink-2">{children}</p></section>
);

export default function Privacy() {
  return (
    <>
      <PageHeader title="Privacy" sub="Plain English. Last updated November 2026." />
      <div className="max-w-2xl pb-12">
        <P h="What we collect">Your email and company name when you sign up. If you use Google sign-in, we only receive your name and email from Google. Nothing else from your Google account.</P>
        <P h="Your city portal logins">When you connect a city permit portal, the login is stored encrypted and used only to read your permits and inspections for you. We never show it back or put it in chat.</P>
        <P h="Your permit data">We read your permits and inspections from the city portal on your behalf and keep a short-lived copy so the dashboard and Claude load fast. It is only visible to your company.</P>
        <P h="What we don't do">We don't sell your data, show ads, or share it with anyone except the services needed to run the product.</P>
        <P h="Deleting your data">Email us and we will delete your account and everything stored for it.</P>
        <P h="Contact">Questions: trace@walters-renovations.com</P>
      </div>
    </>
  );
}
