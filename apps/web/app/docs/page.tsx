import type { Metadata } from "next";
import { Code, PageHeader, INSTALL } from "@/components/ui";

export const metadata: Metadata = { title: "Docs · Permit MCP" };

const tools = [
  ["list_permits", "All permits across projects and cities, filterable by status"],
  ["get_permit", "Full detail and history for one permit"],
  ["get_permit_status", "Live status from the city portal"],
  ["list_inspections", "Upcoming, passed, failed, and needed inspections"],
  ["schedule_inspection", "Request an inspection (confirmation required)"],
  ["list_required_documents", "What a city needs for a permit type"],
  ["get_jurisdiction", "Portal, fees, turnaround, and rules for a city"],
  ["get_deadlines", "Expirations, resubmittals, and inspection windows"],
];

export default function Docs() {
  return (
    <article className="max-w-3xl">
      <PageHeader title="Docs" sub="Early draft. Tools and commands may change." />

      <h2 className="mt-10 text-xl font-semibold">1. Install</h2>
      <p className="mt-2 text-muted">Add the server to Claude Code:</p>
      <div className="mt-3"><Code>{INSTALL}</Code></div>

      <h2 className="mt-10 text-xl font-semibold">2. Guided login</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
        <li>Pick the cities where you have active permits.</li>
        <li>Log into each city portal, one by one, in the terminal or a secure link.</li>
        <li>Sessions are stored in an encrypted vault. You only log in again if a session expires or asks for 2FA.</li>
      </ol>
      <p className="mt-3 text-muted">Never type a portal password into chat. Claude only sees a connection ID.</p>

      <h2 className="mt-10 text-xl font-semibold">3. Tools</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">MCP tools</caption>
          <thead className="bg-surface text-muted">
            <tr><th scope="col" className="p-3 font-medium">Tool</th><th scope="col" className="p-3 font-medium">Purpose</th></tr>
          </thead>
          <tbody>
            {tools.map(([n, d]) => (
              <tr key={n} className="border-t border-line">
                <th scope="row" className="p-3 font-mono font-normal">{n}</th>
                <td className="p-3 text-muted">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-muted">
        Writes (submit, schedule, pay) are two-phase: the tool proposes a plan, then you confirm it.
      </p>
    </article>
  );
}
