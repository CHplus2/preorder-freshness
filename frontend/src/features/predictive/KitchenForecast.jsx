import { useEffect, useState } from "react";
import { loadLocalForecast } from "./localApi";

export default function KitchenForecast({ revision = 0 }) {
  const [result, setState] = useState({});
  const state = result.revision === revision ? result : { loading: true };
  useEffect(() => {
    const controller = new AbortController();
    loadLocalForecast({ signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ revision, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ revision, error: error.message });
      });
    return () => controller.abort();
  }, [revision]);
  const data = state.data;
  return (
    <section className="pd-card" aria-label="Kitchen demand forecast">
      <h2>Kitchen demand forecast</h2>
      <p>
        Paid, delivered portions grouped by delivery week. Orders without a
        delivery date use their preorder date as a marked reporting estimate.
      </p>
      {state.loading && <p role="status">Evaluating kitchen history…</p>}
      {state.error && <p role="alert">{state.error}</p>}
      {data && (
        <>
          <p className="pd-note">
            This aggregate forecast cannot identify which dishes will use an
            expiring ingredient. Confirmed bookings below remain separate; do
            not add the forecast to them.
          </p>
          <p>
            {data.eligible_orders} historical orders · {data.history_weeks}{" "}
            completed weeks · {data.estimated_date_orders} estimated dates
          </p>
          {data.next_week_portions === null ? (
            <p role="status">
              No eligible historical sales yet. A forecast needs paid, delivered
              orders from completed weeks. Current bookings are shown separately
              below.
            </p>
          ) : (
            <>
              <p>
                <strong>{data.next_week_portions} portions</strong> estimated
                for the full delivery week starting {data.forecast_week_start}.
              </p>
              <p>
                Method: {data.selected_method.replaceAll("_", " ")}.{" "}
                {data.status === "baseline_only"
                  ? "Moving-average baseline only; at least 14 completed weeks are needed for model evaluation."
                  : "Selected on earlier validation weeks, then tested on the latest held-out weeks."}
              </p>
            </>
          )}
          {data.evaluation && (
            <div className="pd-table-wrap">
              <table>
                <caption>
                  Chronological test · {data.evaluation.test_start}–
                  {data.evaluation.test_end} · portions per week
                </caption>
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>MAE</th>
                    <th>WAPE</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.evaluation.test).map(
                    ([method, score]) => (
                      <tr key={method}>
                        <th>{method.replaceAll("_", " ")}</th>
                        <td>{score.mae_portions_per_week}</td>
                        <td>
                          {score.wape_percent === null
                            ? "Undefined: zero actual sales"
                            : `${score.wape_percent}%`}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              <p>
                {data.evaluation.train_weeks} training weeks ·{" "}
                {data.evaluation.validation_weeks} validation weeks ·{" "}
                {data.evaluation.test_weeks} test weeks. Rolling one-week
                forecasts use only earlier observations.
              </p>
            </div>
          )}
          <details>
            <summary>Prepared history and assumptions</summary>
            <ul>
              {data.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <div className="pd-table-wrap">
              <table>
                <caption>Recorded sales by effective delivery week</caption>
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Orders</th>
                    <th>Portions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((row) => (
                    <tr key={row.week_start}>
                      <td>{row.week_start}</td>
                      <td>{row.orders}</td>
                      <td>{row.portions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
