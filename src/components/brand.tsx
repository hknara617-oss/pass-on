export function Brand({ large = false }: { large?: boolean }) {
  return <div className={`signature-brand${large ? " is-large" : ""}`} aria-label="PASS ON">
    <svg className="brand-symbol" viewBox="0 0 40 40" fill="none" aria-hidden="true"><rect x="5" y="8" width="21" height="27" rx="7" transform="rotate(-9 5 8)" fill="currentColor" opacity=".24"/><rect x="13" y="4" width="22" height="29" rx="7" fill="currentColor"/><path d="M20 19h9m-4-4 4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    <span>pass<span className="brand-on">on</span><i aria-hidden="true">.</i></span>
  </div>;
}
