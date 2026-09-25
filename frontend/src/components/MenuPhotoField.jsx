import { useId, useState } from "react";
import "./MenuPhotoField.css";

export default function MenuPhotoField({ value, onChange }) {
  const id = useId();
  const [failedUrl, setFailedUrl] = useState(null);
  const url = value.trim();
  const supported = /^https?:\/\//i.test(url);
  const failed = url && (!supported || failedUrl === url);

  return (
    <section className="menu-photo-field" aria-labelledby={id + "-label"}>
      <label id={id + "-label"} htmlFor={id}>Menu photo URL</label>
      <input id={id} type="url" inputMode="url" value={value}
        placeholder="https://example.com/your-food-photo.jpg"
        aria-describedby={id + "-help"}
        onChange={event => { setFailedUrl(null); onChange(event.target.value); }} />
      <p id={id + "-help"} className="menu-photo-help">
        Paste a public image link, not a webpage link. Use a photo you own or have permission to use.
      </p>
      <figure className="menu-photo-preview">
        <div className="menu-photo-frame">
          {url && !failed ? (
            <img key={url} src={url} alt="Menu photo preview"
              onError={() => setFailedUrl(url)} />
          ) : (
            <p role={failed ? "status" : undefined}>
              {failed ? "This photo could not be loaded. Check that the link opens an image without signing in." : "Your photo preview will appear here."}
            </p>
          )}
        </div>
        <figcaption>Photo preview - the full image is shown here; menu cards may crop its edges.</figcaption>
      </figure>
    </section>
  );
}
