import { riskTradeoff } from "./riskTradeoff";
export default function RiskMap({ risk, scenarioRisk }) {
  const comparison = riskTradeoff(risk, scenarioRisk);
  const maxWaste = Math.max(
    1,
    risk.expiring_unused_kg,
    scenarioRisk?.expiring_unused_kg ?? 0,
  );
  const maxGap = Math.max(
    1,
    risk.shortfall_kg,
    scenarioRisk?.shortfall_kg ?? 0,
  );
  const x = (r) => 60 + (r.expiring_unused_kg / maxWaste) * 220;
  const y = (r) => 220 - (r.shortfall_kg / maxGap) * 150;
  return (
    <section
      className="fc-risk-map"
      aria-label="Waste and shortage tradeoff map"
    >
      <div>
        <span className="pd-eyebrow">TWO RISKS, ONE DECISION</span>
        <h4>Where does the scenario move us?</h4>
        <p>
          {comparison
            ? comparison.summary
            : "Calculate a promotion scenario to compare its waste and shortage exposure."}
        </p>
        <p>
          {comparison
            ? comparison.caution
            : "The baseline point shows the returned ingredient quantities."}
        </p>
        <p className="pd-note">
          Closer to the lower-left means less of both quantity risks. Axes scale
          independently for this ingredient. This is not a financial ranking or
          an uncertainty range.
        </p>
      </div>
      <figure>
        <svg
          viewBox="0 0 350 280"
          role="img"
          aria-label={`Baseline: ${risk.expiring_unused_kg} kg potential waste, ${risk.shortfall_kg} kg shortage.${scenarioRisk ? ` Promotion: ${scenarioRisk.expiring_unused_kg} kg potential waste, ${scenarioRisk.shortfall_kg} kg shortage.` : " Promotion unavailable."}`}
        >
          <rect x="60" y="65" width="225" height="155" rx="12" fill="#f5e5d2" />
          <path
            d="M60 65v155h225"
            fill="none"
            stroke="#627763"
            strokeWidth="2"
          />
          <path
            d="M60 140h225M170 65v155"
            stroke="#cabb9e"
            strokeDasharray="4 4"
          />
          <text x="60" y="244">
            0
          </text>
          <text x="270" y="244" textAnchor="end">
            {maxWaste} kg
          </text>
          <text x="170" y="269" textAnchor="middle">
            Potential waste →
          </text>
          <text
            x="17"
            y="145"
            textAnchor="middle"
            transform="rotate(-90 17 145)"
          >
            Shortage exposure →
          </text>
          <text x="50" y="72" textAnchor="end">
            {maxGap}
          </text>
          <circle
            cx={x(risk)}
            cy={y(risk)}
            r="9"
            fill="#3e624b"
            stroke="#fffdf7"
            strokeWidth="3"
          />
          {scenarioRisk && (
            <rect
              x={x(scenarioRisk) - 7}
              y={y(scenarioRisk) - 7}
              width="14"
              height="14"
              fill="#a55b32"
              stroke="#fffdf7"
              strokeWidth="2"
              transform={`rotate(45 ${x(scenarioRisk)} ${y(scenarioRisk)})`}
            />
          )}
        </svg>
        <figcaption>
          ● Baseline · ◆ Promotion{" "}
          {scenarioRisk ? "(hypothetical flags)" : "unavailable"}. Overlapping
          points mean equal quantities.
        </figcaption>
      </figure>
    </section>
  );
}
