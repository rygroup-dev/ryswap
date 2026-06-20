import { useEffect, useState } from "react";
import { launchpad, type FeedFilter, type LaunchToken } from "../../launchpad";
import { TokenCard } from "./TokenCard";

const FILTERS: { key: FeedFilter; label: string }[] = [
  { key: "trending", label: "Trending" },
  { key: "new", label: "New" },
  { key: "graduated", label: "Graduated" },
];

export function LaunchFeed({
  onCreate,
  onOpen,
}: {
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  const [filter, setFilter] = useState<FeedFilter>("trending");
  const [tokens, setTokens] = useState<LaunchToken[]>([]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void launchpad.listTokens(filter).then((t) => {
        if (active) setTokens(t);
      });
    };
    refresh();
    const unsub = launchpad.subscribe(refresh);
    return () => {
      active = false;
      unsub();
    };
  }, [filter]);

  return (
    <section className="launch-wrap">
      <div className="launch-toolbar">
        <div className="launch-filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`tab ${filter === f.key ? "tab-active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button type="button" className="primary-button launch-create-btn" onClick={onCreate}>
          + Create coin
        </button>
      </div>
      {tokens.length === 0 ? (
        <p className="execution-note">No coins here yet. Be the first — create one.</p>
      ) : (
        <div className="launch-grid">
          {tokens.map((t) => (
            <TokenCard key={t.id} token={t} onClick={() => onOpen(t.id)} />
          ))}
        </div>
      )}
    </section>
  );
}
