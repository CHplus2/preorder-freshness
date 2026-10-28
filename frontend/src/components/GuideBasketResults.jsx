import {useId} from 'react';
import {Link} from 'react-router-dom';
import {quantityLabel,unitLabel} from '../utils/sellingDetails';
import {moneyCents} from '../utils/guideBudget';
import MenuRecommendationCard from './MenuRecommendationCard';

function BudgetNote({data,plan,formatPrice}){
 if(!data.budget)return null;
 const difference=moneyCents(plan.totals.total)-moneyCents(data.budget.amount);
 return <p className="guide-order-budget" data-relation={difference>0?'above':'within'}>{difference===0?'Exactly on your budget':`${formatPrice(Math.abs(difference)/100)} ${difference>0?'over':'under'} your budget`}</p>;
}
function Fees({data,plan,formatPrice}){
 const discount=Number(plan.totals.discount)>0;
 const delivery=data.delivery_method==='pickup'?'Collection':Number(plan.totals.shipping)===0?'Free delivery':`${formatPrice(plan.totals.shipping)} delivery`;
 return <p className="guide-card-fees">{discount && <>−{formatPrice(plan.totals.discount)} discount · </>}{delivery}{data.delivery_method==='pickup' && ` · ${formatPrice(plan.totals.shipping)}`}</p>;
}
function Action({plan,onAdd,onReview,authenticated,busyId,disabled,card=false}){
 const count=plan.items.reduce((sum,item)=>sum+item.add_quantity,0);
 const className=card?'menu-recommendation-add':'guide-add-basket';
 if(!count)return <Link className={className} to="/cart" onClick={onReview}>Review basket</Link>;
 const name=card?plan.items[0].name:'';
 return <button className={className} type="button" disabled={disabled || !!busyId} onClick={()=>onAdd(plan)} aria-label={authenticated?`Add ${count} ${count===1?'item':'items'}${name?` of ${name}`:''} to basket`:`Sign in to add${name?` ${name}`:' this basket'}`}>{busyId===plan.id?'Adding…':!authenticated?'Sign in to add':`Add ${count} ${count===1?'item':'items'} to basket`}</button>;
}
export default function GuideBasketResults({data,selectedId,onSelect,onAdd,onReview,onView,authenticated=false,busyId='',disabled=false,formatPrice,rangeNotice=''}){
 const title=useId(),plan=data.plans.find(option=>option.id===selectedId) || data.plans[0];
 if(!plan)return null;
 const count=data.quantity,same=data.menu_mode==='same' || count===1;
 const nextStep=`Choose your ${data.delivery_method==='pickup'?'collection':'delivery'} time in the basket or at checkout. Availability is checked again before ordering.`;
 const actionProps={onAdd,onReview,authenticated,busyId,disabled};
 const cardFor=(item,children,key=item.id)=><MenuRecommendationCard compact key={key} menu={item} priceLabel={`${formatPrice(item.price)} / ${unitLabel(item.selling_details)}`} onView={()=>onView?.(item.id)}>{children}</MenuRecommendationCard>;
 if(same)return <section className="guide-one-menu-results" aria-labelledby={title}>
  <div className="guide-basket-heading"><h3 id={title}>{count===1?'Choose a menu':'Choose one menu for your order'}</h3></div>
  <p className="guide-results-intro">{data.current_quantity===count?`Your ${count}-item basket is complete. Review it to continue.`:`Choose one card for your ${count}-item order. Prices include ${data.delivery_method==='pickup'?'collection':'delivery'}.`}</p>
  {rangeNotice && <p className="guide-range-notice" role="status">{rangeNotice}</p>}
  <div className="guide-results guide-one-menu-cards">{data.plans.map(option=>{
   const item=option.items[0];
   return cardFor(item,<>
    <p className="guide-plan-item-quantity"><strong>{quantityLabel(item.selling_details,item.quantity)}</strong><span>{formatPrice(option.totals.subtotal)} food</span></p>
    {item.existing_quantity>0 && <p className="guide-existing-items">{item.existing_quantity} already in your basket{item.add_quantity>0?` · add ${item.add_quantity}`:' · kept'}</p>}
    <div className="guide-card-purchase"><div className="guide-card-order-total"><span>Order total</span><strong>{formatPrice(option.totals.total)}</strong></div><Fees data={data} plan={option} formatPrice={formatPrice}/><BudgetNote data={data} plan={option} formatPrice={formatPrice}/><Action {...actionProps} plan={option} card/></div>
   </>,option.id);
  })}</div>
  <p className="guide-next-step">{nextStep}</p>
 </section>;
 return <section className="guide-basket-plan" aria-labelledby={title}>
  <div className="guide-basket-heading"><h3 id={title}>{count} {count===1?'item':'items'}, one basket</h3>{data.plans.length>1 && <div className="guide-basket-options" role="group" aria-label="Alternative complete baskets">{data.plans.map((option,index)=><button type="button" key={option.id} disabled={disabled || !!busyId} aria-pressed={plan.id===option.id} onClick={()=>onSelect(option.id)}><span>Basket {index+1}</span><strong>{formatPrice(option.totals.total)}</strong>{data.budget?.mode==='all' && <small>{option.budget_relation==='above'?'Over budget':'Within budget'}</small>}</button>)}</div>}</div>
  {data.plans.length>1 && <p className="guide-results-intro">Choose one complete basket. Every basket contains {count} {count===1?'item':'items'} in total.</p>}
  {rangeNotice && <p className="guide-range-notice" role="status">{rangeNotice}</p>}
  <div className="guide-results">{plan.items.map(item=>cardFor(item,<>
   <p className="guide-plan-item-quantity"><strong>{quantityLabel(item.selling_details,item.quantity)}</strong>{item.quantity>1 && <span>{formatPrice(item.line_total)} food</span>}</p>
   {item.existing_quantity>0 && <p className="guide-existing-items">{item.existing_quantity} already in your basket{item.add_quantity>0?` · add ${item.add_quantity}`:' · kept'}</p>}
  </>))}</div>
  <div className="guide-mixed-order"><div><div className="guide-mixed-total"><span>Whole-order total</span><strong>{formatPrice(plan.totals.total)}</strong></div><p className="guide-mixed-costs">Food {formatPrice(plan.totals.subtotal)}{Number(plan.totals.discount)>0 && <> · −{formatPrice(plan.totals.discount)} discount</>} · {data.delivery_method==='pickup'?'Collection':'Delivery'} {formatPrice(plan.totals.shipping)}</p><BudgetNote data={data} plan={plan} formatPrice={formatPrice}/></div><div className="guide-mixed-action"><Action {...actionProps} plan={plan}/></div></div>
  <p className="guide-next-step">{nextStep}</p>
 </section>;
}
