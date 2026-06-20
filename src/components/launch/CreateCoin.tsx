import { useState } from "react";
import { launchpad } from "../../launchpad";

export function CreateCoin({
  account,
  onCancel,
  onCreated,
}: {
  account: string | null;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [image, setImage] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError("Name is required.");
    if (!/^[A-Za-z0-9]{1,10}$/.test(ticker.trim()))
      return setError("Ticker must be 1–10 letters/numbers.");
    if (image && !/^https?:\/\//.test(image.trim()))
      return setError("Image must be a valid http(s) URL.");
    setBusy(true);
    try {
      const token = await launchpad.createToken({
        name: name.trim(),
        ticker: ticker.trim(),
        image: image.trim(),
        description: description.trim(),
        creator: account || "0xanon",
      });
      onCreated(token.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create.");
      setBusy(false);
    }
  };

  return (
    <section className="grid">
      <article className="card bridge-card">
        <div className="card-head">
          <div>
            <p className="label">Launch · Robinhood Chain</p>
            <h2>Create a coin</h2>
          </div>
          <button type="button" className="secondary-button" onClick={onCancel}>
            Back
          </button>
        </div>

        <label className="input-wrap">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Robin Hood" />
        </label>
        <label className="input-wrap">
          <span>Ticker</span>
          <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="RHOOD" maxLength={10} />
        </label>
        <label className="input-wrap">
          <span>Logo image URL (optional)</span>
          <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" />
        </label>
        <label className="input-wrap">
          <span>Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's the meme?" />
        </label>

        {error ? <p className="error-text">{error}</p> : null}

        <button type="button" className="primary-button" disabled={busy} onClick={() => void submit()}>
          {busy ? "Launching…" : "Launch coin"}
        </button>
        <p className="execution-note">Mock launch — no on-chain transaction yet.</p>
      </article>

      <article className="card">
        <h3>Preview</h3>
        <div className="launch-card preview">
          <div className="launch-card-head">
            <span className="launch-logo">{(ticker || "?").slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{name || "Your coin"}</strong>
              <span className="launch-ticker">${(ticker || "TICKER").toUpperCase()}</span>
            </div>
          </div>
          <p className="launch-desc">{description || "Your description here."}</p>
        </div>
      </article>
    </section>
  );
}
