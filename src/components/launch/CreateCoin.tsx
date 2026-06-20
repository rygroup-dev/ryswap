export function CreateCoin({ account, onCancel, onCreated }: { account: string | null; onCancel: () => void; onCreated: (id: string) => void }) {
  return <div className="card">Create placeholder {account} <button onClick={onCancel}>x</button><button onClick={() => onCreated("")}>ok</button></div>;
}
