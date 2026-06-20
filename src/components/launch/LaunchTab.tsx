import { useState } from "react";
import { LaunchFeed } from "./LaunchFeed";
import { CreateCoin } from "./CreateCoin";
import { TokenPage } from "./TokenPage";

type View =
  | { name: "feed" }
  | { name: "create" }
  | { name: "token"; id: string };

export function LaunchTab({ account }: { account: string | null }) {
  const [view, setView] = useState<View>({ name: "feed" });

  if (view.name === "create") {
    return (
      <CreateCoin
        account={account}
        onCancel={() => setView({ name: "feed" })}
        onCreated={(id) => setView({ name: "token", id })}
      />
    );
  }
  if (view.name === "token") {
    return (
      <TokenPage
        id={view.id}
        account={account}
        onBack={() => setView({ name: "feed" })}
      />
    );
  }
  return (
    <LaunchFeed
      onCreate={() => setView({ name: "create" })}
      onOpen={(id) => setView({ name: "token", id })}
    />
  );
}
