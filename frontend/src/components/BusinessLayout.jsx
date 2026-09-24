import {useEffect,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {motion,useReducedMotion} from 'framer-motion';
import {ArrowUpRight,Plus,Minus,MessageCircle} from 'lucide-react';
import {useStorefront} from '../contexts/StorefrontProvider';
export function Reveal({children,className=''}){
 const reduced=useReducedMotion();
 return <motion.div className={className} initial={reduced?false:{opacity:0,y:22}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.1}} transition={{duration:.55,ease:'easeOut'}}>{children}</motion.div>;
}
export function PageMeta({title,description}){
 const {store}=useStorefront();const {pathname}=useLocation();
 useEffect(()=>{
  document.title=`${title} | ${store.name}`;
  const element=document.querySelector('meta[name="description"]');if(element)element.content=description;
  const canonical=document.querySelector('link[rel="canonical"]') || document.createElement('link');canonical.rel='canonical';canonical.href=window.location.origin+pathname;if(!canonical.parentNode)document.head.append(canonical);
 },[title,description,store.name,pathname]);
 return null;
}
export function PrimaryLink({to='/menu',children='Explore the menu'}){return <Link className="dk-primary" to={to}>{children}<ArrowUpRight size={17}/></Link>}
const questions=[
 ['How far ahead can I preorder?','Up to 90 days. Each menu has its own advance notice and daily capacity. Your basket shows the preparation and delivery buffer before you choose a date.'],
 ['Is my delivery time guaranteed?','It is your requested delivery time. The owner reviews preparation and delivery arrangements. Ask the kitchen before ordering if your event has a strict deadline.'],
 ['Can I request express delivery?','Choose an express request at checkout. Menu lead times still apply. The owner must confirm the courier and agree any extra charge with you.'],
 ['What does ingredient freshness tell me?','It describes current ingredients using recorded expiry dates and storage guidance. It cannot detect contamination or guarantee safety. A future order may use new batches.'],
 ['What if I have an allergy or special request?','Contact the owner before placing your order. Ingredient records do not establish an allergen-free kitchen.'],
 ['Can I place an order for a group?','Yes, within the menu’s daily capacity. If the owner enables a bulk promotion, the qualifying discount appears automatically in your basket. For larger plans, contact the kitchen first.'],
 ['When can I leave a review?','After your order is delivered, open the menu item and leave your review. One review per customer per menu keeps feedback tied to actual orders.']
];
export function FAQ({limit=questions.length}){
 const [open,setOpen]=useState(null);
 return <div className="business-faq">{questions.slice(0,limit).map(([q,a],i)=><section key={q}><button aria-expanded={open===i} aria-controls={`faq-${i}`} onClick={()=>setOpen(open===i?null:i)}>{q}{open===i?<Minus size={18}/>:<Plus size={18}/>}</button><div id={`faq-${i}`} hidden={open!==i}><p>{a}</p></div></section>)}</div>;
}
export function BusinessFooter(){
 const {store}=useStorefront();const [help,setHelp]=useState(false),[answer,setAnswer]=useState('Choose a topic below. For personal requests, contact the kitchen.');
 return <><footer className="business-footer"><div className="business-footer-top"><div><span className="dk-eyebrow">MAKE ROOM FOR SOMETHING GOOD</span><h2>Your next meal.<br/>One less thing to plan.</h2></div><PrimaryLink>Find your favourite</PrimaryLink></div><div className="business-footer-grid"><div><Link className="brand" to="/">{store.name}</Link><p>{store.tagline}</p></div><div><h3>Explore</h3><Link to="/story">Our story</Link><Link to="/menu">The menu</Link><Link to="/how-it-works">How it works</Link></div><div><h3>Let’s talk food</h3><Link to="/contact">Contact the kitchen</Link>{store.contact_email && <a href={`mailto:${store.contact_email}`}>{store.contact_email}</a>}{store.social_url && <a href={store.social_url} target="_blank" rel="noreferrer">Follow the kitchen ↗</a>}</div></div><div className="business-footer-bottom"><span>© {new Date().getFullYear()} {store.name}</span><span>A home kitchen storefront · Prices in MYR</span></div></footer><button className="dk-help-toggle" onClick={()=>setHelp(!help)} aria-expanded={help} aria-controls="kitchen-help-panel"><MessageCircle size={18} aria-hidden="true"/> {help ? 'Close kitchen help' : 'Kitchen help'}</button>{help && <aside id="kitchen-help-panel" className="dk-help" aria-label="Kitchen help"><h3>A little help?</h3><p role="status">{answer}</p>{questions.map(([q,a])=><button key={q} onClick={()=>setAnswer(a)}>{q}</button>)}<Link to="/contact" onClick={()=>setHelp(false)}>Speak to the owner ↗</Link></aside>}</>;
}
