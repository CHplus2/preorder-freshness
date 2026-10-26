import SellingDetails from './SellingDetails';
import {quantityLabel} from '../utils/sellingDetails';
import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import axios from 'axios';
import {useAuth} from '../contexts/AuthContext';
import {useCart} from '../contexts/CartContext';
import {useUI} from '../contexts/UIContext';
import {getCookie} from '../utils/cookieUtils';
import {apiError} from '../utils/apiError';
import {shoppingSuggestions,shoppingPreview,shoppingAdded} from '../utils/shoppingResponse';
import {deliveryDayIssue} from '../utils/deliveryDays';
import BasketSlots from './BasketSlots';
import './ShoppingAssistant.css';
const copy={
 en:{selected:'Selected delivery',budgetShort:'Budget',title:'Let’s plan your order',intro:'Describe a meal, quantity and budget. Choose one menu per addition; review it before your basket changes.',example:'Lunch for six tomorrow, budget RM80',placeholder:'6 chicken meals tomorrow, budget RM80',ask:'Find my options',thinking:'Checking your request…',edit:'Review your request',quantity:'Menu units / packs',date:'Preferred delivery date',budget:'Whole basket budget (RM, optional)',search:'Menu keyword (optional)',update:'Update options',guided:'Guided interpretation',ai:'AI-interpreted request',fallback:'AI unavailable · guided interpretation',privacy:'Use AI to interpret my request. Only this message is sent to Groq; do not include personal or payment details.',missing:'Set the quantity and date to find matching menus.',none:'No menu fits this request and current basket total. Try another keyword, quantity or budget.',estimate:'New basket estimate. Sign in to include any existing items.',scope:'Quantities count the menu’s selling unit, including packs or boxes. Basket totals below include current delivery charges and eligible bulk discounts.',review:'Review addition',add:'Confirm addition to basket',cancel:'Discard preview',before:'Already in basket',after:'Quantity after addition',price:'Price per selling unit',subtotal:'Whole basket food subtotal',discount:'Bulk discount',shipping:'Delivery',total:'Basket total after addition',notice:'This adds food to your basket. It does not place an order, reserve preparation or take payment.',added:'Addition confirmed',changed:'This addition was already recorded; your basket has since changed. Review the current basket.',recovery:'If the result is unclear, retry this same confirmation or check your basket before adding again.',check:'Choose delivery for your whole basket',unavailable:'This menu is not delivered on that date. Check later dates after adding, or choose another date.',continue:'Review checkout',another:'Add another menu',basket:'Review current basket',payment:'At checkout, confirm your address and delivery, then choose a payment method. PayPal Sandbox approval stays in the PayPal window.',owner:'Contact the kitchen to agree shipping or check allergy, dietary and certification requirements before ordering. I cannot verify arrangements or suitability.',contact:'Contact the kitchen',loading:'Working…',signin:'Sign in to review this addition',step:'Describe → Review basket → Delivery & payment'},
 ms:{selected:'Penghantaran dipilih',budgetShort:'Bajet',title:'Mari rancang pesanan anda',intro:'Nyatakan makanan, kuantiti dan bajet. Pilih satu menu bagi setiap tambahan dan semak dahulu.',example:'Makanan untuk enam orang esok, bajet RM80',placeholder:'6 hidangan ayam esok, bajet RM80',ask:'Cari pilihan',thinking:'Menyemak permintaan…',edit:'Semak permintaan',quantity:'Unit menu / pek',date:'Tarikh penghantaran pilihan',budget:'Bajet seluruh bakul (RM, pilihan)',search:'Kata kunci menu (pilihan)',update:'Kemas kini pilihan',guided:'Tafsiran berpandu',ai:'Permintaan ditafsir AI',fallback:'AI tidak tersedia · tafsiran berpandu',privacy:'Gunakan AI untuk memahami permintaan. Hanya mesej ini dihantar ke Groq; jangan masukkan maklumat peribadi atau pembayaran.',missing:'Tetapkan kuantiti dan tarikh untuk mencari menu.',none:'Tiada menu sesuai dengan permintaan dan jumlah bakul semasa. Cuba kata kunci, kuantiti atau bajet lain.',estimate:'Anggaran bakul baharu. Log masuk untuk memasukkan item sedia ada.',scope:'Kuantiti mengikut unit jualan menu, termasuk pek atau kotak. Jumlah termasuk caj penghantaran dan diskaun pukal yang layak.',review:'Semak tambahan',add:'Sahkan tambahan ke bakul',cancel:'Buang pratonton',before:'Sudah dalam bakul',after:'Kuantiti selepas tambahan',price:'Harga setiap unit jualan',subtotal:'Subtotal makanan seluruh bakul',discount:'Diskaun pukal',shipping:'Penghantaran',total:'Jumlah bakul selepas tambahan',notice:'Ini menambah makanan ke bakul sahaja. Tiada pesanan, tempahan dapur atau pembayaran dibuat.',added:'Tambahan disahkan',changed:'Tambahan ini sudah direkodkan; bakul telah berubah. Semak bakul semasa.',recovery:'Jika keputusan tidak jelas, cuba pengesahan yang sama atau semak bakul sebelum menambah lagi.',check:'Pilih penghantaran untuk seluruh bakul',unavailable:'Menu ini tidak dihantar pada tarikh itu. Semak tarikh kemudian atau pilih tarikh lain.',continue:'Semak pembayaran',another:'Tambah menu lain',basket:'Semak bakul semasa',payment:'Semasa pembayaran, sahkan alamat dan penghantaran, kemudian pilih kaedah bayaran. Kelulusan PayPal Sandbox kekal dalam tetingkap PayPal.',owner:'Hubungi dapur untuk urusan penghantaran kurier, alahan, diet atau pensijilan sebelum memesan. Saya tidak dapat mengesahkan urusan atau kesesuaian.',contact:'Hubungi dapur',loading:'Sedang diproses…',signin:'Log masuk untuk menyemak tambahan',step:'Nyatakan → Semak bakul → Penghantaran & bayaran'},
 zh:{selected:'已选配送时间',budgetShort:'预算',title:'一起安排您的订单',intro:'告诉我菜品、数量和预算。每次添加一道菜，加入购物篮前由您确认。',example:'明天六人午餐，预算RM80',placeholder:'明天6份鸡肉饭，预算RM80',ask:'查找选项',thinking:'正在检查您的要求…',edit:'检查您的要求',quantity:'菜单单位／包装数量',date:'期望配送日期',budget:'整个购物篮预算（RM，选填）',search:'菜品关键词（选填）',update:'更新选项',guided:'规则辅助理解',ai:'AI理解的要求',fallback:'AI暂不可用 · 规则辅助理解',privacy:'使用AI理解要求。仅将本条消息发送给Groq，请勿填写个人或付款资料。',missing:'请填写数量和日期以查找菜单。',none:'没有符合要求和当前购物篮总额的菜品。请调整关键词、数量或预算。',estimate:'新购物篮估算。登录后才能包含已有商品。',scope:'数量按照菜单的销售单位计算，包括包装或盒。总额包含当前运费及适用的批量折扣。',review:'检查添加内容',add:'确认加入购物篮',cancel:'放弃预览',before:'购物篮已有数量',after:'添加后的数量',price:'每个销售单位价格',subtotal:'整个购物篮食品小计',discount:'批量折扣',shipping:'配送费',total:'添加后的购物篮总额',notice:'此操作仅添加商品，不会下单、预留备餐时段或付款。',added:'已确认添加',changed:'此次添加已记录，但购物篮此后已改变。请检查当前购物篮。',recovery:'如结果不确定，请重试同一次确认或先检查购物篮，避免重复添加。',check:'为整个购物篮选择配送时间',unavailable:'这道菜在所选日期不配送。添加后请查找较晚日期或更改日期。',continue:'检查结账',another:'添加其他菜品',basket:'查看当前购物篮',payment:'在结账页确认地址和配送，然后选择付款方式。PayPal Sandbox付款仍由您在PayPal窗口批准。',owner:'请先联系厨房确认邮寄安排、过敏、特殊饮食或认证要求。我无法确认运输安排或食物适用性。',contact:'联系厨房',loading:'处理中…',signin:'登录以检查此次添加',step:'描述 → 检查购物篮 → 配送及付款'}
};
const dateLabel=(value,language)=>new Date(value+'T12:00:00+08:00').toLocaleDateString({en:'en-MY',ms:'ms-MY',zh:'zh-CN'}[language],{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'short',year:'numeric'});
const cleanDraft=draft=>Object.fromEntries(Object.entries(draft).filter(([,v])=>v!==''));
const draftFields=data=>({portions:data.portions===undefined?'':String(data.portions),date:data.date || '',budget:data.budget || '',search:data.search || ''});
export default function ShoppingAssistant({language='en',aiAvailable=false,onClose}){
 const t=copy[language];const {isAuthenticated}=useAuth() || {};const {setShowLogin}=useUI();const {cart,cartLoading,cartError,refreshCart,fulfilmentMethod}=useCart();const navigate=useNavigate();
 const [message,setMessage]=useState(''),[lastMessage,setLastMessage]=useState(''),[useAI,setUseAI]=useState(false);
 const [draft,setDraft]=useState(draftFields({})),[result,setResult]=useState(null),[preview,setPreview]=useState(null),[added,setAdded]=useState(null),[selection,setSelection]=useState(null);
 const [busy,setBusy]=useState(''),[error,setError]=useState('');const pending=useRef(false),read=useRef(null),mounted=useRef(true),resultRef=useRef(null),previewRef=useRef(null),addedRef=useRef(null);
 useEffect(()=>{mounted.current=true;refreshCart();return()=>{mounted.current=false;read.current?.abort()}},[refreshCart]);
 useEffect(()=>{(added?addedRef.current:preview?previewRef.current:result?resultRef.current:null)?.scrollIntoView({block:'nearest'})},[result,preview,added]);
 const key=JSON.stringify(cart.map(i=>[i.id,i.quantity,i.product.updated_at]));
 const selected=selection?.key===key?selection.value:'';
 async function options(text=message){
  if(pending.current)return;
  pending.current=true;setBusy('options');setError('');setPreview(null);setAdded(null);setResult(null);
  const controller=new AbortController();read.current=controller;
  try{
   const {data}=await axios.post('/api/help/shop/',{...(fulfilmentMethod?{delivery_method:fulfilmentMethod}:{}),message:text.trim(),draft:cleanDraft(draft),use_ai:useAI},{signal:controller.signal,timeout:12000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   const next=shoppingSuggestions(data);if(controller.signal.aborted)return;
   setResult(next);setDraft(draftFields(next.draft));setLastMessage(text.trim());setMessage('');
  }catch(e){if(!axios.isCancel(e) && mounted.current)setError(apiError(e))}
  finally{pending.current=false;if(mounted.current)setBusy('')}
 }
 async function review(row){
  if(!isAuthenticated){setShowLogin(true);onClose?.();return;}
  if(pending.current)return;
  pending.current=true;setBusy('preview');setError('');setAdded(null);setPreview(null);
  const controller=new AbortController();read.current=controller;
  try{
   const {data}=await axios.post('/api/help/cart/',{product_id:row.id,quantity:row.quantity,...(fulfilmentMethod?{delivery_method:fulfilmentMethod}:{}),...(draft.budget?{budget:draft.budget}:{})},{signal:controller.signal,timeout:15000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   if(!controller.signal.aborted)setPreview(shoppingPreview(data));
  }catch(e){if(!axios.isCancel(e) && mounted.current)setError(apiError(e))}
  finally{pending.current=false;if(mounted.current)setBusy('')}
 }
 async function confirm(){
  if(pending.current || !preview)return;
  pending.current=true;setBusy('confirm');setError('');
  try{
   const {data}=await axios.post('/api/help/cart/',{confirm:preview.confirm},{timeout:20000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
   const next=shoppingAdded(data,preview.preview);await refreshCart();
   if(mounted.current){setAdded(next);setPreview(null);setResult(null);setSelection(null)}
  }catch(e){if(mounted.current){setError(e.response?apiError(e):t.recovery);if(e.response?.status<500)setPreview(null)}}
  finally{pending.current=false;if(mounted.current)setBusy('')}
 }
 function change(field,value){setDraft(current=>({...current,[field]:value}));setResult(null);setPreview(null);setError('')}
 function checkout(){
  const preferred=selected?selected+':00+08:00':'';
  try{if(preferred)sessionStorage.setItem('preferredDelivery',preferred);else sessionStorage.removeItem('preferredDelivery')}catch{/* Navigation state also carries the selected time. */}
  onClose?.();navigate('/checkout',{state:{preferredDelivery:preferred}});
 }
 return <section className="shopping-assistant" aria-label={t.title}>
  <p className="shopping-steps">{t.step}</p><h3>{t.title}</h3><p>{t.intro}</p>
  {!added && <><form className="shopping-request" onSubmit={e=>{e.preventDefault();options()}}><label htmlFor="shopping-message">{t.title}</label><textarea id="shopping-message" maxLength={500} rows={2} value={message} disabled={!!busy} onChange={e=>setMessage(e.target.value)} placeholder={t.placeholder}/>
  {aiAvailable && <label className="kitchen-chat-consent"><input type="checkbox" checked={useAI} disabled={!!busy} onChange={e=>setUseAI(e.target.checked)}/><span>{t.privacy}</span></label>}
  <button type="button" className="shopping-example" disabled={!!busy} onClick={()=>setMessage(t.example)}>{t.example}</button><button className="kitchen-chat-primary" disabled={!!busy || !message.trim()}>{busy==='options'?t.thinking:t.ask}</button></form>
  <details className="shopping-draft" open={result?.missing.length?true:undefined}><summary>{t.edit}</summary><form onSubmit={e=>{e.preventDefault();options('')}}><div className="shopping-fields"><label>{t.quantity}<input type="number" min="1" max="1000" required disabled={!!busy} value={draft.portions} onChange={e=>change('portions',e.target.value)}/></label><label>{t.date}<input type="date" required disabled={!!busy} value={draft.date} onChange={e=>change('date',e.target.value)}/></label><label>{t.budget}<input type="number" min="0.01" max="999999.99" step="0.01" disabled={!!busy} value={draft.budget} onChange={e=>change('budget',e.target.value)}/></label><label>{t.search}<input maxLength={80} disabled={!!busy} value={draft.search} onChange={e=>change('search',e.target.value)}/></label></div><button disabled={!!busy}>{t.update}</button></form></details>
  </>}
  <div ref={resultRef}/>{lastMessage && <p className="kitchen-chat-question">{lastMessage}</p>}
  {result && <>{!result.missing.length && result.mode!=='owner_review' && <p className="shopping-brief">{draft.portions} × · {dateLabel(draft.date,language)}{draft.budget && <> · {t.budgetShort} RM {draft.budget}</>}</p>}<span className="shopping-mode">{result.mode==='ai'?t.ai:result.mode==='guided_fallback'?t.fallback:t.guided}</span>{result.mode==='owner_review'?<p>{t.owner} <Link to="/contact" onClick={onClose}>{t.contact}</Link></p>:<>{result.missing.length>0?<p>{t.missing}</p>:<><p className="shopping-scope">{t.scope}</p>{!result.basket_known && <p>{t.estimate}</p>}{!preview && !result.results.length && <p role="status">{t.none}</p>}{!preview && result.results.map(row=><article className="shopping-menu" key={row.id}><h4>{row.name} · {quantityLabel(row.selling_details,row.quantity)}</h4><SellingDetails details={row.selling_details}/><p>RM {row.price} × {row.quantity} = RM {row.addition_subtotal}</p><p>{t.total}: <strong>RM {row.basket_after.total}</strong></p>{!row.delivery_day_allowed && <p>{t.unavailable}</p>}<button type="button" disabled={!!busy} onClick={()=>review(row)}>{isAuthenticated?t.review:t.signin}</button></article>)}</>}</>}</>}
  {preview && <section ref={previewRef} className="shopping-confirmation" aria-label={t.review}><h4>{preview.preview.menu} · {quantityLabel(preview.preview.selling_details,preview.preview.quantity)}</h4><SellingDetails details={preview.preview.selling_details}/><dl><div><dt>{t.before}</dt><dd>{preview.preview.quantity_before}</dd></div><div><dt>{t.after}</dt><dd>{preview.preview.quantity_after}</dd></div><div><dt>{t.price}</dt><dd>RM {preview.preview.unit_price}</dd></div><div><dt>{t.subtotal}</dt><dd>RM {preview.preview.basket_after.subtotal}</dd></div><div><dt>{t.discount}</dt><dd>− RM {preview.preview.basket_after.discount}</dd></div><div><dt>{t.shipping}</dt><dd>RM {preview.preview.basket_after.shipping}</dd></div><div className="shopping-total"><dt>{t.total}</dt><dd>RM {preview.preview.basket_after.total}</dd></div></dl><p>{t.notice}</p><button type="button" className="kitchen-chat-primary" disabled={!!busy} onClick={confirm}>{busy==='confirm'?t.loading:t.add}</button><button type="button" disabled={!!busy} onClick={()=>setPreview(null)}>{t.cancel}</button></section>}
  {error && <p role="alert">{error}</p>}{!!busy && busy!=='options' && <p role="status">{t.loading}</p>}
  {added && <section ref={addedRef} className="shopping-added"><h4 role="status">{t.added}</h4><p>{added.result.quantity} × {added.result.menu}</p>{added.basket_changed && <p>{t.changed}</p>}<Link to="/cart" onClick={onClose}>{t.basket}</Link><h4>{t.check}</h4><label>{t.date}<input type="date" value={draft.date} onChange={e=>{setDraft(current=>({...current,date:e.target.value}));setSelection(null)}}/></label>
  {cartError?<p role="alert">{cartError} <button type="button" onClick={refreshCart}>Retry</button></p>:cartLoading?<p role="status">{t.loading}</p>:<BasketSlots method={fulfilmentMethod} key={key+fulfilmentMethod} value={draft.date} disabled={!cart.length || !!deliveryDayIssue(cart,draft.date)} nextDisabled={!cart.length || !!deliveryDayIssue(cart,'')} selectedValue={selected} onSelect={value=>setSelection({key,value})}/>}
  {selected && <p className="shopping-selected-time" role="status">{t.selected}: <strong>{new Date(selected+':00+08:00').toLocaleString({en:'en-MY',ms:'ms-MY',zh:'zh-CN'}[language],{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'})}</strong></p>}<p>{t.payment}</p><button type="button" className="kitchen-chat-primary" disabled={cartLoading || !!cartError || !cart.length} onClick={checkout}>{t.continue}</button><button type="button" onClick={()=>{setAdded(null);setResult(null);setPreview(null);setMessage('');setDraft(current=>({...current,search:''}))}}>{t.another}</button></section>}
 </section>;
}
