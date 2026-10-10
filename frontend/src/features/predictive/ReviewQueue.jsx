import { useState } from "react";
import "./reviewQueue.css";

export default function ReviewQueue({ risks, selected, onSelect, isFixture }) {
  const [queued, setQueued] = useState([]);
  const current = risks.find((risk) => risk.ingredient_id === selected);
  const next = risks.find(
    (risk) =>
      !queued.includes(risk.ingredient_id) && risk.ingredient_id !== selected,
  );
  return (
    <section className="fc-review-queue" aria-label="Kitchen review queue">
      <header>
        <div>
          <span className="pd-eyebrow">
            MANAGER’S PLANNING BOARD ·{" "}
            {isFixture ? "FRONTEND FIXTURES" : "SIMULATED OPERATIONS"}
          </span>
          <h2>Your kitchen review queue</h2>
          <p>
            Pin problems to revisit together before making a purchasing or menu
            decision.
          </p>
        </div>
        <span className="fc-queue-count" role="status">
          {queued.length} of {risks.length} queued
        </span>
      </header>
      <div className="fc-queue-controls">
        <button
          disabled={!current || queued.includes(selected)}
          onClick={() => setQueued((ids) => [...ids, selected])}
        >
          {queued.includes(selected)
            ? `${selected} is queued`
            : `Pin ${selected || "a problem"} for review`}
        </button>
        <button disabled={!next} onClick={() => onSelect(next.ingredient_id)}>
          Inspect next unqueued problem
        </button>
        <button disabled={!queued.length} onClick={() => setQueued([])}>
          Clear review queue
        </button>
      </div>
      {queued.length ? (
        <ol className="fc-queue-tickets">
          {queued.map((id) => {
            const risk = risks.find((item) => item.ingredient_id === id);
            return (
              <li key={id}>
                <span className="pd-eyebrow">DRAFT · NEEDS VERIFICATION</span>
                <h3>{id}</h3>
                <p>{risk.action}</p>
                <dl>
                  <div>
                    <dt>Potential waste</dt>
                    <dd>{risk.expiring_unused_kg} kg</dd>
                  </div>
                  <div>
                    <dt>Shortage exposure</dt>
                    <dd>{risk.shortfall_kg} kg</dd>
                  </div>
                </dl>
                <div className="fc-queue-controls">
                  <button
                    onClick={() => onSelect(id)}
                    aria-label={`Reopen ${id} decision`}
                  >
                    Reopen evidence
                  </button>
                  <button
                    onClick={() =>
                      setQueued((ids) => ids.filter((item) => item !== id))
                    }
                    aria-label={`Remove ${id} from review queue`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="fc-queue-empty">
          Your board is empty. Inspect a problem in the kitchen, then pin it
          here.
        </p>
      )}
      <p className="pd-note">
        This queue lasts only while this decision view is open. New forecast
        data or a page reload clears it. Pinning is not approval and does not
        execute an action or reduce predicted waste.
      </p>
    </section>
  );
}
