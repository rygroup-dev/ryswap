export function LaunchFeed({ onCreate, onOpen }: { onCreate: () => void; onOpen: (id: string) => void }) {
  return <div className="card" onClick={() => onOpen("")}>Feed placeholder <button onClick={onCreate}>Create</button></div>;
}
