import {Link} from 'react-router-dom';
import {shoppingList} from '../utils/shopping';

export default function ShoppingList({rows,through,missingRecipes}) {
  const groups=shoppingList(rows,through);
  return <section aria-label="Shopping needs">
    <h2>Shopping list</h2><p>Shortages needed by {through}, combined by ingredient. Includes overdue requirements.</p>
    <p>Existing stock is allocated once across orders. Refresh the planner after receiving ingredients or changing orders.</p>
    {missingRecipes && <p role="alert">Some orders have no accepted recipe. This list is incomplete until those recipes are resolved.</p>}
    {!groups.length ? <div className="admin-empty">No recorded shortfalls due by this date.</div> : groups.map(group=><article className="admin-order-summary" key={group.key}>
      <h3>{group.material}</h3><p><strong>Buy {group.quantity} {group.unit}</strong></p>
      <p>First needed: {group.earliest} · {new Set(group.requirements.map(r=>r.order)).size} orders</p>
      <details><summary>See quantities by order and date</summary><ul>{group.requirements.map((r,i)=><li key={`${r.order}-${i}`}>{r.quantity} {r.unit} · {r.needed_by} · order #{r.order}</li>)}</ul></details>
    </article>)}
    <p>Buy in stages where dates differ, and check that each batch lasts through preparation. These totals do not reserve stock or confirm a supplier purchase.</p>
    <Link to="/admin/inventory">Record received ingredients in Inventory</Link>
  </section>;
}
