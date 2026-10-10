import { NavLink } from "react-router-dom";
import "./restaurantStations.css";
function StationArt({ kind }) {
  return (
    <svg viewBox="0 0 160 120" className="fc-station-art" aria-hidden="true">
      <ellipse cx="80" cy="106" rx="65" ry="9" fill="#304b3c15" />
      <path
        d="m12 73 70-27 65 30-70 31Z"
        fill="#e7d2a6"
        stroke="#b8a17c"
        strokeWidth="2"
      />
      {kind === "inventory" ? (
        <>
          <path
            d="m54 26 54 9v62l-54-16Z"
            fill="#dce9cf"
            stroke="#597554"
            strokeWidth="3"
          />
          <path
            d="m108 35 15-8v63l-15 7Z"
            fill="#9eb993"
            stroke="#597554"
            strokeWidth="2"
          />
          <path
            d="m54 26 14-7 55 8-15 8Z"
            fill="#edf2e6"
            stroke="#597554"
            strokeWidth="2"
          />
          <path
            d="m55 49 52 12m-42-23v10m0 17v15"
            stroke="#597554"
            strokeWidth="3"
          />
          <path d="m84 68 12 3v10l-12-3Z" fill="#fff9eb" />
        </>
      ) : kind === "forecast" ? (
        <>
          <path
            d="m30 68 70-23 37 19-69 28Z"
            fill="#fffcf4"
            stroke="#8c6c48"
            strokeWidth="3"
          />
          <path
            d="m30 68 38 24v18l-38-23Zm38 24 69-28v17l-69 29Z"
            fill="#c6a478"
            stroke="#8c6c48"
            strokeWidth="2"
          />
          <path
            d="M61 19h58v47H61Z"
            fill="#446c55"
            stroke="#b8996b"
            strokeWidth="4"
          />
          <path
            d="M72 32h34m-34 10h25m-25 10h29"
            stroke="#f6edda"
            strokeWidth="3"
          />
          <ellipse
            cx="48"
            cy="65"
            rx="11"
            ry="5"
            fill="#d6dfc3"
            stroke="#688364"
            strokeWidth="2"
          />
        </>
      ) : (
        <>
          <path
            d="m27 61 70-24 38 22-70 28Z"
            fill="#fff9eb"
            stroke="#8c6c48"
            strokeWidth="3"
          />
          <path
            d="m27 61 38 26v23l-38-26Zm38 26 70-28v22l-70 29Z"
            fill="#c6a478"
            stroke="#8c6c48"
            strokeWidth="2"
          />
          <ellipse cx="92" cy="52" rx="19" ry="8" fill="#688364" />
          <path
            d="M73 52v12q19 13 38 0V52"
            fill="#a4b792"
            stroke="#466651"
            strokeWidth="2"
          />
          <path
            d="M80 39q-9-9 1-17m11 15q-8-8 1-17"
            fill="none"
            stroke="#93a989"
            strokeWidth="3"
            className="fc-station-steam"
          />
          <path d="m41 66 16-6 17 7-16 7Z" fill="#dce9cf" />
        </>
      )}
    </svg>
  );
}
export default function RestaurantStations({
  params,
  baseline,
  status,
  isFixture,
  isLocal = false,
}) {
  const available = status === "ready" && baseline;
  const unavailable =
    status === "error"
      ? "Evidence unavailable"
      : status === "empty"
        ? "No center data"
        : "Waiting for API data";
  const stations = [
    {
      id: "decisions",
      name: "Kitchen",
      label: "Decision assistant",
      detail: available
        ? `${baseline.ingredient_risks.filter((r) => r.risk_type !== "none").length} planning issues to review`
        : unavailable,
    },
    {
      id: "inventory",
      name: "Fridge & stock room",
      label: "Inventory evidence",
      detail: available
        ? `${baseline.ingredient_risks.length} ingredient records · ${isLocal ? "database stock" : "simulated"}`
        : unavailable,
    },
    {
      id: "forecast",
      name: "Order counter",
      label: isLocal ? "Confirmed preorders" : "Demand analytics",
      detail: available
        ? isLocal ? `${baseline.coverage.included_orders} included orders · accepted recipes` : `${baseline.meal_forecasts.length} external meal forecasts`
        : unavailable,
    },
  ];
  return (
    <nav className="fc-restaurant-stations" aria-label="Restaurant stations">
      <div className="fc-stations-heading">
        <span className="pantry-kicker">EXPLORE YOUR LITTLE KITCHEN</span>
        <p>Inspect the stock. Understand demand. Work through a decision.</p>
      </div>
      <div className="fc-stations-lane">
        {stations.map((s) => (
          <NavLink
            key={s.id}
            to={{
              pathname: `/admin/ai/${s.id}`,
              search: params.toString() ? `?${params}` : "",
            }}
            aria-label={s.label}
            className="fc-station"
          >
            <StationArt kind={s.id} />
            <div>
              <span className="fc-station-name">{s.name}</span>
              <strong>{s.label}</strong>
              <small>{s.detail}</small>
            </div>
            <span className="fc-station-door" aria-hidden="true">
              Enter →
            </span>
          </NavLink>
        ))}
      </div>
      <p className="fc-stations-caption">
        Illustrated navigation ·{" "}
        {isLocal ? "database preorder and stock evidence; no demand model used" : isFixture
          ? "frontend fixtures, no model run"
          : "API demand with simulated stock and costs"}
        . No live restaurant activity is shown.
      </p>
    </nav>
  );
}
