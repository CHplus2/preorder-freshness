import { rescueOutcome } from "./rescueOutcome";
function Dish({ kind }) {
  return (
    <svg viewBox="0 0 180 120" aria-hidden="true">
      <ellipse cx="85" cy="95" rx="60" ry="10" fill="#344d3c20" />
      <ellipse
        cx="85"
        cy="69"
        rx="64"
        ry="30"
        fill="#fffdf7"
        stroke="#76916c"
        strokeWidth="3"
      />
      <ellipse cx="85" cy="69" rx="51" ry="22" fill="#e9ddbd" />
      <path
        d="M50 72q-9-28 19-27 13-11 23 6 25 0 22 21-24 21-64 0Z"
        fill="#c48c5e"
        stroke="#976443"
        strokeWidth="2"
      />
      <path
        d="m60 58 11 8m9-10 11 9m4 5 9 5"
        stroke="#f4c88b"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M49 74q-20-7-12-17 20-8 24 8m40 16q16-20 24-8-5 18-24 8"
        fill="#7b9c63"
      />
      {kind === "bundle" && (
        <g>
          <ellipse
            cx="142"
            cy="40"
            rx="28"
            ry="16"
            fill="#fffdf7"
            stroke="#76916c"
            strokeWidth="2"
          />
          <path d="M119 40q23-35 46 0" fill="#eadba5" />
          <path d="m138 26 6 10m7-9-6 12" stroke="#a9b57b" strokeWidth="2" />
        </g>
      )}
      {kind === "special" && (
        <g>
          <circle
            cx="145"
            cy="30"
            r="25"
            fill="#426b58"
            stroke="#fffdf7"
            strokeWidth="3"
          />
          <text
            x="145"
            y="35"
            textAnchor="middle"
            fill="#fffdf7"
            fontSize="15"
            fontWeight="700"
          >
            −20%
          </text>
        </g>
      )}
    </svg>
  );
}
export default function RescueMenu({
  choices,
  action,
  onChange,
  demandOffset,
}) {
  return (
    <fieldset className="fc-rescue-menu">
      <legend>Choose a fictional action</legend>
      <div className="fc-rescue-menu-cards">
        {choices.map((plan) => {
          const outcome = rescueOutcome(plan, demandOffset);
          return (
            <label
              key={plan.id}
              className={action === plan.id ? "selected" : ""}
            >
              <input
                type="radio"
                name="rescue-action"
                aria-label={plan.name}
                checked={action === plan.id}
                onChange={() => onChange(plan.id)}
              />
              <Dish kind={plan.id} />
              <strong>{plan.name}</strong>
              <span className="fc-menu-price">
                RM {plan.price} <small>assumed sale price</small>
              </span>
              <span>
                {outcome.sales} assumed sold · {outcome.unsold} unsold
              </span>
              <small>
                Side RM {plan.side}/sale · setup RM {plan.setup}
              </small>
              {plan.id === "bundle" && (
                <span className="fc-menu-suggestion">
                  Suggested in this authored story
                </span>
              )}
            </label>
          );
        })}
      </div>
      <p className="pd-note">
        Illustrated dishes are decorative. Prices, costs and sales are fictional
        assumptions; no verified menu mapping is supplied.
      </p>
    </fieldset>
  );
}
