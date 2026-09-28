import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {MessageCircle, X, Send} from 'lucide-react';
import axios from 'axios';
import {getCookie} from '../utils/cookieUtils';
import './KitchenHelp.css';

const copy = {
  en: {title:'Kitchen help', close:'Close help', intro:'Ask about food, preorders or an order. Choose a topic for a quick answer.', language:'Language', question:'Your question', placeholder:'How do preorders work?', send:'Send', busy:'Finding an answer…', contact:'Contact the owner', menu:'Explore the menu', orders:'My orders', clear:'Clear conversation', budget:'Food budget (RM, optional)', portions:'Portions', search:'Menu name (optional)', filters:'Find food for your budget', find:'Find menus', consent:'Use AI for questions the guide cannot recognise. Your question will be sent to Groq. Do not include personal or payment details.', guided:'Kitchen guide', ai:'AI-assisted topic matching', fallback:'AI unavailable or unsure — kitchen guide', error:'Could not load an answer. Please try again or contact the owner.', limit:'Please wait a minute before asking again.', retry:'Try again', total:'Food total', price:'per portion', notice:'Suggestions do not reserve food or confirm a delivery slot.', topics:[['menu','Help me choose'],['preorder','Preorder timing'],['delivery','Delivery or delays'],['payment','Payment help'],['freshness','Ingredient records'],['allergy','Allergies & diets'],['orders','My order'],['review','Leave a review']]},
  ms: {title:'Bantuan dapur', close:'Tutup bantuan', intro:'Tanya tentang makanan, prapesanan atau pesanan anda. Pilih topik untuk jawapan pantas.', language:'Bahasa', question:'Soalan anda', placeholder:'Bagaimana prapesanan berfungsi?', send:'Hantar', busy:'Mencari jawapan…', contact:'Hubungi pemilik', menu:'Lihat menu', orders:'Pesanan saya', clear:'Padam perbualan', budget:'Bajet makanan (RM, pilihan)', portions:'Bilangan hidangan', search:'Nama menu (pilihan)', filters:'Cari makanan mengikut bajet', find:'Cari menu', consent:'Gunakan AI untuk soalan yang tidak dikenal pasti oleh panduan. Soalan anda akan dihantar kepada Groq. Jangan sertakan maklumat peribadi atau pembayaran.', guided:'Panduan dapur', ai:'Padanan topik berbantu AI', fallback:'AI tidak tersedia atau tidak pasti — panduan dapur', error:'Jawapan tidak dapat dimuatkan. Cuba lagi atau hubungi pemilik.', limit:'Sila tunggu seminit sebelum bertanya lagi.', retry:'Cuba lagi', total:'Jumlah makanan', price:'setiap hidangan', notice:'Cadangan tidak menempah makanan atau mengesahkan slot penghantaran.', topics:[['menu','Bantu saya memilih'],['preorder','Masa prapesanan'],['delivery','Penghantaran / kelewatan'],['payment','Bantuan pembayaran'],['freshness','Rekod bahan'],['allergy','Alahan & diet'],['orders','Pesanan saya'],['review','Beri ulasan']]},
  zh: {title:'厨房助手', close:'关闭助手', intro:'您可以询问菜品、预订或订单问题。选择话题即可快速查看答案。', language:'语言', question:'您的问题', placeholder:'如何提前预订？', send:'发送', busy:'正在查找答案…', contact:'联系店主', menu:'浏览菜单', orders:'我的订单', clear:'清空对话', budget:'食品预算（RM，选填）', portions:'份数', search:'菜品名称（选填）', filters:'按预算寻找菜品', find:'查找菜品', consent:'使用AI识别指南无法理解的问题。您的问题将发送给Groq。请勿填写个人或付款资料。', guided:'厨房指南', ai:'AI辅助话题识别', fallback:'AI暂不可用或无法确定 — 厨房指南', error:'无法加载答案。请重试或联系店主。', limit:'请等待一分钟后再提问。', retry:'重试', total:'食品小计', price:'每份', notice:'推荐不代表已预留食材或确认配送时段。', topics:[['menu','帮我选菜'],['preorder','预订时间'],['delivery','配送或延误'],['payment','付款帮助'],['freshness','食材记录'],['allergy','过敏与饮食要求'],['orders','我的订单'],['review','提交评价']]}
};

export default function KitchenHelp() {
  const [open,setOpen]=useState(false), [language,setLanguage]=useState('en');
  const [question,setQuestion]=useState(''), [messages,setMessages]=useState([]);
  const [busy,setBusy]=useState(false), [error,setError]=useState('');
  const [available,setAvailable]=useState(false), [useAI,setUseAI]=useState(false);
  const [budget,setBudget]=useState(''), [portions,setPortions]=useState('1'), [search,setSearch]=useState('');
  const pending=useRef(null), lastRequest=useRef(null), toggle=useRef(null), panel=useRef(null), end=useRef(null);
  const t=copy[language];

  useEffect(()=>{if(!open)return; const controller=new AbortController();
    axios.get('/api/help/',{signal:controller.signal,timeout:8000}).then(r=>setAvailable(r.data.ai_available)).catch(()=>setAvailable(false));
    panel.current?.focus(); return()=>controller.abort();
  },[open]);
  useEffect(()=>()=>pending.current?.abort(),[]);
  useEffect(()=>{if(open && (messages.length || busy))end.current?.scrollIntoView({block:'nearest'});},[messages,busy,open]);
  function close(){setOpen(false);toggle.current?.focus();}
  function reset(){pending.current?.abort();pending.current=null;lastRequest.current=null;setBusy(false);setError('');setMessages([]);setQuestion('');}
  async function ask(payload, label){
    if(pending.current)return;
    const controller=new AbortController();pending.current=controller;
    lastRequest.current={payload,label};setBusy(true);setError('');
    try {
      const result=await axios.post('/api/help/',{...payload,language,use_ai:useAI},{signal:controller.signal,timeout:12000,headers:{'X-CSRFToken':getCookie('csrftoken')}});
      if(controller.signal.aborted)return;
      setMessages(rows=>[...rows.slice(-8),{question:label,...result.data,language}]);setQuestion('');
    }catch(err){if(!axios.isCancel(err))setError(err.response?.status===429?t.limit:t.error);}
    finally{if(pending.current===controller){pending.current=null;setBusy(false);}}
  }
  return <>
    <button ref={toggle} className="dk-help-toggle" onClick={()=>open?close():setOpen(true)} aria-expanded={open} aria-controls="kitchen-help-panel"><MessageCircle size={18} aria-hidden="true"/>{t.title}</button>
    {open && <section id="kitchen-help-panel" className="kitchen-chat" role="dialog" aria-modal="false" aria-labelledby="kitchen-chat-title" lang={language==='zh'?'zh-Hans':language} ref={panel} tabIndex={-1} onKeyDown={e=>{if(e.key==='Escape')close();}}>
      <header><h2 id="kitchen-chat-title">{t.title}</h2><button type="button" onClick={close} aria-label={t.close}><X size={20}/></button></header>
      <div className="kitchen-chat-body">
        <label htmlFor="help-language">{t.language}</label><select id="help-language" value={language} onChange={e=>{reset();setLanguage(e.target.value);}}><option value="en">English</option><option value="ms">Bahasa Melayu</option><option value="zh">中文（简体）</option></select>
        <p>{t.intro}</p>
        <div className="kitchen-chat-topics">{t.topics.map(([topic,label])=><button key={topic} disabled={busy} onClick={()=>ask({topic},label)}>{label}</button>)}</div>
        <details><summary>{t.filters}</summary><form onSubmit={e=>{e.preventDefault();ask({topic:'menu',portions:Number(portions),...(budget?{budget}:{}),search},t.filters);}}>
          <label htmlFor="help-budget">{t.budget}</label><input id="help-budget" type="number" min="0.01" max="999999.99" step="0.01" value={budget} onChange={e=>setBudget(e.target.value)}/>
          <label htmlFor="help-portions">{t.portions}</label><input id="help-portions" type="number" min="1" max="1000" required value={portions} onChange={e=>setPortions(e.target.value)}/>
          <label htmlFor="help-search">{t.search}</label><input id="help-search" maxLength={80} value={search} onChange={e=>setSearch(e.target.value)}/><button disabled={busy} className="kitchen-chat-primary">{t.find}</button>
        </form></details>
        <div className="kitchen-chat-messages" role="log" aria-live="polite" aria-relevant="additions">
          {messages.map((m,i)=><article key={i}><p className="kitchen-chat-question">{m.question}</p><small>{t[m.mode] || t.guided}</small><p className="kitchen-chat-answer">{m.answer}</p>
            {m.menus.map(menu=><Link className="kitchen-chat-menu" key={menu.href} to={menu.href} onClick={close}><strong>{menu.name}</strong><span>RM {menu.price} {t.price}</span><span>{menu.portions} × · {t.total}: RM {menu.food_total}</span></Link>)}
            <Link to={m.href} onClick={close}>{m.href==='/orders'?t.orders:m.href==='/menu'?t.menu:t.contact}</Link>
          </article>)}
        </div>
        {busy && <p role="status">{t.busy}</p>}
        {error && <div role="alert"><p>{error}</p><button disabled={busy} onClick={()=>lastRequest.current && ask(lastRequest.current.payload,lastRequest.current.label)}>{t.retry}</button></div>}
        <div ref={end}/>
      </div>
      <form className="kitchen-chat-compose" onSubmit={e=>{e.preventDefault();if(question.trim())ask({message:question.trim()},question.trim());}}>
        {available && <label className="kitchen-chat-consent"><input type="checkbox" checked={useAI} onChange={e=>setUseAI(e.target.checked)}/><span>{t.consent}</span></label>}
        <label htmlFor="help-question">{t.question}</label><div className="kitchen-chat-input"><input id="help-question" maxLength={500} required value={question} onChange={e=>setQuestion(e.target.value)} placeholder={t.placeholder}/><button disabled={busy || !question.trim()} aria-label={t.send}><Send size={18}/></button></div>
        <div className="kitchen-chat-actions"><Link to="/contact" onClick={close}>{t.contact}</Link><button type="button" onClick={reset}>{t.clear}</button></div>
      </form>
    </section>}
  </>;
}
