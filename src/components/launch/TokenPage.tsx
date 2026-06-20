export function TokenPage({ id, account, onBack }: { id: string; account: string | null; onBack: () => void }) {
  return <div className="card">Token {id} {account} <button onClick={onBack}>back</button></div>;
}
