const reviewChecks = [
  "Actual batches, handling and expiry",
  "Verified recipes and ingredient mappings",
  "Supplier prices and delivery lead time",
];
export default function VerificationChecklist({
  reviewed,
  setReviewed,
  note,
  setNote,
}) {
  return (
    <section
      className="fc-review-checklist fc-verification"
      aria-label="Manager review checklist"
    >
      <h3>Your checks</h3>
      <p>
        Mark the checks you completed. FreshCast does not verify them.
      </p>
      <p role="status">
        {reviewed.length} of {reviewChecks.length} reviewed
      </p>
      {reviewChecks.map((label) => (
        <label className="fc-verification-check" key={label}>
          <input
            type="checkbox"
            checked={reviewed.includes(label)}
            onChange={(event) =>
              setReviewed((items) =>
                event.target.checked
                  ? [...items, label]
                  : items.filter((item) => item !== label),
              )
            }
          />
          <span>{label}</span>
        </label>
      ))}
      <details className="fc-review-note"><summary>Add a note (optional)</summary>
      <label className="fc-verification-note">
        Review note
        <textarea
          rows="3"
          maxLength="1000"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="For example: confirm supplier availability before ordering."
        />
      </label>
      <p className="pd-note">Unsaved notes reset on a new forecast or page reload. They are included in your download.</p>
      </details>
    </section>
  );
}
