import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Terms · Blue Collar MCP" };

const P = ({ h, children }: { h: string; children: React.ReactNode }) => (
  <section className="mt-8"><h2 className="text-xl font-semibold">{h}</h2><p className="mt-2 text-ink-2">{children}</p></section>
);

export default function Terms() {
  return (
    <>
      <PageHeader title="Terms" sub="Plain English. Last updated November 2026." />
      <div className="max-w-2xl pb-12">
        <P h="What this is">Blue Collar MCP helps contractors see their permits and inspections, and later book inspections, from Claude and a dashboard. It acts for you on city portals with the login you give it.</P>
        <P h="Your responsibility">You must be allowed to use the portal accounts you connect. Check anything important with the city. Permit data can be late or wrong, and we can't promise the city's records match what we show.</P>
        <P h="Changes and downtime">Cities change their sites and a connection can break. We work to fix breaks quickly but can't promise the service is always up.</P>
        <P h="Liability">The service is provided as is. We aren't liable for missed inspections, fees or delays.</P>
        <P h="Ending">You can stop any time. We may suspend accounts that abuse the service.</P>
        <P h="Contact">Questions: trace@walters-renovations.com</P>
      </div>
    </>
  );
}
