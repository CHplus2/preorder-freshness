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
      className="fc-check-before fc-verification"
      aria-label="Manager review checklist"
    >
      <h3>Before you act</h3>
      <p>
        Record what you have reviewed outside FreshCast. These checkmarks are
        your notes; the system cannot verify these facts.
      </p>
      <p role="status">
        {reviewed.length} of {reviewChecks.length} checks marked reviewed · no
        action approved
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
      <label className="fc-verification-note">
        Manager handoff note (optional)
        <textarea
          rows="3"
          maxLength="1000"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="For example: confirm supplier availability before ordering."
        />
      </label>
      <p className="pd-note">
        Notes are local to this ingredient review and included in the downloaded
        draft. They are cleared on a new forecast or page reload. No action has
        been executed.
      </p>
    </section>
  );
}
