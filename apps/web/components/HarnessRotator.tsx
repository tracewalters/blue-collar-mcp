// Rolls vertically through the AI tools this works with. Pure CSS; stops when the user prefers less motion.
const P = { fill: "currentColor", "aria-hidden": true, className: "h-[0.8em] w-[0.8em] shrink-0" } as const;

// Anthropic mark (Simple Icons). ChatGPT and Grok are simple stand-ins: swap in the official files when we have them.
const Anthropic = () => <svg viewBox="0 0 24 24" {...P}><path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" /></svg>;
const ChatGPT = () => <svg viewBox="0 0 24 24" {...P}><g fill="none" stroke="currentColor" strokeWidth="2">{[0, 60, 120].map((r) => <rect key={r} x="6.5" y="1.5" width="11" height="21" rx="5.5" transform={`rotate(${r} 12 12)`} />)}</g></svg>;
const Grok = () => <svg viewBox="0 0 24 24" {...P}><g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="13" r="7" /><path d="M19 3 9 21" /></g></svg>;
const Cursor = () => <svg viewBox="0 0 24 24" {...P}><path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" /></svg>;
const Any = () => <svg viewBox="0 0 24 24" {...P}><g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 3v5M15 3v5M6 8h12v4a6 6 0 0 1-12 0zM12 18v3" /></g></svg>;

const items = [
  { name: "Claude", Icon: Anthropic },
  { name: "ChatGPT", Icon: ChatGPT },
  { name: "Grok", Icon: Grok },
  { name: "Cursor", Icon: Cursor },
  { name: "any AI app", Icon: Any },
];

export function HarnessRotator() {
  return (
    <span className="harness relative inline-block h-[1.15em] overflow-hidden align-bottom" style={{ ["--n" as string]: items.length }}>
      <span className="sr-only">Claude, ChatGPT, Grok, Cursor or any AI app</span>
      <span className="harness-track flex flex-col" aria-hidden>
        {[...items, items[0]].map(({ name, Icon }, i) => (
          <span key={i} className="flex h-[1.15em] items-center gap-[0.25em] whitespace-nowrap"><Icon />{name}</span>
        ))}
      </span>
    </span>
  );
}
