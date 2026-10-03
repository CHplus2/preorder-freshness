export default function ShoppingSheet({groups,through,missingRecipes,loadedAt}) {
  return <section aria-label="Printable shopping checklist">
    <h1>Shopping checklist</h1><p>Shortages needed through {through} · Includes overdue requirements · Malaysia dates</p>
    {loadedAt && <p>Plan loaded {new Date(loadedAt).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'})} (Malaysia). Refresh before printing; orders and stock may change.</p>}
    {missingRecipes && <p className="shopping-incomplete"><strong>INCOMPLETE: some orders have no accepted recipe.</strong> Resolve those recipes before treating this as the full purchase list.</p>}
    {groups.map(g=><article key={g.key}><h2>□ {g.material} — {g.quantity} {g.unit}</h2><p>First needed: {g.earliest}</p><ul>{g.requirements.map((r,i)=><li key={i}>{r.needed_by} · order #{r.order} · {r.quantity} {g.unit}</li>)}</ul><p>Purchased: __________ {g.unit} &nbsp; Actual cost: RM __________</p></article>)}
    <p>These are projected shortages after allocating recorded stock once across outstanding orders. Buy in stages for different dates and verify shelf life through preparation. This sheet does not reserve stock, place a supplier order or update inventory.</p>
    <p>After receipt, record actual quantity, supplier, cost, storage and date evidence in Inventory. Paper ticks do not change the app.</p>
  </section>;
}
