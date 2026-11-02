import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import axios from 'axios';
import {ArrowUpRight,ChefHat} from 'lucide-react';
import MenuPhoto from './MenuPhoto';
import {menuPage} from '../utils/menuPresentation';
import {readApiError} from '../utils/apiError';

export default function HomeMenuPreview(){
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    axios.get('/api/menu/',{signal:controller.signal,timeout:30000})
      .then(({data})=>setRows(menuPage(data).rows.slice(0,3)))
      .catch(error=>{if(!axios.isCancel(error))setError(readApiError(error));})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[revision]);
  return <section className="business-section home-menu" aria-labelledby="home-menu-title">
    <div className="section-heading"><div><span className="dk-eyebrow">FROM THE CURRENT MENU</span><h2 id="home-menu-title">What sounds good?</h2></div><Link className="text-link" to="/menu">See the full menu <ArrowUpRight size={16} aria-hidden="true"/></Link></div>
    {loading?<p role="status">Loading the kitchen’s menu…</p>:error?<div className="customer-notice" role="alert"><p>{error}</p><button type="button" onClick={()=>{setError('');setLoading(true);setRevision(n=>n+1);}}>Try loading the menu again</button></div>:rows.length?<div className="featured-foods">{rows.map(p=><Link key={p.id} to={`/products/${p.id}`} className="featured-food"><div className="home-food-photo"><ChefHat size={42} aria-hidden="true"/>{p.image_url && <MenuPhoto sizes="(max-width: 600px) 105px, 33vw" src={p.image_url} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</div><div><span>{p.category_name}</span><h3>{p.name}</h3><p>RM {Number(p.price).toFixed(2)} <ArrowUpRight size={19} aria-hidden="true"/></p><small>{p.lead_hours?`${p.lead_hours}h advance notice`:'Check delivery availability'}</small></div></Link>)}</div>:<p>No menus are available right now. <Link to="/contact">Ask the kitchen about the next menu.</Link></p>}
  </section>;
}
