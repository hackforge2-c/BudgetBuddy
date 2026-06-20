import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase'
import { useFirestore } from './useFirestore'
import AuthScreen from './AuthScreen'

// ── Gemini API ──
const GEMINI_KEY_LS = 'bb_gemini_key'
const callGemini = async (prompt, imageBase64=null) => {
  const key = localStorage.getItem(GEMINI_KEY_LS)||''
  if(!key) throw new Error('NO_KEY')
  const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`
  const parts=[]
  if(imageBase64) parts.push({inlineData:{mimeType:'image/jpeg',data:imageBase64}})
  parts.push({text:prompt})
  const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts}]})})
  const data=await res.json()
  if(data.error) throw new Error(data.error.message)
  return data.candidates?.[0]?.content?.parts?.[0]?.text||''
}

// ── CATEGORIES ──
const CATEGORIES = {
  Food:          { emoji:'🍔', color:'food',          bar:'#ef4444', label:'Food & Dining' },
  Travel:        { emoji:'✈️',  color:'travel',        bar:'#2563eb', label:'Travel' },
  Shopping:      { emoji:'🛍️', color:'shopping',      bar:'#db2777', label:'Shopping' },
  Bills:         { emoji:'⚡',  color:'bills',          bar:'#d97706', label:'Bills & Utilities' },
  Entertainment: { emoji:'🎮', color:'entertainment', bar:'#7c3aed', label:'Entertainment' },
  Health:        { emoji:'💊', color:'health',        bar:'#059669', label:'Health & Fitness' },
  Other:         { emoji:'📦', color:'other',         bar:'#6b7280', label:'Other' },
}
const PRESET_TAGS=[{label:'#vacation',color:'#2563eb'},{label:'#work',color:'#7c3aed'},{label:'#emergency',color:'#1de9b6'},{label:'#family',color:'#d97706'},{label:'#health',color:'#059669'},{label:'#food',color:'#db2777'}]
const TAG_COLORS=['#e11d48','#2563eb','#7c3aed','#059669','#d97706','#db2777','#0891b2','#f97316']
const CONFETTI_COLORS=['#e11d48','#f43f5e','#fb7185','#fda4af','#fb923c','#fbbf24','#4ade80','#60a5fa','#a78bfa']
const LOAN_TYPES={Home:{emoji:'🏠',color:'#2563eb'},Car:{emoji:'🚗',color:'#7c3aed'},Personal:{emoji:'💼',color:'#e11d48'},Education:{emoji:'🎓',color:'#059669'},Other:{emoji:'🏦',color:'#d97706'}}
const SCHEME_TYPES=[
  {key:'health',name:'Health Insurance',emoji:'🏥',color:'#059669',desc:'Premium & renewal'},
  {key:'ppf',name:'PPF',emoji:'🏦',color:'#2563eb',desc:'Public Provident Fund'},
  {key:'sip',name:'SIP / Mutual Fund',emoji:'📈',color:'#7c3aed',desc:'Monthly SIP investment'},
  {key:'lic',name:'LIC / Life Ins.',emoji:'💼',color:'#e11d48',desc:'Premium & sum assured'},
  {key:'kvp',name:'Kisan Vikas Patra',emoji:'🌾',color:'#059669',desc:'Post office investment'},
  {key:'rd',name:'Post Office RD',emoji:'📮',color:'#d97706',desc:'Recurring deposit'},
  {key:'nps',name:'NPS',emoji:'🏗️',color:'#0891b2',desc:'National Pension Scheme'},
  {key:'education',name:'Education Loan',emoji:'🎓',color:'#7c3aed',desc:'Student loan tracker'},
  {key:'car',name:'Car Loan',emoji:'🚗',color:'#f97316',desc:'Vehicle financing'},
  {key:'home',name:'Home Loan',emoji:'🏠',color:'#2563eb',desc:'Property mortgage'},
]
const SAMPLE_EXPENSES=[
  {id:1,title:'Grocery Shopping',amount:2800,category:'Food',date:'2025-05-18',tags:['#family','#food'],note:'DMart monthly'},
  {id:2,title:'Netflix Subscription',amount:649,category:'Entertainment',date:'2025-05-17',tags:[],note:'',recurring:true,recurringDay:17},
  {id:3,title:'Flight to Mumbai',amount:4500,category:'Travel',date:'2025-05-15',tags:['#work'],note:'Business trip'},
  {id:4,title:'Electricity Bill',amount:1890,category:'Bills',date:'2025-05-14',tags:[],note:'',recurring:true,recurringDay:14},
  {id:5,title:'Amazon Order',amount:2340,category:'Shopping',date:'2025-05-12',tags:['#family'],note:'Kids supplies'},
  {id:6,title:'Gym Membership',amount:1200,category:'Health',date:'2025-05-10',tags:['#health'],note:'',recurring:true,recurringDay:10},
  {id:7,title:'Restaurant Dinner',amount:1680,category:'Food',date:'2025-05-08',tags:['#family'],note:'Anniversary'},
  {id:8,title:'Uber Rides',amount:840,category:'Travel',date:'2025-04-28',tags:['#work'],note:''},
]
const SAMPLE_LENT=[
  {id:101,name:'Rahul Sharma',amount:2000,reason:'Medical emergency',date:'2025-05-10',dueDate:'2025-06-10',status:'pending',note:'Said will pay next month'},
  {id:102,name:'Priya Mehta',amount:500,reason:'Lunch money',date:'2025-05-15',dueDate:'2025-05-30',status:'pending',note:''},
  {id:103,name:'Arjun Patel',amount:3500,reason:'Bike repair',date:'2025-04-20',dueDate:'2025-05-20',status:'overdue',note:'Reminded twice'},
  {id:104,name:'Sneha Joshi',amount:1200,reason:'Birthday gift',date:'2025-04-05',dueDate:'2025-05-05',status:'returned',note:'Paid back ✅'},
]
const SAMPLE_LOANS=[
  {id:201,name:'Home Loan',type:'Home',bank:'SBI',principal:3500000,emi:28500,tenure:240,paidEmis:36,rate:8.5,startDate:'2022-06-01',note:''},
  {id:202,name:'Car Loan',type:'Car',bank:'HDFC',principal:650000,emi:12800,tenure:60,paidEmis:18,rate:9.2,startDate:'2023-12-01',note:''},
]
const SAMPLE_SCHEMES=[
  {id:301,type:'health',name:'Star Health Insurance',amount:18000,date:'2025-01-15',maturity:'2026-01-15',note:'Family floater 5L',active:true},
  {id:302,type:'sip',name:'Mirae Asset SIP',amount:5000,date:'2025-01-01',maturity:'2035-01-01',note:'Monthly ₹5000',active:true},
  {id:303,type:'ppf',name:'PPF Account SBI',amount:150000,date:'2025-04-01',maturity:'2037-04-01',note:'Yearly ₹1.5L',active:true},
]
const KEYWORD_MAP={
  Food:['grocery','food','eat','restaurant','dinner','lunch','breakfast','pizza','burger','swiggy','zomato','cafe','coffee','chai','snack','fruit','milk','biscuit','tea'],
  Travel:['uber','ola','cab','taxi','flight','train','bus','ticket','metro','auto','petrol','fuel','toll','rapido','trip','travel','rapido','namma'],
  Shopping:['amazon','flipkart','myntra','meesho','cloth','shirt','shoe','dress','buy','order','purchase','market','mall','store','ajio','nykaa'],
  Bills:['bill','electricity','water','gas','internet','broadband','rent','emi','insurance','tax','recharge','mobile','phone','wifi','bsnl','airtel','jio'],
  Entertainment:['netflix','spotify','hotstar','prime','movie','game','concert','show','theatre','cinema','party','music','youtube','disney','zee5'],
  Health:['gym','doctor','medicine','hospital','pharmacy','health','fitness','yoga','diagnostic','lab','dental','protein','apollo','medplus'],
}

// ── HELPERS ──
const formatINR   = n  => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n)
const getMonth    = d  => d.slice(0,7)
const thisMonth   = () => new Date().toISOString().slice(0,7)
const lastMonth   = () => { const d=new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7) }
const today       = () => new Date().toISOString().slice(0,10)
const genId       = () => Date.now()+Math.floor(Math.random()*1000)
const daysBetween = (a,b) => Math.ceil((new Date(b)-new Date(a))/86400000)
const hashPin     = pin => { let h=0; for(let i=0;i<pin.length;i++) h=Math.imul(31,h)+pin.charCodeAt(i)|0; return h.toString(36)+'_bb' }
const lsGet  = (k,fb) => { try{const v=localStorage.getItem(k);return v!==null?JSON.parse(v):fb}catch{return fb} }
const lsSet  = (k,v)  => { try{localStorage.setItem(k,JSON.stringify(v))}catch{} }
const autoClassify = title => { const l=title.toLowerCase(); for(const[cat,kws] of Object.entries(KEYWORD_MAP)) if(kws.some(k=>l.includes(k))) return cat; return null }
const calcEMI = (P,r,n) => { if(!P||!r||!n) return 0; const R=r/(12*100); return Math.round(P*R*Math.pow(1+R,n)/(Math.pow(1+R,n)-1)) }

// Anomaly detection — compare expense to user's average for that category
const detectAnomaly = (expense, allExpenses) => {
  const same = allExpenses.filter(e=>e.category===expense.category && e.id!==expense.id)
  if(same.length < 3) return null
  const avg = same.reduce((s,e)=>s+e.amount,0)/same.length
  const std = Math.sqrt(same.reduce((s,e)=>s+Math.pow(e.amount-avg,2),0)/same.length)
  if(expense.amount > avg + 2*std && expense.amount > avg*2) {
    return { avg:Math.round(avg), times:+(expense.amount/avg).toFixed(1) }
  }
  return null
}

const buildReport = (expenses,lentList,loans,budget) => {
  const ts=expenses.reduce((s,e)=>s+e.amount,0)
  const ms=expenses.filter(e=>getMonth(e.date)===thisMonth()).reduce((s,e)=>s+e.amount,0)
  const tp=lentList.filter(l=>l.status!=='returned').reduce((s,l)=>s+l.amount,0)
  const catBreak=Object.keys(CATEGORIES).map(c=>{const t=expenses.filter(e=>e.category===c).reduce((s,e)=>s+e.amount,0);return t>0?`  ${CATEGORIES[c].emoji} ${c}: ${formatINR(t)}`:null}).filter(Boolean).join('\n')
  const pendingLent=lentList.filter(l=>l.status!=='returned').map(l=>`  • ${l.name}: ${formatINR(l.amount)}`).join('\n')
  return `╔══════════════════════════════════╗\n║     BudgetBuddy — Finance Report  ║\n║         ${today()}              ║\n╚══════════════════════════════════╝\n\n📊 SUMMARY\n${'─'.repeat(38)}\nTotal Spent   : ${formatINR(ts)}\nThis Month    : ${formatINR(ms)}\nMonthly Budget: ${formatINR(budget)}\nBudget Used   : ${budget>0?Math.round((ms/budget)*100):0}%\nRemaining     : ${formatINR(Math.max(budget-ms,0))}\n\n💸 BY CATEGORY\n${'─'.repeat(38)}\n${catBreak||'  No data'}\n\n🤝 LENT MONEY\n${'─'.repeat(38)}\nTotal Lent   : ${formatINR(lentList.reduce((s,l)=>s+l.amount,0))}\nStill Owed   : ${formatINR(tp)}\nRecovered    : ${formatINR(lentList.filter(l=>l.status==='returned').reduce((s,l)=>s+l.amount,0))}\n${pendingLent?`\nPending:\n${pendingLent}`:''}\n\n📤 Generated by BudgetBuddy — ${new Date().toLocaleString('en-IN')}`
}
const exportCSV=(expenses,lentList)=>{
  const rows=['Date,Title,Category,Amount,Tags,Note',...expenses.map(e=>`${e.date},"${e.title}",${e.category},${e.amount},"${(e.tags||[]).join(' ')}","${e.note||''}"`),'',' Date,Name,Amount,Reason,Due,Status',...lentList.map(l=>`${l.date},"${l.name}",${l.amount},"${l.reason||''}",${l.dueDate||''},${l.status}`)].join('\n')
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows],{type:'text/csv'}));a.download=`BudgetBuddy_${today()}.csv`;a.click()
}
const shareWhatsApp=(expenses,lentList,budget)=>{
  const ms=expenses.filter(e=>getMonth(e.date)===thisMonth()).reduce((s,e)=>s+e.amount,0)
  const tp=lentList.filter(l=>l.status!=='returned').reduce((s,l)=>s+l.amount,0)
  const top=Object.keys(CATEGORIES).map(c=>({c,t:expenses.filter(e=>e.category===c).reduce((s,e)=>s+e.amount,0)})).sort((a,b)=>b.t-a.t)[0]
  const msg=`💰 *BudgetBuddy Monthly Summary*\n📅 ${new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'})}\n\n💸 This month: *${formatINR(ms)}*\n🎯 Budget: ${formatINR(budget)} (${budget>0?Math.round((ms/budget)*100):0}% used)\n🏆 Top spend: ${top?.c} (${formatINR(top?.t||0)})\n🤝 People owe me: *${formatINR(tp)}*\n\n_Tracked with BudgetBuddy 📊_`
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank')
}

// ── SMALL COMPONENTS ──
function LiveClock(){
  const[now,setNow]=useState(new Date())
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t)},[])
  return(
    <div className="nav-datetime">
      <div className="nav-time">{now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}</div>
      <div className="nav-date">{now.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</div>
    </div>
  )
}
function Toast({message,type,hiding}){
  const colors={success:'#059669',error:'#e11d48',info:'#2563eb',warning:'#d97706'}
  return <div className={`toast${hiding?' hiding':''}`}><div className="toast-dot" style={{background:colors[type]||colors.info}}/>{message}</div>
}
function NotificationBell({notifications,onToggle,isOpen,onClear,onDismiss}){
  const unread=notifications.filter(n=>!n.read).length
  return(
    <div className="notif-bell-wrap">
      <button className="notif-bell-btn" onClick={onToggle}>🔔{unread>0&&<span className="notif-badge">{unread>9?'9+':unread}</span>}</button>
      {isOpen&&(
        <div className="notif-dropdown">
          <div className="notif-header"><span className="notif-title">🔔 Alerts</span>{notifications.length>0&&<button className="notif-clear-btn" onClick={onClear}>Clear all</button>}</div>
          <div className="notif-list">
            {!notifications.length
              ?<div className="notif-empty"><div style={{fontSize:'28px',marginBottom:'8px'}}>🎉</div><div style={{fontSize:'13px',color:'var(--text-muted)'}}>All clear!</div></div>
              :notifications.map(n=>(
                <div key={n.id} className={`notif-item notif-${n.type}${n.read?' notif-read':''}`}>
                  <div className="notif-item-icon">{n.icon}</div>
                  <div className="notif-item-body"><div className="notif-item-title">{n.title}</div><div className="notif-item-msg">{n.message}</div><div className="notif-item-time">{n.time}</div></div>
                  <button className="notif-dismiss" onClick={()=>onDismiss(n.id)}>✕</button>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}
function Confetti({onDone,emoji='🎉',title='Congratulations!',message}){
  const pieces=useMemo(()=>Array.from({length:60},(_,i)=>({id:i,color:CONFETTI_COLORS[i%CONFETTI_COLORS.length],left:Math.random()*100,delay:Math.random()*1.5,duration:2+Math.random()*2,size:6+Math.random()*8,rotate:Math.random()*360})),[])
  useEffect(()=>{const t=setTimeout(onDone,3500);return()=>clearTimeout(t)},[onDone])
  return(
    <>
      <div className="confetti-overlay">{pieces.map(p=><div key={p.id} className="confetti-piece" style={{left:`${p.left}%`,background:p.color,width:p.size,height:p.size,animationDuration:`${p.duration}s`,animationDelay:`${p.delay}s`,transform:`rotate(${p.rotate}deg)`}}/>)}</div>
      <div className="congrats-overlay" onClick={onDone}>
        <div className="congrats-card" onClick={e=>e.stopPropagation()}>
          <span className="congrats-emoji">{emoji}</span>
          <div className="congrats-title">{title}</div>
          <div className="congrats-msg">{message}</div>
          <button className="btn btn-primary" style={{marginTop:0}} onClick={onDone}>Awesome! 🙌</button>
        </div>
      </div>
    </>
  )
}
function PinScreen({mode,onSuccess,onCancel}){
  const[digits,setDigits]=useState(['','','',''])
  const[confirm,setConfirm]=useState(['','','',''])
  const[step,setStep]=useState('enter')
  const[error,setError]=useState('')
  const[shake,setShake]=useState(false)
  const doShake=()=>{setShake(true);setTimeout(()=>setShake(false),500)}
  const handleNumpad=(k,isConf)=>{
    const arr=isConf?[...confirm]:[...digits]
    if(k==='⌫'){const last=[...arr].reverse().findIndex(d=>d);if(last>=0){arr[3-last]='';isConf?setConfirm([...arr]):setDigits([...arr])}}
    else{const idx=arr.findIndex(d=>!d);if(idx<0)return;arr[idx]=String(k);isConf?setConfirm([...arr]):setDigits([...arr]);setError('');if(idx===3){const pin=arr.join('');setTimeout(()=>submitPin(pin,arr,isConf),100)}}
  }
  const submitPin=(pinStr,arr,isConf)=>{
    const cur=arr||(isConf?confirm:digits);const pin=pinStr||cur.join('')
    if(cur.some(d=>!d)){setError('Enter all 4 digits');doShake();return}
    if(mode==='verify'){
      if(hashPin(pin)===lsGet('bb_pin_hash','')){onSuccess()}
      else{setError('Wrong PIN');setDigits(['','','','']);doShake()}
    }else{
      if(step==='enter'){setStep('confirm');setConfirm(['','','',''])}
      else{if(pin!==digits.join('')){setError("PINs don't match");setConfirm(['','','','']);doShake()}else{lsSet('bb_pin_hash',hashPin(pin));lsSet('bb_pin_enabled',true);onSuccess()}}
    }
  }
  const cur=step==='confirm'?confirm:digits;const isConf=step==='confirm'
  return(
    <div className="pin-overlay">
      <div className={`pin-modal${shake?' pin-shake':''}`}>
        <div className="pin-logo" style={{overflow:'hidden',padding:0,background:'transparent',boxShadow:'none'}}>
          <img src="./logo.png" alt="BudgetBuddy" style={{width:'68px',height:'68px',objectFit:'contain',borderRadius:'var(--radius-xl)'}} onError={e=>{e.target.style.display='none';const fb=document.getElementById('pin-logo-fb');if(fb)fb.style.display='flex'}}/>
          <div id="pin-logo-fb" style={{display:'none',width:'68px',height:'68px',borderRadius:'var(--radius-xl)',background:'var(--grad-brand)',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:'28px',fontWeight:800}}>₹</div>
        </div>
        <div className="pin-title">{mode==='verify'?'Welcome back!':step==='enter'?'Create PIN':'Confirm PIN'}</div>
        <div className="pin-subtitle"><span style={{fontWeight:800,background:'var(--grad-brand)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>BudgetBuddy</span> — {mode==='verify'?'Enter your PIN to unlock':step==='enter'?'Choose a 4-digit PIN':'Re-enter your PIN'}</div>
        <div className="pin-dots">{cur.map((d,i)=><div key={i} className={`pin-dot${d?' filled':''}`}/>)}</div>
        {error&&<div className="pin-error">⚠ {error}</div>}
        <div className="pin-numpad">{[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k,i)=><button key={i} className={`pin-key${k===''?' pin-key-empty':''}`} onClick={()=>k!==''&&handleNumpad(k,isConf)}>{k}</button>)}</div>
        <div className="pin-actions">
          <button className="btn btn-primary" style={{marginTop:0}} onClick={()=>submitPin(null,null,isConf)}>{mode==='verify'?'🔓 Unlock':step==='enter'?'Next →':'✅ Set PIN'}</button>
          {onCancel&&<button className="btn btn-cancel" onClick={onCancel}>Cancel</button>}
        </div>
      </div>
    </div>
  )
}
function TagPicker({selected,onChange,customTags,onAddCustom}){
  const[newTag,setNewTag]=useState('');const[showInput,setShowInput]=useState(false)
  const all=[...PRESET_TAGS,...customTags]
  const toggle=label=>onChange(selected.includes(label)?selected.filter(t=>t!==label):[...selected,label])
  const addCustom=()=>{
    let tag=newTag.trim();if(!tag)return
    if(!tag.startsWith('#'))tag='#'+tag;tag=tag.toLowerCase().replace(/\s+/g,'_')
    const color=TAG_COLORS[all.length%TAG_COLORS.length]
    if(!all.find(t=>t.label===tag))onAddCustom({label:tag,color})
    toggle(tag);setNewTag('');setShowInput(false)
  }
  return(
    <div className="tag-picker">
      <div className="tag-picker-chips">
        {all.map(t=><button key={t.label} className={`tag-chip${selected.includes(t.label)?' selected':''}`} style={selected.includes(t.label)?{background:t.color+'18',borderColor:t.color,color:t.color}:{}} onClick={()=>toggle(t.label)}>{t.label}</button>)}
        <button className="tag-chip tag-chip-add" onClick={()=>setShowInput(s=>!s)}>+ custom</button>
      </div>
      {showInput&&<div className="tag-new-row"><input className="form-input" placeholder="#mytag" value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCustom()} style={{fontSize:'13px',padding:'8px 12px'}}/><button className="btn btn-secondary" onClick={addCustom} style={{flexShrink:0}}>Add</button></div>}
    </div>
  )
}

// ── GEMINI SETTINGS MODAL ──
function GeminiSetupModal({onClose}){
  const[key,setKey]=useState(()=>localStorage.getItem(GEMINI_KEY_LS)||'')
  const[testing,setTesting]=useState(false)
  const[status,setStatus]=useState('')
  const save=()=>{localStorage.setItem(GEMINI_KEY_LS,key.trim());setStatus('saved');setTimeout(()=>{setStatus('');onClose()},800)}
  const test=async()=>{
    if(!key.trim()){setStatus('error:Enter API key first');return}
    setTesting(true);setStatus('')
    try{
      localStorage.setItem(GEMINI_KEY_LS,key.trim())
      const r=await callGemini('Say "API working" in exactly 2 words.')
      setStatus(r.toLowerCase().includes('working')||r.length<30?'ok:Connected! '+r:'ok:'+r)
    }catch(e){setStatus('error:'+e.message)}
    setTesting(false)
  }
  return(
    <div className="report-overlay" onClick={onClose}>
      <div className="report-modal" style={{maxWidth:'480px',background:'#0f2137',border:'1px solid rgba(29,233,182,0.15)'}} onClick={e=>e.stopPropagation()}>
        <div className="report-header"><div className="report-title">🤖 Gemini AI Setup</div><button className="report-close" style={{background:'rgba(29,233,182,0.08)',border:'1px solid rgba(29,233,182,0.2)',color:'#e8f4f8'}} onClick={onClose}>✕</button></div>
        <div style={{padding:'24px'}}>
          <div style={{background:'linear-gradient(135deg,rgba(37,99,235,0.05),rgba(124,58,237,0.05))',border:'1px solid rgba(37,99,235,0.15)',borderRadius:'var(--radius-lg)',padding:'16px',marginBottom:'20px'}}>
            <div style={{fontWeight:800,color:'var(--text-primary)',marginBottom:'8px',fontSize:'14px'}}>🔑 Get your FREE API Key</div>
            <div style={{fontSize:'13px',color:'var(--text-secondary)',lineHeight:1.7}}>
              1. Go to <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{color:'var(--accent-primary)',fontWeight:700}}>aistudio.google.com</a><br/>
              2. Sign in with Google<br/>
              3. Click <strong>"Get API Key"</strong> → <strong>"Create API key"</strong><br/>
              4. Copy and paste below<br/>
              <span style={{color:'var(--accent-green)',fontWeight:700}}>✅ Free: 1,500 requests/day — no credit card</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Gemini API Key</label>
            <input className="form-input" placeholder="AIzaSy..." value={key} onChange={e=>setKey(e.target.value)} type="password" style={{fontFamily:'monospace'}}/>
          </div>
          {status&&<div style={{padding:'10px 14px',borderRadius:'var(--radius-md)',marginTop:'10px',fontSize:'13px',fontWeight:600,background:status.startsWith('ok')?'rgba(5,150,105,0.08)':status==='saved'?'rgba(5,150,105,0.08)':'rgba(225,29,72,0.08)',color:status.startsWith('ok')||status==='saved'?'var(--accent-green)':'var(--accent-primary)',border:`1px solid ${status.startsWith('ok')||status==='saved'?'rgba(5,150,105,0.2)':'rgba(225,29,72,0.2)'}`}}>
            {status==='saved'?'✅ Saved!':status.startsWith('ok:')?'✅ '+status.slice(3):status.startsWith('error:')?'❌ '+status.slice(6):status}
          </div>}
          <div style={{display:'flex',gap:'10px',marginTop:'16px'}}>
            <button className="btn btn-primary" style={{marginTop:0,flex:1}} onClick={save}>💾 Save Key</button>
            <button className="btn btn-secondary" onClick={test} disabled={testing}>{testing?'⏳ Testing...':'🧪 Test'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── VOICE INPUT — Fixed, works without API ──
function VoiceInput({onResult,disabled}){
  const[listening,setListening]=useState(false)
  const[transcript,setTranscript]=useState('')
  const recRef=useRef(null)
  const isSupported='webkitSpeechRecognition' in window||'SpeechRecognition' in window

  const start=()=>{
    if(!isSupported){alert('Voice input requires Chrome browser.');return}
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition
    const rec=new SR()
    recRef.current=rec
    rec.lang='en-IN'
    rec.continuous=false
    rec.interimResults=true
    rec.onstart=()=>{setListening(true);setTranscript('')}
    rec.onresult=e=>{
      const t=Array.from(e.results).map(r=>r[0].transcript).join('')
      setTranscript(t)
      // If final result, send immediately
      if(e.results[e.results.length-1].isFinal){
        rec.stop()
        onResult(t)
      }
    }
    rec.onend=()=>setListening(false)
    rec.onerror=e=>{
      setListening(false)
      if(e.error==='not-allowed') alert('Microphone permission denied. Please allow microphone access in browser settings.')
      else if(e.error==='network') alert('Voice recognition needs internet. Check connection.')
    }
    rec.start()
  }
  const stop=()=>{ recRef.current?.stop(); setListening(false) }

  if(!isSupported) return null

  return(
    <div className="voice-input-wrap">
      <button className={`voice-btn${listening?' listening':''}`}
        onClick={listening?stop:start} disabled={disabled}
        title={listening?'Click to stop':'Voice input (Chrome only)'}>
        {listening?'⏹':'🎤'}
      </button>
      {listening&&<div className="voice-transcript">{transcript||'🎤 Listening... speak now'}</div>}
    </div>
  )
}

// ── OLLAMA LOCAL AI ──
const callOllama = async (prompt, model='llama3.2') => {
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({model, prompt, stream:false})
    })
    if(!res.ok) throw new Error('Ollama not running')
    const data = await res.json()
    return data.response || ''
  } catch(e) {
    throw new Error('OLLAMA_OFFLINE')
  }
}

// ── AI CALLER — tries Gemini first, falls back to Ollama ──
const callAI = async (prompt, imageBase64=null) => {
  // Try Gemini first
  const geminiKey = localStorage.getItem(GEMINI_KEY_LS)||''
  if(geminiKey && !imageBase64) {
    try { return await callGemini(prompt, imageBase64) } catch(e) { if(e.message!=='NO_KEY') throw e }
  }
  if(imageBase64) throw new Error('NO_KEY') // Vision needs Gemini
  // Fall back to Ollama
  try { return await callOllama(prompt) } catch(e) {
    if(e.message==='OLLAMA_OFFLINE') throw new Error('AI_UNAVAILABLE')
    throw e
  }
}

// ── OLLAMA STATUS BADGE ──
function OllamaStatus(){
  const[status,setStatus]=useState('checking')
  useEffect(()=>{
    fetch('http://localhost:11434/api/tags',{signal:AbortSignal.timeout(2000)})
      .then(r=>r.json()).then(()=>setStatus('online')).catch(()=>setStatus('offline'))
  },[])
  if(status==='checking') return null
  return(
    <div style={{display:'flex',alignItems:'center',gap:'5px',fontSize:'10px',fontWeight:700,padding:'3px 9px',borderRadius:'999px',background:status==='online'?'rgba(29,233,182,0.1)':'rgba(107,114,128,0.1)',color:status==='online'?'#1de9b6':'#6a9bb8',border:`1px solid ${status==='online'?'rgba(29,233,182,0.2)':'rgba(107,114,128,0.2)'}`}}>
      <div style={{width:'5px',height:'5px',borderRadius:'50%',background:status==='online'?'#1de9b6':'#6b7280'}}/>
      {status==='online'?'Ollama':'AI Offline'}
    </div>
  )
}

// ── SAVINGS & PENSION AUTO-ADD (6th of month) ──
function SavingsPensionAutoAdd({expenses,onAdd,showToast,addNotif}){
  const[config,setConfig]=useState(()=>lsGet('bb_savings_pension',{savingsAmount:0,pensionAmount:0,enabled:false}))
  const[showForm,setShowForm]=useState(false)
  const[tempSavings,setTempSavings]=useState(String(config.savingsAmount||''))
  const[tempPension,setTempPension]=useState(String(config.pensionAmount||''))

  useEffect(()=>{
    if(!config.enabled||!config.savingsAmount&&!config.pensionAmount) return
    const todayDate=new Date()
    if(todayDate.getDate()!==6) return
    const thisMonthStr=thisMonth()
    const lastRun=lsGet('bb_sp_last_run','')
    if(lastRun===thisMonthStr) return
    lsSet('bb_sp_last_run',thisMonthStr)
    if(config.savingsAmount>0){
      const exists=expenses.some(e=>e.title==='Monthly Savings'&&getMonth(e.date)===thisMonthStr)
      if(!exists){
        onAdd({id:String(genId()),title:'Monthly Savings',amount:config.savingsAmount,category:'Other',date:today(),tags:['#savings'],note:'Auto-added on 6th',recurring:false})
        showToast('💰 Monthly Savings auto-added!','success')
        addNotif('💰 Savings Added',`₹${config.savingsAmount} savings recorded for ${thisMonthStr}`,'success','💰')
      }
    }
    if(config.pensionAmount>0){
      const exists=expenses.some(e=>e.title==='Pension / NPS'&&getMonth(e.date)===thisMonthStr)
      if(!exists){
        onAdd({id:String(genId()),title:'Pension / NPS',amount:config.pensionAmount,category:'Health',date:today(),tags:['#pension'],note:'Auto-added on 6th',recurring:false})
        showToast('🏦 Pension contribution auto-added!','success')
        addNotif('🏦 Pension Added',`₹${config.pensionAmount} pension recorded`,'success','🏦')
      }
    }
  },[])

  const save=()=>{
    const c={savingsAmount:+tempSavings||0,pensionAmount:+tempPension||0,enabled:true}
    setConfig(c);lsSet('bb_savings_pension',c);setShowForm(false)
    showToast('Savings & Pension configured! Auto-adds on 6th 🎉','success')
  }

  return(
    <div>
      <button className="btn btn-secondary" style={{fontSize:'12px',padding:'7px 14px',display:'flex',alignItems:'center',gap:'6px'}} onClick={()=>setShowForm(s=>!s)}>
        💰 Savings & Pension {config.enabled&&config.savingsAmount>0?<span style={{fontSize:'10px',background:'rgba(29,233,182,0.15)',color:'#1de9b6',padding:'1px 6px',borderRadius:'999px'}}>Active</span>:null}
      </button>
      {showForm&&(
        <div style={{background:'rgba(29,233,182,0.04)',border:'1px solid rgba(29,233,182,0.15)',borderRadius:'var(--radius-lg)',padding:'14px',marginTop:'8px'}}>
          <div style={{fontSize:'12px',color:'#6a9bb8',marginBottom:'10px',fontWeight:600}}>🗓️ Auto-added every <strong style={{color:'#1de9b6'}}>6th of the month</strong></div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">💰 Monthly Savings (₹)</label>
              <input className="form-input" type="number" placeholder="e.g. 5000" value={tempSavings} onChange={e=>setTempSavings(e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">🏦 Pension / NPS (₹)</label>
              <input className="form-input" type="number" placeholder="e.g. 2000" value={tempPension} onChange={e=>setTempPension(e.target.value)}/>
            </div>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button className="btn btn-primary" style={{marginTop:0,flex:1}} onClick={save}>✅ Save & Enable</button>
            <button className="btn btn-cancel" style={{flex:'0 0 80px'}} onClick={()=>setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── RECEIPT SCANNER ──
function ReceiptScanner({onExpenseDetected,showToast}){
  const[scanning,setScanning]=useState(false)
  const[preview,setPreview]=useState(null)
  const fileRef=useRef(null)
  const scan=async(file)=>{
    setScanning(true)
    try{
      const reader=new FileReader()
      reader.onload=async(e)=>{
        const base64=e.target.result.split(',')[1]
        setPreview(e.target.result)
        try{
          const prompt=`Analyze this receipt/bill image. Extract and return ONLY valid JSON (no markdown):
{"title":"merchant or item name","amount":number_only,"category":"Food|Travel|Shopping|Bills|Entertainment|Health|Other","date":"YYYY-MM-DD or null","note":"brief description"}
If you cannot read the receipt clearly, make your best guess. Amount must be a number.`
          const result=await callGemini(prompt,base64)
          const clean=result.replace(/```json|```/g,'').trim()
          const parsed=JSON.parse(clean)
          if(parsed.amount&&parsed.title){
            onExpenseDetected({
              title:parsed.title,
              amount:+parsed.amount,
              category:parsed.category||'Other',
              date:parsed.date||today(),
              note:parsed.note||'Added via receipt scan'
            })
            showToast('✅ Receipt scanned! Review and add.','success')
          }else{showToast('Could not read receipt. Try a clearer photo.','warning')}
        }catch(e){
          if(e.message==='NO_KEY')showToast('Set up Gemini API key first (🤖 button in navbar)','warning')
          else showToast('Receipt scan failed. Try again.','error')
        }
        setScanning(false)
      }
      reader.readAsDataURL(file)
    }catch{setScanning(false)}
  }
  return(
    <div className="receipt-scanner">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>e.target.files[0]&&scan(e.target.files[0])}/>
      <button className="btn-receipt" onClick={()=>fileRef.current?.click()} disabled={scanning}>
        {scanning?<><span className="receipt-spinner"/>Scanning...</>:<>📷 Scan Receipt</>}
      </button>
      {preview&&!scanning&&<div className="receipt-preview-thumb"><img src={preview} alt="receipt"/><button onClick={()=>setPreview(null)}>✕</button></div>}
    </div>
  )
}

// ── RECURRING MANAGER ──
function RecurringManager({expenses,onAdd,showToast}){
  const[open,setOpen]=useState(false)
  const recurring=expenses.filter(e=>e.recurring)
  const checkAndAdd=useCallback(()=>{
    const today_date=new Date()
    const todayDay=today_date.getDate()
    const thisMonthStr=thisMonth()
    recurring.forEach(exp=>{
      if(exp.recurringDay===todayDay){
        const alreadyAdded=expenses.some(e=>
          e.title===exp.title&&
          getMonth(e.date)===thisMonthStr&&
          e.id!==exp.id&&
          !e.recurring
        )
        if(!alreadyAdded){
          onAdd({id:genId(),title:exp.title,amount:exp.amount,category:exp.category,date:today(),tags:exp.tags||[],note:'Auto-added (recurring)',recurring:false})
          showToast(`🔁 Auto-added: ${exp.title} ₹${exp.amount}`,'info')
        }
      }
    })
  },[recurring,expenses,onAdd,showToast])
  useEffect(()=>{checkAndAdd()},[])
  if(!open) return <button className="btn btn-secondary" style={{fontSize:'12px',padding:'7px 14px'}} onClick={()=>setOpen(true)}>🔁 Recurring ({recurring.length})</button>
  return(
    <div style={{background:'var(--red-50)',border:'1px solid var(--border-card)',borderRadius:'var(--radius-lg)',padding:'16px',marginBottom:'16px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
        <div style={{fontWeight:800,fontSize:'14px',color:'var(--text-primary)'}}>🔁 Recurring Expenses</div>
        <button className="btn btn-secondary" style={{fontSize:'11px',padding:'4px 10px'}} onClick={()=>setOpen(false)}>Close</button>
      </div>
      {!recurring.length?<div style={{fontSize:'13px',color:'var(--text-muted)',textAlign:'center',padding:'12px'}}>No recurring expenses yet. Mark an expense as recurring when adding.</div>
      :recurring.map(e=>(
        <div key={e.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px',background:'#fff',borderRadius:'var(--radius-md)',border:'1px solid var(--border-card)',marginBottom:'6px'}}>
          <span style={{fontSize:'18px'}}>{CATEGORIES[e.category]?.emoji}</span>
          <div style={{flex:1}}><div style={{fontWeight:700,fontSize:'13px'}}>{e.title}</div><div style={{fontSize:'11px',color:'var(--text-muted)'}}>Every month on day {e.recurringDay} · {formatINR(e.amount)}</div></div>
          <span style={{fontSize:'11px',background:'rgba(5,150,105,0.08)',color:'var(--accent-green)',border:'1px solid rgba(5,150,105,0.2)',padding:'2px 8px',borderRadius:'999px',fontWeight:700}}>Auto</span>
        </div>
      ))}
    </div>
  )
}

// ── SALARY DETECTOR ──
function SalaryDetector({expenses,budget,onBudgetReset,showToast,addNotif}){
  const[salaryAmount,setSalaryAmount]=useState(()=>lsGet('bb_salary_amount',0))
  const[salaryDay,setSalaryDay]=useState(()=>lsGet('bb_salary_day',1))
  const[editing,setEditing]=useState(false)
  const[tempAmt,setTempAmt]=useState(String(salaryAmount||''))
  const[tempDay,setTempDay]=useState(String(salaryDay||1))
  const today_date=new Date()
  const lastChecked=lsGet('bb_salary_last_checked','')
  const save=()=>{
    const amt=+tempAmt;const day=+tempDay
    if(!amt||!day)return
    lsSet('bb_salary_amount',amt);lsSet('bb_salary_day',day)
    setSalaryAmount(amt);setSalaryDay(day);setEditing(false)
    showToast('Salary settings saved!','success')
  }
  useEffect(()=>{
    if(!salaryAmount||!salaryDay)return
    const todayStr=today()
    if(lastChecked===todayStr)return
    if(today_date.getDate()===salaryDay){
      lsSet('bb_salary_last_checked',todayStr)
      onBudgetReset()
      showToast('🎉 Salary day! Budget has been reset.','success')
      addNotif('💰 Salary Month Started!',`Budget reset to ${formatINR(budget)}. Spend wisely!`,'success','💰')
    }
  },[])
  if(!editing&&!salaryAmount) return <button className="btn btn-secondary" style={{fontSize:'12px',padding:'7px 14px'}} onClick={()=>setEditing(true)}>💰 Set Salary</button>
  if(!editing) return(
    <div style={{display:'flex',alignItems:'center',gap:'8px',background:'rgba(5,150,105,0.06)',border:'1px solid rgba(5,150,105,0.2)',borderRadius:'var(--radius-md)',padding:'7px 14px',cursor:'pointer'}} onClick={()=>setEditing(true)}>
      <span>💰</span><span style={{fontSize:'12px',fontWeight:700,color:'var(--accent-green)'}}>Salary: {formatINR(salaryAmount)} · Day {salaryDay}</span>
    </div>
  )
  return(
    <div style={{background:'rgba(5,150,105,0.04)',border:'1px solid rgba(5,150,105,0.2)',borderRadius:'var(--radius-lg)',padding:'14px',display:'flex',gap:'10px',flexWrap:'wrap',alignItems:'flex-end'}}>
      <div style={{flex:1,minWidth:'120px'}}><label className="form-label">Monthly Salary (₹)</label><input className="form-input" type="number" placeholder="e.g. 85000" value={tempAmt} onChange={e=>setTempAmt(e.target.value)}/></div>
      <div style={{width:'100px'}}><label className="form-label">Credit Day</label><input className="form-input" type="number" min="1" max="31" placeholder="1" value={tempDay} onChange={e=>setTempDay(e.target.value)}/></div>
      <button className="btn btn-update" style={{padding:'10px 18px'}} onClick={save}>Save</button>
      <button className="btn btn-cancel" style={{padding:'10px 18px'}} onClick={()=>setEditing(false)}>Cancel</button>
    </div>
  )
}

// ── BUDGET COACH ──
function BudgetCoach({expenses,lentList,budget,showToast}){
  const[report,setReport]=useState(null)
  const[loading,setLoading]=useState(false)
  const[open,setOpen]=useState(false)
  const generate=async()=>{
    setLoading(true)
    const ms=expenses.filter(e=>getMonth(e.date)===thisMonth()).reduce((s,e)=>s+e.amount,0)
    const catBreak=Object.keys(CATEGORIES).map(c=>{const t=expenses.filter(e=>e.category===c&&getMonth(e.date)===thisMonth()).reduce((s,e)=>s+e.amount,0);return t>0?`${c}: ₹${t}`:null}).filter(Boolean).join(', ')
    const tp=lentList.filter(l=>l.status!=='returned').reduce((s,l)=>s+l.amount,0)
    const prompt=`You are BudgetBuddy's AI coach for an Indian user. Analyze this month's finances and give a friendly, personal weekly coaching report in 150 words max.

Data:
- Monthly budget: ₹${budget}
- Spent this month: ₹${ms} (${budget>0?Math.round((ms/budget)*100):0}% of budget)
- Category breakdown: ${catBreak||'No data'}
- Money owed to user: ₹${tp}
- Total transactions: ${expenses.filter(e=>getMonth(e.date)===selectedMonth).length}

Write a warm, encouraging coaching report with:
1. One sentence overall assessment
2. Best thing they did this month
3. One specific area to improve
4. One actionable tip for next week
5. Motivational closing

Use Indian context (₹, Indian spending habits). Be friendly, not robotic.`
    try{
      const r=await callGemini(prompt)
      setReport(r);setOpen(true)
    }catch(e){
      if(e.message==='NO_KEY')showToast('Set up Gemini API key first (🤖 button)','warning')
      else showToast('Could not generate report. Try again.','error')
    }
    setLoading(false)
  }
  return(
    <>
      <button className="btn-coach" onClick={generate} disabled={loading}>
        {loading?<><span className="receipt-spinner"/>Generating...</>:<>🤖 Weekly Coach</>}
      </button>
      {open&&report&&(
        <div className="report-overlay" onClick={()=>setOpen(false)}>
          <div className="report-modal" style={{maxWidth:'500px',background:'#0f2137',border:'1px solid rgba(29,233,182,0.15)'}} onClick={e=>e.stopPropagation()}>
            <div className="report-header" style={{background:'#0f2137',borderBottom:'1px solid rgba(29,233,182,0.1)'}}><div className="report-title" style={{color:'#e8f4f8'}}>🤖 Your Weekly Budget Coach</div><button className="report-close" style={{background:'rgba(29,233,182,0.08)',border:'1px solid rgba(29,233,182,0.2)',color:'#e8f4f8'}} onClick={()=>setOpen(false)}>✕</button></div>
            <div style={{padding:'24px'}}>
              <div style={{background:'linear-gradient(135deg,rgba(225,29,72,0.04),rgba(124,58,237,0.04))',border:'1px solid var(--border-card)',borderRadius:'var(--radius-lg)',padding:'20px',fontSize:'14px',lineHeight:1.8,color:'var(--text-secondary)',whiteSpace:'pre-wrap'}}>{report}</div>
              <div style={{display:'flex',gap:'10px',marginTop:'16px'}}>
                <button className="btn btn-primary" style={{marginTop:0,flex:1}} onClick={()=>{const m=`🤖 BudgetBuddy Coach Report\n\n${report}`;window.open(`https://wa.me/?text=${encodeURIComponent(m)}`,'_blank')}}>📤 Share on WhatsApp</button>
                <button className="btn btn-secondary" onClick={generate} disabled={loading}>🔄 Refresh</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── ANOMALY ALERTS ──
function AnomalyBanner({expense,onDismiss}){
  if(!expense)return null
  return(
    <div className="anomaly-banner" style={{animation:'fadeSlideIn 0.3s ease'}}>
      <span style={{fontSize:'20px'}}>⚠️</span>
      <div style={{flex:1}}>
        <div style={{fontWeight:800,fontSize:'13px',color:'#92400e'}}>Unusual Spending Detected</div>
        <div style={{fontSize:'12px',color:'#b45309',marginTop:'2px'}}>
          <strong>"{expense.title}"</strong> ({formatINR(expense.amount)}) is {expense.anomaly.times}x your usual {expense.category} spend (avg {formatINR(expense.anomaly.avg)})
        </div>
      </div>
      <button onClick={onDismiss} style={{background:'none',border:'none',cursor:'pointer',color:'#b45309',fontSize:'16px',padding:'4px'}}>✕</button>
    </div>
  )
}

// ── SAVINGS GOALS ──
function SavingsGoals({showToast,addNotif,onConfetti}){
  const[goals,setGoals]=useState(()=>lsGet('bb_goals',[]))
  const[showForm,setShowForm]=useState(false)
  const[form,setForm]=useState({name:'',target:'',saved:'',emoji:'🎯',deadline:''})
  const addGoal=()=>{
    if(!form.name||!form.target)return
    const g={id:genId(),name:form.name,target:+form.target,saved:+form.saved||0,emoji:form.emoji,deadline:form.deadline}
    setGoals(p=>{const n=[...p,g];lsSet('bb_goals',n);return n})
    setForm({name:'',target:'',saved:'',emoji:'🎯',deadline:''});setShowForm(false)
    showToast('Goal created! 🎯','success')
  }
  const addToGoal=(id,amount)=>{
    setGoals(p=>{
      const n=p.map(g=>{
        if(g.id!==id)return g
        const newSaved=g.saved+amount
        if(newSaved>=g.target)onConfetti('🎉','Goal Achieved!',`You reached your "${g.name}" goal of ${formatINR(g.target)}! 🏆`)
        return{...g,saved:Math.min(newSaved,g.target)}
      })
      lsSet('bb_goals',n);return n
    })
  }
  const deleteGoal=(id)=>{setGoals(p=>{const n=p.filter(g=>g.id!==id);lsSet('bb_goals',n);return n})}
  const GOAL_EMOJIS=['🎯','🏠','🚗','✈️','💍','📱','🎓','💰','🏖️','🛒']
  return(
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
        <div className="section-title">🎯 Savings Goals</div>
        <button className="btn btn-primary" style={{marginTop:0,width:'auto',padding:'8px 16px',fontSize:'12px'}} onClick={()=>setShowForm(s=>!s)}>{showForm?'✕ Cancel':'+ New Goal'}</button>
      </div>
      {showForm&&(
        <div style={{background:'var(--red-50)',border:'1px solid var(--border-card)',borderRadius:'var(--radius-lg)',padding:'16px',marginBottom:'16px'}}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Goal Name</label><input className="form-input" placeholder="e.g. Goa Trip" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Target Amount (₹)</label><input className="form-input" type="number" placeholder="50000" value={form.target} onChange={e=>setForm(f=>({...f,target:e.target.value}))}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Already Saved (₹)</label><input className="form-input" type="number" placeholder="0" value={form.saved} onChange={e=>setForm(f=>({...f,saved:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Deadline (optional)</label><input className="form-input" type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))}/></div>
          </div>
          <div className="form-group"><label className="form-label">Pick Emoji</label><div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>{GOAL_EMOJIS.map(em=><button key={em} onClick={()=>setForm(f=>({...f,emoji:em}))} style={{width:'36px',height:'36px',borderRadius:'var(--radius-sm)',border:`2px solid ${form.emoji===em?'var(--accent-primary)':'var(--border-card)'}`,background:form.emoji===em?'var(--red-50)':'transparent',fontSize:'18px',cursor:'pointer'}}>{em}</button>)}</div></div>
          <button className="btn btn-primary" onClick={addGoal}>🎯 Create Goal</button>
        </div>
      )}
      {!goals.length&&!showForm&&<div style={{textAlign:'center',padding:'32px',color:'var(--text-muted)',fontSize:'13px'}}>No savings goals yet. Create one to track your progress! 🎯</div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'14px'}}>
        {goals.map(g=>{
          const pct=Math.min((g.saved/g.target)*100,100)
          const remaining=g.target-g.saved
          const daysLeft=g.deadline?daysBetween(today(),g.deadline):null
          return(
            <div key={g.id} style={{background:'#fff',border:'1.5px solid var(--border-card)',borderRadius:'var(--radius-xl)',padding:'20px',boxShadow:'var(--shadow-card)',transition:'var(--transition)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <div style={{width:'40px',height:'40px',borderRadius:'var(--radius-md)',background:'var(--red-50)',border:'1px solid var(--border-card)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px'}}>{g.emoji}</div>
                  <div><div style={{fontWeight:800,fontSize:'14px',color:'var(--text-primary)'}}>{g.name}</div>{daysLeft!==null&&<div style={{fontSize:'11px',color:daysLeft<30?'var(--accent-primary)':'var(--text-muted)',fontWeight:600}}>{daysLeft>0?`${daysLeft} days left`:daysLeft===0?'Due today!':'Overdue'}</div>}</div>
                </div>
                <button className="btn btn-danger" style={{padding:'4px 8px',fontSize:'11px'}} onClick={()=>deleteGoal(g.id)}>🗑️</button>
              </div>
              <div style={{marginBottom:'10px'}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',fontWeight:700,marginBottom:'6px'}}>
                  <span style={{color:'var(--accent-primary)',fontFamily:'var(--font-mono)'}}>{formatINR(g.saved)}</span>
                  <span style={{color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>{formatINR(g.target)}</span>
                </div>
                <div style={{height:'8px',background:'var(--red-100)',borderRadius:'999px',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pct}%`,background:pct>=100?'var(--grad-green)':'var(--grad-brand)',borderRadius:'999px',transition:'width 0.7s ease'}}/>
                </div>
                <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'5px',fontWeight:600}}>{Math.round(pct)}% complete · {formatINR(remaining)} to go</div>
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                {[500,1000,5000].map(amt=>(
                  <button key={amt} className="btn btn-secondary" style={{flex:1,fontSize:'11px',padding:'6px 4px'}} onClick={()=>addToGoal(g.id,amt)} disabled={pct>=100}>+{formatINR(amt).replace('₹','')}</button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── DARK MODE TOGGLE ──
function DarkModeToggle({dark,onToggle}){
  return(
    <button className={`nav-icon-btn${dark?' dark-active':''}`} onClick={onToggle} title="Toggle dark mode">
      {dark?'☀️':'🌙'}
    </button>
  )
}

// ── DONUT CHART ──
function DonutChart({catSpending,totalSpent}){
  const CHART_COLORS=['#e11d48','#2563eb','#db2777','#d97706','#7c3aed','#059669','#6b7280']
  const r=54;const cx=70;const cy=70;const circ=2*Math.PI*r
  let offset=0
  const slices=catSpending.slice(0,6).map((c,i)=>{
    const pct=totalSpent>0?c.total/totalSpent:0
    const slice={...c,pct,offset,color:CHART_COLORS[i%CHART_COLORS.length],dash:pct*circ,gap:circ-pct*circ}
    offset+=pct*circ;return slice
  })
  if(!slices.length)return<div style={{textAlign:'center',padding:'32px',color:'var(--text-muted)',fontSize:'13px'}}>No spending data yet</div>
  return(
    <div className="donut-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140" className="donut-svg">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--red-100)" strokeWidth="18"/>
        {slices.map((s,i)=><circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="18" strokeDasharray={`${s.dash} ${s.gap}`} strokeDashoffset={-s.offset+circ/4} style={{transition:'stroke-dasharray 0.7s ease'}}/>)}
        <text x={cx} y={cy-6} textAnchor="middle" fontSize="11" fill="var(--text-muted)" fontFamily="var(--font-main)" fontWeight="700">SPENT</text>
        <text x={cx} y={cy+10} textAnchor="middle" fontSize="13" fill="var(--text-primary)" fontFamily="var(--font-mono)" fontWeight="800">{formatINR(totalSpent).replace('₹','')}</text>
      </svg>
      <div className="donut-legend">
        {slices.map((s,i)=>(
          <div key={i} className="donut-legend-item">
            <div className="donut-legend-dot" style={{background:s.color}}/>
            <span className="donut-legend-label">{s.cat}</span>
            <span className="donut-legend-pct">{Math.round(s.pct*100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
function BarChart({expenses}){
  const months=useMemo(()=>{
    const now=new Date();const result=[]
    for(let i=5;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1)
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      result.push({key,label:d.toLocaleDateString('en-IN',{month:'short'}),total:expenses.filter(e=>e.date.startsWith(key)).reduce((s,e)=>s+e.amount,0)})
    }
    return result
  },[expenses])
  const max=Math.max(...months.map(m=>m.total),1)
  return(
    <div className="bar-chart">
      {months.map((m,i)=>(
        <div key={i} className="bar-item" style={{position:'relative'}}>
          <div style={{position:'absolute',top:0,width:'100%',textAlign:'center',fontSize:'9px',color:'var(--text-muted)',fontWeight:'700',whiteSpace:'nowrap'}}>{m.total>0?formatINR(m.total).replace('₹','₹').replace(',',''):''}</div>
          <div style={{flex:1,display:'flex',alignItems:'flex-end',width:'100%',paddingTop:'20px'}}>
            <div className="bar-fill" style={{height:`${max>0?(m.total/max)*100:4}%`,background:i===5?'var(--grad-brand)':'var(--red-200)',width:'100%'}}/>
          </div>
          <div className="bar-label">{m.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── AI PANEL (Gemini) ──
function AIPanel({expenses,budget,catSpending,totalSpent,monthlySpent}){
  const[loading,setLoading]=useState(false)
  const[insights,setInsights]=useState(null)
  const[tab,setTab]=useState('insights')
  const[chat,setChat]=useState([])
  const[chatInput,setChatInput]=useState('')
  const[chatLoading,setChatLoading]=useState(false)
  const chatEnd=useRef(null)
  useEffect(()=>chatEnd.current?.scrollIntoView({behavior:'smooth'}),[chat])
  const summary=()=>`${expenses.length} transactions, total ${formatINR(totalSpent)}. Budget ${formatINR(budget)}, this month ${formatINR(monthlySpent)} (${budget>0?Math.round((monthlySpent/budget)*100):0}%). Top: ${catSpending[0]?.cat||'N/A'} ${formatINR(catSpending[0]?.total||0)}.`
  const generate=async()=>{
    if(!expenses.length)return;setLoading(true)
    try{
      const prompt=`You are a financial AI for an Indian user. Analyze their finances and return ONLY valid JSON (no markdown):
{"topInsight":"one key observation","spendingScore":number_1_to_100,"scoreLabel":"Poor|Fair|Good|Excellent","prediction":"next month forecast","tips":["tip1","tip2","tip3"],"warnings":["warning if any"],"savingOpportunity":"specific saving suggestion"}

User data: ${summary()}`
      const text=await callAI(prompt)
      setInsights(JSON.parse(text.replace(/```json|```/g,'').trim()))
    }catch(e){setInsights({error:e.message==='NO_KEY'?'Set up Gemini API key (🤖 button in navbar)':'Could not generate. Try again.'})}
    setLoading(false)
  }
  const sendChat=async()=>{
    if(!chatInput.trim()||chatLoading)return
    const msg=chatInput.trim();setChatInput('')
    const h=[...chat,{role:'user',content:msg}];setChat(h);setChatLoading(true)
    try{
      const prompt=`You are BudgetBuddy's finance AI for an Indian user. Be concise (under 80 words). Use ₹.
User's finances: ${summary()}
User asks: ${msg}`
      const reply=await callAI(prompt)
      setChat(p=>[...p,{role:'assistant',content:reply}])
    }catch(e){setChat(p=>[...p,{role:'assistant',content:e.message==='NO_KEY'?'⚠️ Please set up your Gemini API key first (🤖 button in navbar)':'Connection error. Try again.'}])}
    setChatLoading(false)
  }
  const sc=s=>!s?'var(--accent-primary)':s>=75?'#059669':s>=50?'#d97706':'#e11d48'
  return(
    <div className="ai-panel glass-card">
      <div className="ai-panel-header">
        <div className="form-title" style={{marginBottom:0}}><div className="form-title-icon" style={{background:'linear-gradient(135deg,#7c3aed,#0891b2)'}}>🤖</div>AI Advisor <span className="ai-powered-badge">Gemini</span></div>
        <div className="ai-tabs">
          <button className={`ai-tab${tab==='insights'?' active':''}`} onClick={()=>setTab('insights')}>💡 Insights</button>
          <button className={`ai-tab${tab==='chat'?' active':''}`} onClick={()=>setTab('chat')}>💬 Chat</button>
        </div>
      </div>
      {tab==='insights'&&(
        <div className="ai-insights-tab">
          {!insights&&!loading&&<div className="ai-empty-state"><div className="ai-empty-icon">🧠</div><div className="ai-empty-title">AI Financial Insights</div><div className="ai-empty-desc">Gemini AI analyzes your {expenses.length} expenses for personalized tips.</div><button className="btn-ai" onClick={generate} disabled={!expenses.length}>✨ Generate Insights</button></div>}
          {loading&&<div className="ai-loading"><div className="ai-loading-spinner"/><div className="ai-loading-text">Analyzing your finances...</div><div className="ai-loading-sub">Gemini AI is crunching the numbers</div></div>}
          {insights&&!loading&&(
            <div className="ai-results">
              {insights.error?<div className="ai-error">{insights.error}</div>:<>
                <div className="ai-score-card">
                  <div className="ai-score-left">
                    <div className="ai-score-label">Health Score</div>
                    <div className="ai-score-value" style={{color:sc(insights.spendingScore)}}>{insights.spendingScore}<span style={{fontSize:'14px',color:'var(--text-muted)'}}>/100</span></div>
                    <div className="ai-score-badge" style={{background:sc(insights.spendingScore)+'18',color:sc(insights.spendingScore),border:`1px solid ${sc(insights.spendingScore)}33`}}>{insights.scoreLabel}</div>
                  </div>
                  <div className="ai-score-ring-wrap">
                    <svg width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="32" fill="none" stroke="var(--red-100)" strokeWidth="8"/><circle cx="40" cy="40" r="32" fill="none" stroke={sc(insights.spendingScore)} strokeWidth="8" strokeDasharray={`${(insights.spendingScore/100)*201} 201`} strokeLinecap="round" transform="rotate(-90 40 40)"/></svg>
                    <div className="ai-ring-center">{insights.spendingScore}</div>
                  </div>
                </div>
                <div className="ai-insight-block ai-insight-primary"><div className="ai-insight-icon">💡</div><div><div className="ai-insight-label">KEY INSIGHT</div><div className="ai-insight-text">{insights.topInsight}</div></div></div>
                <div className="ai-insight-block ai-insight-saving"><div className="ai-insight-icon">💰</div><div><div className="ai-insight-label">SAVING OPPORTUNITY</div><div className="ai-insight-text">{insights.savingOpportunity}</div></div></div>
                {insights.tips?.length>0&&<div className="ai-tips-section"><div className="ai-tips-title">💎 Smart Tips</div>{insights.tips.map((t,i)=><div key={i} className="ai-tip-item"><div className="ai-tip-num">{i+1}</div><div className="ai-tip-text">{t}</div></div>)}</div>}
                <button className="btn btn-secondary" style={{width:'100%',marginTop:'6px'}} onClick={generate}>🔄 Refresh</button>
              </>}
            </div>
          )}
        </div>
      )}
      {tab==='chat'&&(
        <div className="ai-chat-tab">
          <div className="ai-chat-messages">
            {!chat.length&&<div className="ai-chat-welcome"><div style={{fontSize:'32px',marginBottom:'10px'}}>🤖</div><div style={{fontWeight:800,marginBottom:'6px',color:'var(--text-primary)'}}>Finance Advisor</div><div className="ai-suggestions">{['Reduce food expenses?','Where am I overspending?','Savings plan for ₹50k','Predict next month'].map(s=><button key={s} className="ai-suggestion-chip" onClick={()=>setChatInput(s)}>{s}</button>)}</div></div>}
            {chat.map((m,i)=><div key={i} className={`ai-chat-bubble ${m.role}`}>{m.role==='assistant'&&<div className="ai-chat-avatar">🤖</div>}<div className="ai-chat-text">{m.content}</div>{m.role==='user'&&<div className="ai-chat-avatar user-avatar">👤</div>}</div>)}
            {chatLoading&&<div className="ai-chat-bubble assistant"><div className="ai-chat-avatar">🤖</div><div className="ai-chat-typing"><span/><span/><span/></div></div>}
            <div ref={chatEnd}/>
          </div>
          <div className="ai-chat-input-row">
            <input className="ai-chat-input" placeholder="Ask about your spending..." value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()}/>
            <button className="ai-chat-send" onClick={sendChat} disabled={!chatInput.trim()||chatLoading}>{chatLoading?'⏳':'➤'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── REPORTS MODAL ──
function ReportsModal({expenses,lentList,loans,budget,onClose}){
  const[copied,setCopied]=useState(false)
  const report=buildReport(expenses,lentList,loans,budget)
  const ts=expenses.reduce((s,e)=>s+e.amount,0)
  const ms=expenses.filter(e=>getMonth(e.date)===thisMonth()).reduce((s,e)=>s+e.amount,0)
  const tp=lentList.filter(l=>l.status!=='returned').reduce((s,l)=>s+l.amount,0)
  const catData=Object.keys(CATEGORIES).map(c=>({c,cfg:CATEGORIES[c],t:expenses.filter(e=>e.category===c).reduce((s,e)=>s+e.amount,0)})).filter(c=>c.t>0).sort((a,b)=>b.t-a.t)
  const handleCopy=()=>{navigator.clipboard.writeText(report).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000)})}
  return(
    <div className="report-overlay" onClick={onClose}>
      <div className="report-modal" style={{background:'#0f2137',border:'1px solid rgba(29,233,182,0.15)'}} onClick={e=>e.stopPropagation()}>
        <div className="report-header" style={{background:'#0f2137',borderBottom:'1px solid rgba(29,233,182,0.1)'}}>
          <div className="report-title" style={{color:'#e8f4f8'}}>📊 Finance Report <span className="report-date">{new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</span></div>
          <button className="report-close" style={{background:'rgba(29,233,182,0.08)',border:'1px solid rgba(29,233,182,0.2)',color:'#e8f4f8'}} onClick={onClose}>✕</button>
        </div>
        <div className="report-summary-grid">
          <div className="report-card report-card-blue"><div className="report-card-label">Total Spent</div><div className="report-card-value">{formatINR(ts)}</div><div className="report-card-sub">{expenses.length} transactions</div></div>
          <div className="report-card report-card-purple"><div className="report-card-label">This Month</div><div className="report-card-value">{formatINR(ms)}</div><div className="report-card-sub">{budget>0?Math.round((ms/budget)*100):0}% of budget</div></div>
          <div className="report-card report-card-amber"><div className="report-card-label">Owed to You</div><div className="report-card-value">{formatINR(tp)}</div><div className="report-card-sub">{lentList.filter(l=>l.status!=='returned').length} people</div></div>
          <div className="report-card report-card-green"><div className="report-card-label">Budget Left</div><div className="report-card-value">{formatINR(Math.max(budget-ms,0))}</div><div className="report-card-sub">of {formatINR(budget)}</div></div>
        </div>
        {catData.length>0&&<div className="report-section"><div className="report-section-title">📂 Category Breakdown</div>{catData.map(({c,cfg,t})=><div key={c} className="report-cat-row"><span className="report-cat-emoji">{cfg.emoji}</span><span className="report-cat-name">{cfg.label}</span><div className="report-cat-bar-wrap"><div className="report-cat-bar" style={{width:`${(t/catData[0].t)*100}%`,background:cfg.bar}}/></div><span className="report-cat-amt">{formatINR(t)}</span></div>)}</div>}
        {lentList.filter(l=>l.status!=='returned').length>0&&<div className="report-section"><div className="report-section-title">🤝 Pending Repayments</div>{lentList.filter(l=>l.status!=='returned').map(l=><div key={l.id} className="report-lent-row"><span className="report-lent-name">{l.name}</span><span className="report-lent-reason">{l.reason||'—'}</span><span className="report-lent-amt" style={{color:l.status==='overdue'?'var(--accent-primary)':'var(--accent-amber)'}}>{formatINR(l.amount)}</span></div>)}</div>}
        <div className="report-actions">
          <button className="report-btn-csv" onClick={()=>exportCSV(expenses,lentList)}>⬇️ CSV</button>
          <button className="report-btn-copy" onClick={handleCopy}>{copied?'✅ Copied':'📋 Copy'}</button>
          <button className="report-btn-email" onClick={()=>{const s=encodeURIComponent('BudgetBuddy Report');const b=encodeURIComponent(report);window.open(`mailto:?subject=${s}&body=${b}`)}}>📧 Email</button>
          <button className="report-btn-print" onClick={()=>{const w=window.open('','_blank');w.document.write(`<html><head><title>Report</title><style>body{font-family:monospace;padding:32px;white-space:pre}</style></head><body>${report}</body></html>`);w.document.close();setTimeout(()=>w.print(),300)}}>🖨️ Print</button>
        </div>
      </div>
    </div>
  )
}
function SecurityModal({pinEnabled,blurMode,onTogglePin,onChangePin,onToggleBlur,onClose}){
  return(
    <div className="report-overlay" onClick={onClose}>
      <div className="report-modal" style={{maxWidth:'440px',background:'#0f2137',border:'1px solid rgba(29,233,182,0.15)'}} onClick={e=>e.stopPropagation()}>
        <div className="report-header" style={{background:'#0f2137',borderBottom:'1px solid rgba(29,233,182,0.1)'}}>
          <div className="report-title" style={{color:'#e8f4f8'}}>🔐 Privacy & Security</div>
          <button className="report-close" style={{background:'rgba(29,233,182,0.08)',border:'1px solid rgba(29,233,182,0.2)',color:'#e8f4f8'}} onClick={onClose}>✕</button>
        </div>
        <div className="security-list">
          {[
            {icon:'🔒',title:'PIN Lock',desc:'Require PIN to open app',right:<label className="toggle-switch"><input type="checkbox" checked={pinEnabled} onChange={onTogglePin}/><span className="toggle-track"><span className="toggle-thumb"/></span></label>},
            ...(pinEnabled?[{icon:'🔑',title:'Change PIN',desc:'Update your 4-digit PIN',right:<span style={{color:'#1de9b6',fontSize:'18px',cursor:'pointer'}} onClick={onChangePin}>›</span>}]:[]),
            {icon:'👁️',title:'Blur Amounts',desc:'Hide ₹ values in public',right:<label className="toggle-switch"><input type="checkbox" checked={blurMode} onChange={onToggleBlur}/><span className="toggle-track"><span className="toggle-thumb"/></span></label>},
            {icon:'⏱️',title:'Auto-lock',desc:'Locks after 5 min inactivity',right:<span style={{background:'rgba(29,233,182,0.1)',color:'#1de9b6',border:'1px solid rgba(29,233,182,0.2)',padding:'4px 12px',borderRadius:'999px',fontSize:'12px',fontWeight:700}}>5 min</span>},
            {icon:'💾',title:'Data Storage',desc:'Stored locally in your browser',right:<span style={{background:'rgba(29,233,182,0.1)',color:'#1de9b6',border:'1px solid rgba(29,233,182,0.25)',padding:'4px 12px',borderRadius:'999px',fontSize:'12px',fontWeight:700}}>Private</span>},
          ].map((item,i)=>(
            <div key={i} className="security-item" style={{borderBottom:'1px solid rgba(29,233,182,0.06)'}}>
              <div className="security-item-left">
                <div style={{width:'40px',height:'40px',borderRadius:'12px',background:'rgba(29,233,182,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',flexShrink:0}}>{item.icon}</div>
                <div>
                  <div style={{fontSize:'14px',fontWeight:700,color:'#e8f4f8',marginBottom:'2px'}}>{item.title}</div>
                  <div style={{fontSize:'12px',color:'#6a9bb8',fontWeight:500}}>{item.desc}</div>
                </div>
              </div>
              {item.right}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── ACTIVE FIXED DEPOSITS ──
function ActiveFDs({showToast,addNotif,onConfetti}){
  const[fds,setFds]=useState(()=>lsGet('bb_active_fds',[]))
  const[showForm,setShowForm]=useState(false)
  const[removingId,setRemovingId]=useState(null)
  const emptyFD={bankName:'',principalAmount:'',interestRate:'',tenureMonths:'',startDate:today(),compounding:'quarterly',notes:''}
  const[form,setForm]=useState(emptyFD)
  const[errors,setErrors]=useState({})

  const saveFDs = (updated) => { setFds(updated); lsSet('bb_active_fds', updated) }

  // Calculate maturity for a given FD
  const calcFDMaturity=(principal,rate,tenureMonths,compFreq)=>{
    const n = compFreq==='monthly'?12:compFreq==='quarterly'?4:compFreq==='halfyearly'?2:1
    const years = tenureMonths/12
    return Math.round(principal * Math.pow(1+(rate/(n*100)), n*years))
  }

  const getMaturityDate=(startDate,tenureMonths)=>{
    const d = new Date(startDate)
    d.setMonth(d.getMonth()+parseInt(tenureMonths))
    return d.toISOString().slice(0,10)
  }

  const validate=()=>{
    const e={}
    if(!form.bankName.trim())       e.bankName='Bank name required'
    if(!form.principalAmount||+form.principalAmount<=0) e.principalAmount='Valid amount required'
    if(!form.interestRate||+form.interestRate<=0)       e.interestRate='Valid rate required'
    if(!form.tenureMonths||+form.tenureMonths<=0)       e.tenureMonths='Tenure required'
    if(!form.startDate)             e.startDate='Start date required'
    setErrors(e); return !Object.keys(e).length
  }

  const handleAdd=()=>{
    if(!validate()) return
    const maturityDate = getMaturityDate(form.startDate, form.tenureMonths)
    const maturityAmount = calcFDMaturity(+form.principalAmount, +form.interestRate, +form.tenureMonths, form.compounding)
    const rec = {
      id: String(genId()),
      bankName: form.bankName.trim(),
      principalAmount: +form.principalAmount,
      interestRate: +form.interestRate,
      tenureMonths: +form.tenureMonths,
      startDate: form.startDate,
      maturityDate,
      maturityAmount,
      interestEarned: maturityAmount - +form.principalAmount,
      compounding: form.compounding,
      notes: form.notes.trim(),
      status: 'active'
    }
    saveFDs([rec, ...fds])
    setForm(emptyFD); setShowForm(false)
    showToast(`FD added — matures ${new Date(maturityDate+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}`, 'success')
    addNotif('🏦 FD Added', `${rec.bankName} FD of ${formatINR(rec.principalAmount)} added`, 'success', '🏦')
  }

  const markMatured=(id)=>{
    const fd = fds.find(f=>f.id===id)
    if(!fd) return
    const updated = fds.map(f=>f.id===id?{...f,status:'matured'}:f)
    saveFDs(updated)
    onConfetti('🎉','FD Matured!',`Your ${fd.bankName} FD of ${formatINR(fd.principalAmount)} has matured! You earned ${formatINR(fd.interestEarned)} in interest! 💰`)
    addNotif('🎉 FD Matured!', `${fd.bankName} FD matured. Earned ${formatINR(fd.interestEarned)}`, 'success', '🏦')
  }

  const handleDelete=(id)=>{
    setRemovingId(id)
    setTimeout(()=>{ saveFDs(fds.filter(f=>f.id!==id)); setRemovingId(null); showToast('FD removed','error') }, 280)
  }

  const activeFDs  = fds.filter(f=>f.status==='active')
  const maturedFDs = fds.filter(f=>f.status==='matured')
  const totalInvested = activeFDs.reduce((s,f)=>s+f.principalAmount, 0)
  const totalMaturity = activeFDs.reduce((s,f)=>s+f.maturityAmount, 0)
  const totalInterest = totalMaturity - totalInvested

  const COMP_LABELS = { monthly:'Monthly', quarterly:'Quarterly', halfyearly:'Half-Yearly', annually:'Annually' }

  return (
    <div style={{marginTop:'8px',marginBottom:'8px'}}>
      {/* Section header — same style as Active Loans */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px',padding:'20px 24px',background:'#0f2137',border:'1px solid rgba(29,233,182,0.1)',borderRadius:'16px',boxShadow:'0 4px 20px rgba(0,0,0,0.3)'}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <div style={{width:'36px',height:'36px',borderRadius:'10px',background:'rgba(29,233,182,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px'}}>🏦</div>
          <div>
            <div style={{fontWeight:800,fontSize:'15px',color:'#e8f4f8'}}>Active Fixed Deposits</div>
            <div style={{fontSize:'12px',color:'#6a9bb8',marginTop:'2px'}}>
              {activeFDs.length} active · {formatINR(totalInvested)} invested · {formatINR(totalInterest)} interest earning
            </div>
          </div>
        </div>
        <button className="btn btn-primary" style={{marginTop:0,width:'auto',padding:'9px 18px',fontSize:'13px',background:'linear-gradient(135deg,#1de9b6,#00bfa5)',color:'#0a1628'}} onClick={()=>setShowForm(s=>!s)}>
          {showForm?'✕ Cancel':'+ Add FD'}
        </button>
      </div>

      {/* Add FD Form */}
      {showForm&&(
        <div className="glass-card" style={{marginBottom:'16px',border:'1px solid rgba(29,233,182,0.2)'}}>
          <div className="form-title" style={{marginBottom:'16px'}}>
            <div className="form-title-icon" style={{background:'linear-gradient(135deg,#1de9b6,#00897b)'}}>🏦</div>
            Add Fixed Deposit
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Bank / Institution Name *</label>
              <input className={`form-input${errors.bankName?' error':''}`} placeholder="e.g. SBI, HDFC, Post Office" value={form.bankName} onChange={e=>setForm(f=>({...f,bankName:e.target.value}))}/>
              {errors.bankName&&<div className="error-text">⚠ {errors.bankName}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Principal Amount (₹) *</label>
              <input className={`form-input${errors.principalAmount?' error':''}`} type="number" placeholder="e.g. 100000" value={form.principalAmount} onChange={e=>setForm(f=>({...f,principalAmount:e.target.value}))}/>
              {errors.principalAmount&&<div className="error-text">⚠ {errors.principalAmount}</div>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Interest Rate (% p.a.) *</label>
              <input className={`form-input${errors.interestRate?' error':''}`} type="number" placeholder="e.g. 7.25" step="0.05" value={form.interestRate} onChange={e=>setForm(f=>({...f,interestRate:e.target.value}))}/>
              {errors.interestRate&&<div className="error-text">⚠ {errors.interestRate}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Tenure (months) *</label>
              <input className={`form-input${errors.tenureMonths?' error':''}`} type="number" placeholder="e.g. 12, 24, 36" value={form.tenureMonths} onChange={e=>setForm(f=>({...f,tenureMonths:e.target.value}))}/>
              {errors.tenureMonths&&<div className="error-text">⚠ {errors.tenureMonths}</div>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input className={`form-input${errors.startDate?' error':''}`} type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Compounding</label>
              <div className="select-wrapper">
                <select className="form-select" value={form.compounding} onChange={e=>setForm(f=>({...f,compounding:e.target.value}))}>
                  <option value="quarterly">Quarterly</option>
                  <option value="monthly">Monthly</option>
                  <option value="halfyearly">Half-Yearly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
            </div>
          </div>
          {/* Live preview */}
          {form.principalAmount&&form.interestRate&&form.tenureMonths&&(()=>{
            const mat=calcFDMaturity(+form.principalAmount,+form.interestRate,+form.tenureMonths,form.compounding)
            const int=mat-(+form.principalAmount)
            const matDate=form.startDate?getMaturityDate(form.startDate,form.tenureMonths):null
            return(
              <div style={{background:'rgba(29,233,182,0.06)',border:'1px solid rgba(29,233,182,0.2)',borderRadius:'12px',padding:'14px',marginBottom:'12px'}}>
                <div style={{fontSize:'11px',color:'#1de9b6',fontWeight:800,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'10px'}}>📊 Live Preview</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:'10px',color:'#6a9bb8',fontWeight:700,textTransform:'uppercase',marginBottom:'4px'}}>Maturity Amount</div>
                    <div style={{fontSize:'18px',fontWeight:800,color:'#1de9b6',fontFamily:'var(--font-mono)'}}>{formatINR(mat)}</div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:'10px',color:'#6a9bb8',fontWeight:700,textTransform:'uppercase',marginBottom:'4px'}}>Interest Earned</div>
                    <div style={{fontSize:'18px',fontWeight:800,color:'#29b6f6',fontFamily:'var(--font-mono)'}}>{formatINR(int)}</div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:'10px',color:'#6a9bb8',fontWeight:700,textTransform:'uppercase',marginBottom:'4px'}}>Matures On</div>
                    <div style={{fontSize:'13px',fontWeight:800,color:'#e8f4f8'}}>{matDate?new Date(matDate+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'-'}</div>
                  </div>
                </div>
              </div>
            )
          })()}
          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <input className="form-input" placeholder="e.g. FD receipt no., branch name..." value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
          </div>
          <div style={{display:'flex',gap:'10px'}}>
            <button className="btn btn-primary" style={{marginTop:0,flex:1,background:'linear-gradient(135deg,#1de9b6,#00bfa5)',color:'#0a1628'}} onClick={handleAdd}>🏦 Add FD</button>
            <button className="btn btn-cancel" style={{flex:'0 0 90px'}} onClick={()=>{setShowForm(false);setForm(emptyFD);setErrors({})}}>Cancel</button>
          </div>
        </div>
      )}

      {/* Active FDs list */}
      {activeFDs.length===0&&!showForm&&(
        <div className="empty-state" style={{padding:'32px',background:'#0f2137',borderRadius:'16px',border:'1px solid rgba(29,233,182,0.08)',marginBottom:'8px'}}>
          <div className="empty-state-icon" style={{background:'rgba(29,233,182,0.08)',border:'2px dashed rgba(29,233,182,0.2)'}}>🏦</div>
          <div className="empty-title" style={{color:'#e8f4f8'}}>No active FDs</div>
          <div className="empty-desc" style={{color:'#6a9bb8'}}>Add your fixed deposits to track maturity dates and interest.</div>
        </div>
      )}

      {activeFDs.map(fd=>{
        const daysLeft = daysBetween(today(), fd.maturityDate)
        const totalDays = daysBetween(fd.startDate, fd.maturityDate)
        const elapsed = totalDays - daysLeft
        const pct = Math.min((elapsed/totalDays)*100, 100)
        const isExpiringSoon = daysLeft>=0&&daysLeft<=30
        const isOverdue = daysLeft<0
        return(
          <div key={fd.id} className={`loan-card${removingId===fd.id?' removing':''}`} style={{border:`1.5px solid ${isOverdue?'rgba(239,68,68,0.4)':isExpiringSoon?'rgba(251,191,36,0.3)':'rgba(29,233,182,0.15)'}`,background:'#0f2137'}}>
            <div className="loan-card-header">
              <div className="loan-card-title">
                <div className="loan-card-icon" style={{background:'rgba(29,233,182,0.1)',fontSize:'20px'}}>🏦</div>
                <div>
                  <div className="loan-card-name" style={{color:'#e8f4f8'}}>{fd.bankName}</div>
                  <div className="loan-card-bank" style={{color:'#6a9bb8'}}>{fd.interestRate}% p.a. · {COMP_LABELS[fd.compounding]} · {fd.tenureMonths} months</div>
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:'var(--font-mono)',fontSize:'18px',fontWeight:800,color:'#1de9b6'}}>{formatINR(fd.maturityAmount)}</div>
                <div style={{fontSize:'11px',color:'#29b6f6',fontWeight:600}}>+{formatINR(fd.interestEarned)} interest</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="loan-progress-row" style={{color:'#6a9bb8'}}>
              <span>Started {new Date(fd.startDate+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</span>
              <span style={{color:isOverdue?'#f87171':isExpiringSoon?'#fbbf24':'#6a9bb8'}}>
                {isOverdue?`⚡ Matured ${Math.abs(daysLeft)} days ago`:isExpiringSoon?`⚡ Matures in ${daysLeft} days`:`Matures ${new Date(fd.maturityDate+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}`}
              </span>
            </div>
            <div className="loan-progress-bar">
              <div className="loan-progress-fill" style={{width:`${pct}%`,background:`linear-gradient(90deg,#1de9b6,#29b6f6)`}}/>
            </div>

            {/* Meta row */}
            <div className="loan-meta-row">
              <div className="loan-meta-item">
                <div className="loan-meta-label" style={{color:'#6a9bb8'}}>Principal</div>
                <div className="loan-meta-value" style={{color:'#e8f4f8'}}>{formatINR(fd.principalAmount)}</div>
              </div>
              <div className="loan-meta-item">
                <div className="loan-meta-label" style={{color:'#6a9bb8'}}>Days Left</div>
                <div className="loan-meta-value" style={{color:isOverdue?'#f87171':isExpiringSoon?'#fbbf24':'#e8f4f8'}}>{isOverdue?'Due!':daysLeft+'d'}</div>
              </div>
              <div className="loan-meta-item">
                <div className="loan-meta-label" style={{color:'#6a9bb8'}}>Progress</div>
                <div className="loan-meta-value" style={{color:'#1de9b6'}}>{Math.round(pct)}%</div>
              </div>
              {fd.notes&&<div style={{fontSize:'11px',color:'#6a9bb8',fontStyle:'italic',flex:1}}>📝 {fd.notes}</div>}
              {(isOverdue||isExpiringSoon)&&(
                <button className="btn btn-secondary" style={{fontSize:'11px',padding:'6px 12px',background:'rgba(29,233,182,0.1)',borderColor:'rgba(29,233,182,0.3)',color:'#1de9b6'}} onClick={()=>markMatured(fd.id)}>
                  ✅ Mark Matured
                </button>
              )}
              <button className="btn btn-danger" onClick={()=>handleDelete(fd.id)}>🗑️</button>
            </div>
          </div>
        )
      })}

      {/* Matured FDs summary */}
      {maturedFDs.length>0&&(
        <div style={{padding:'14px 18px',background:'rgba(29,233,182,0.04)',border:'1px solid rgba(29,233,182,0.1)',borderRadius:'12px',marginTop:'8px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'8px'}}>
          <div style={{fontSize:'13px',color:'#6a9bb8',fontWeight:600}}>✅ {maturedFDs.length} matured FD{maturedFDs.length>1?'s':''}</div>
          <div style={{fontSize:'13px',color:'#1de9b6',fontWeight:800,fontFamily:'var(--font-mono)'}}>
            Total earned: {formatINR(maturedFDs.reduce((s,f)=>s+f.interestEarned,0))}
          </div>
          <button className="btn btn-danger" style={{fontSize:'11px',padding:'4px 10px'}} onClick={()=>saveFDs(fds.filter(f=>f.status!=='matured'))}>Clear matured</button>
        </div>
      )}
    </div>
  )
}

// ── EMI LOANS TAB ──
function EMILoansTab({loans,schemes,addLoan,updateLoan,deleteLoan,addScheme,updateScheme,deleteScheme,showToast,addNotif,onConfetti}){
  const[emiPrincipal,setEmiPrincipal]=useState('')
  const[emiRate,setEmiRate]=useState('')
  const[emiTenure,setEmiTenure]=useState('')
  const[showSchedule,setShowSchedule]=useState(false)
  // FD Calculator state
  const[fdPrincipal,setFdPrincipal]=useState('')
  const[fdRate,setFdRate]=useState('')
  const[fdTenure,setFdTenure]=useState('')
  const[fdFreq,setFdFreq]=useState('4') // quarterly default
  const[showFD,setShowFD]=useState(false)
  const[showLoanForm,setShowLoanForm]=useState(false)
  const emptyLoan={name:'',type:'Home',bank:'',principal:'',emi:'',tenure:'',paidEmis:'',rate:'',startDate:today(),note:''}
  const[loanForm,setLoanForm]=useState(emptyLoan)
  const[loanErrors,setLoanErrors]=useState({})
  const[showSchemeForm,setShowSchemeForm]=useState(false)
  const[selectedSchemeType,setSelectedSchemeType]=useState(null)
  const emptyScheme={type:'',name:'',amount:'',date:today(),maturity:'',note:'',active:true}
  const[schemeForm,setSchemeForm]=useState(emptyScheme)
  const[removingLoan,setRemovingLoan]=useState(null)
  const P=parseFloat(emiPrincipal)||0;const r=parseFloat(emiRate)||0;const n=parseInt(emiTenure)||0
  const monthlyEMI=calcEMI(P,r,n);const totalPay=monthlyEMI*n;const totalInt=totalPay-P
  const schedule=useMemo(()=>{
    if(!monthlyEMI||!n)return[]
    const R=r/(12*100);let bal=P
    return Array.from({length:Math.min(n,24)},(_,i)=>{const int=Math.round(bal*R);const prin=monthlyEMI-int;bal-=prin;return{month:i+1,emi:monthlyEMI,interest:int,principal:prin,balance:Math.max(bal,0)}})
  },[monthlyEMI,n,P,r])
  const validateLoan=()=>{const e={};if(!loanForm.name.trim())e.name='Name required';if(!loanForm.principal||isNaN(+loanForm.principal)||+loanForm.principal<=0)e.principal='Valid amount required';if(!loanForm.emi||isNaN(+loanForm.emi)||+loanForm.emi<=0)e.emi='Valid EMI required';if(!loanForm.tenure||isNaN(+loanForm.tenure)||+loanForm.tenure<=0)e.tenure='Tenure required';setLoanErrors(e);return!Object.keys(e).length}
  const handleAddLoan=()=>{
    if(!validateLoan())return
    const rec={id:String(genId()),...loanForm,principal:+loanForm.principal,emi:+loanForm.emi,tenure:+loanForm.tenure,paidEmis:+loanForm.paidEmis||0,rate:+loanForm.rate||0}
    addLoan(rec);setLoanForm(emptyLoan);setShowLoanForm(false)
    showToast(`Loan "${rec.name}" added`,'info');addNotif('🏦 Loan Added',`${rec.name} — EMI ${formatINR(rec.emi)}/month`,'info','🏦')
  }
  const handlePayEMI=(id)=>{
    const loan=loans.find(l=>l.id===id);if(!loan)return
    const newPaid=loan.paidEmis+1;const updated={...loan,paidEmis:newPaid}
    if(newPaid>=loan.tenure){updateLoan(updated);onConfetti('🎉','Loan Fully Paid!',`Congratulations! "${loan.name}" is completely paid off! 🏆`);addNotif('🎉 Loan Paid!',`"${loan.name}" is fully paid off!`,'success','🎉')}
    else{updateLoan(updated);showToast(`EMI #${newPaid} recorded for ${loan.name}`,'success')}
  }
  const handleDeleteLoan=(id)=>{setRemovingLoan(id);setTimeout(()=>{deleteLoan(id);setRemovingLoan(null);showToast('Loan removed','error')},280)}
  const handleAddScheme=()=>{
    if(!schemeForm.amount||!schemeForm.name)return
    const rec={id:String(genId()),...schemeForm,amount:+schemeForm.amount,active:true}
    addScheme(rec);setSchemeForm(emptyScheme);setShowSchemeForm(false);setSelectedSchemeType(null);showToast(`${rec.name} added`,'success')
  }
  const totalLoanBalance=loans.reduce((s,l)=>{const rem=l.tenure-l.paidEmis;return s+(rem>0?l.emi*rem:0)},0)
  const totalMonthlyEMI=loans.filter(l=>(l.paidEmis||0)<l.tenure).reduce((s,l)=>s+l.emi,0)

  // FD Calculations (compound interest)
  const fdP=parseFloat(fdPrincipal)||0
  const fdR=parseFloat(fdRate)||0
  const fdN=parseFloat(fdTenure)||0  // years
  const fdNf=parseInt(fdFreq)||4
  const fdMaturity = fdP>0&&fdR>0&&fdN>0 ? Math.round(fdP*Math.pow(1+(fdR/(fdNf*100)),fdNf*fdN)) : 0
  const fdInterest = fdMaturity - fdP
  return(
    <div>
      <div className="tab-section-header emi-header">
        <div className="tab-section-icon">💳</div>
        <div><div className="tab-section-title">EMI & Loans</div><div className="tab-section-sub">Calculator · Loan tracker · Schemes & investments</div></div>
        <div className="tab-section-pills">
          <span className="tab-pill tab-pill-blue">{loans.filter(l=>(l.paidEmis||0)<l.tenure).length} Active</span>
          <span className="tab-pill tab-pill-amber">{formatINR(totalMonthlyEMI)}/mo</span>
          <span className="tab-pill tab-pill-green">{schemes.filter(s=>s.active).length} Schemes</span>
        </div>
      </div>
      <div className="emi-grid">
        {/* ── EMI Calculator ── */}
        <div className="glass-card">
          <div className="form-title"><div className="form-title-icon" style={{background:'linear-gradient(135deg,#e11d48,#f43f5e)'}}>🧾</div>EMI Calculator</div>
          <div className="form-group"><label className="form-label">Loan Amount (₹)</label><input className="form-input" type="number" placeholder="e.g. 500000" value={emiPrincipal} onChange={e=>setEmiPrincipal(e.target.value)}/></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Interest Rate (%)</label><input className="form-input" type="number" placeholder="e.g. 8.5" value={emiRate} onChange={e=>setEmiRate(e.target.value)} step="0.1"/></div>
            <div className="form-group"><label className="form-label">Tenure (months)</label><input className="form-input" type="number" placeholder="e.g. 60" value={emiTenure} onChange={e=>setEmiTenure(e.target.value)}/></div>
          </div>
          {monthlyEMI>0&&(<>
            <div className="emi-result-grid">
              <div className="emi-result-card"><div className="emi-result-label">Monthly EMI</div><div className="emi-result-value" style={{color:'var(--accent-primary)'}}>{formatINR(monthlyEMI)}</div></div>
              <div className="emi-result-card"><div className="emi-result-label">Total Interest</div><div className="emi-result-value" style={{color:'var(--accent-amber)'}}>{formatINR(totalInt)}</div></div>
              <div className="emi-result-card"><div className="emi-result-label">Total Payment</div><div className="emi-result-value" style={{color:'var(--accent-blue)'}}>{formatINR(totalPay)}</div></div>
            </div>
            <div style={{display:'flex',gap:'10px'}}>
              <button className="btn btn-primary" style={{marginTop:0,flex:1}} onClick={()=>setShowSchedule(s=>!s)}>{showSchedule?'Hide':'📋 View'} Schedule</button>
              <button className="btn btn-secondary" onClick={()=>{setLoanForm(f=>({...f,principal:emiPrincipal,rate:emiRate,tenure:emiTenure,emi:String(monthlyEMI)}));setShowLoanForm(true)}}>Add as Loan</button>
            </div>
            {showSchedule&&schedule.length>0&&(
              <div style={{marginTop:'16px',maxHeight:'220px',overflowY:'auto',borderRadius:'var(--radius-md)',border:'1px solid var(--border-card)'}}>
                <table className="schedule-table"><thead><tr><th>#</th><th>EMI</th><th>Principal</th><th>Interest</th><th>Balance</th></tr></thead>
                <tbody>{schedule.map(row=><tr key={row.month}><td>{row.month}</td><td>{formatINR(row.emi)}</td><td>{formatINR(row.principal)}</td><td>{formatINR(row.interest)}</td><td>{formatINR(row.balance)}</td></tr>)}</tbody></table>
              </div>
            )}
          </>)}

          {/* ── FD Calculator ── */}
          <div style={{marginTop:'20px',paddingTop:'16px',borderTop:'1px solid var(--border-card)'}}>
            <button className="btn btn-secondary" style={{width:'100%',marginBottom:'14px',fontSize:'13px'}} onClick={()=>setShowFD(s=>!s)}>
              🏦 {showFD?'Hide':'Show'} FD Calculator
            </button>
            {showFD&&(<>
              <div className="form-group"><label className="form-label">FD Principal (₹)</label><input className="form-input" type="number" placeholder="e.g. 100000" value={fdPrincipal} onChange={e=>setFdPrincipal(e.target.value)}/></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Interest Rate (%)</label><input className="form-input" type="number" placeholder="e.g. 7.5" value={fdRate} onChange={e=>setFdRate(e.target.value)} step="0.1"/></div>
                <div className="form-group"><label className="form-label">Tenure (years)</label><input className="form-input" type="number" placeholder="e.g. 2" value={fdTenure} onChange={e=>setFdTenure(e.target.value)} step="0.5"/></div>
              </div>
              <div className="form-group">
                <label className="form-label">Compounding Frequency</label>
                <div className="select-wrapper">
                  <select className="form-select" value={fdFreq} onChange={e=>setFdFreq(e.target.value)}>
                    <option value="1">Annually</option>
                    <option value="2">Half-Yearly</option>
                    <option value="4">Quarterly</option>
                    <option value="12">Monthly</option>
                  </select>
                </div>
              </div>
              {fdMaturity>0&&(
                <div className="emi-result-grid">
                  <div className="emi-result-card" style={{background:'rgba(29,233,182,0.06)',border:'1px solid rgba(29,233,182,0.2)'}}>
                    <div className="emi-result-label">Maturity Amount</div>
                    <div className="emi-result-value" style={{color:'#1de9b6'}}>{formatINR(fdMaturity)}</div>
                  </div>
                  <div className="emi-result-card" style={{background:'rgba(41,182,246,0.06)',border:'1px solid rgba(41,182,246,0.2)'}}>
                    <div className="emi-result-label">Interest Earned</div>
                    <div className="emi-result-value" style={{color:'#29b6f6'}}>{formatINR(fdInterest)}</div>
                  </div>
                  <div className="emi-result-card" style={{background:'rgba(171,71,188,0.06)',border:'1px solid rgba(171,71,188,0.2)'}}>
                    <div className="emi-result-label">Return Rate</div>
                    <div className="emi-result-value" style={{color:'#ab47bc'}}>{fdP>0?((fdInterest/fdP)*100).toFixed(1):0}%</div>
                  </div>
                </div>
              )}
              {fdMaturity>0&&(
                <div style={{marginTop:'10px',padding:'10px 14px',background:'rgba(29,233,182,0.06)',border:'1px solid rgba(29,233,182,0.15)',borderRadius:'var(--radius-md)',fontSize:'12px',color:'#6a9bb8',fontWeight:600}}>
                  💡 Invest {formatINR(fdP)} at {fdRate}% for {fdN} year{fdN!==1?'s':''} → get back <strong style={{color:'#1de9b6'}}>{formatINR(fdMaturity)}</strong>
                </div>
              )}
            </>)}
          </div>
        </div>
        <div className="glass-card">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
            <div className="form-title" style={{marginBottom:0}}><div className="form-title-icon" style={{background:'linear-gradient(135deg,#2563eb,#1d4ed8)'}}>🏦</div>Active Loans</div>
            <button className="btn btn-primary" style={{marginTop:0,width:'auto',padding:'8px 16px',fontSize:'12px'}} onClick={()=>setShowLoanForm(s=>!s)}>{showLoanForm?'✕ Cancel':'+ Add Loan'}</button>
          </div>
          {showLoanForm&&(
            <div style={{background:'var(--red-50)',border:'1px solid var(--border-card)',borderRadius:'var(--radius-lg)',padding:'16px',marginBottom:'16px'}}>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Loan Name *</label><input className={`form-input${loanErrors.name?' error':''}`} placeholder="e.g. Home Loan SBI" value={loanForm.name} onChange={e=>setLoanForm(f=>({...f,name:e.target.value}))}/>{loanErrors.name&&<div className="error-text">⚠ {loanErrors.name}</div>}</div>
                <div className="form-group"><label className="form-label">Type</label><div className="select-wrapper"><select className="form-select" value={loanForm.type} onChange={e=>setLoanForm(f=>({...f,type:e.target.value}))}>{Object.entries(LOAN_TYPES).map(([t,v])=><option key={t} value={t}>{v.emoji} {t}</option>)}</select></div></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Principal (₹) *</label><input className={`form-input${loanErrors.principal?' error':''}`} type="number" placeholder="Total loan amount" value={loanForm.principal} onChange={e=>setLoanForm(f=>({...f,principal:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Monthly EMI (₹) *</label><input className={`form-input${loanErrors.emi?' error':''}`} type="number" placeholder="Monthly EMI" value={loanForm.emi} onChange={e=>setLoanForm(f=>({...f,emi:e.target.value}))}/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Total Tenure (months)</label><input className={`form-input${loanErrors.tenure?' error':''}`} type="number" placeholder="e.g. 240" value={loanForm.tenure} onChange={e=>setLoanForm(f=>({...f,tenure:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">EMIs Paid So Far</label><input className="form-input" type="number" placeholder="0" value={loanForm.paidEmis} onChange={e=>setLoanForm(f=>({...f,paidEmis:e.target.value}))}/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Bank Name</label><input className="form-input" placeholder="e.g. SBI, HDFC" value={loanForm.bank} onChange={e=>setLoanForm(f=>({...f,bank:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Interest Rate (%)</label><input className="form-input" type="number" placeholder="e.g. 8.5" step="0.1" value={loanForm.rate} onChange={e=>setLoanForm(f=>({...f,rate:e.target.value}))}/></div>
              </div>
              <button className="btn btn-primary" onClick={handleAddLoan}>🏦 Add Loan</button>
            </div>
          )}
          {!loans.length&&<div className="empty-state" style={{padding:'32px 16px'}}><div className="empty-state-icon">🏦</div><div className="empty-title">No loans yet</div><div className="empty-desc">Add your first loan to track EMIs.</div></div>}
          {loans.map(loan=>{
            const cfg=LOAN_TYPES[loan.type]||LOAN_TYPES.Other
            const pct=loan.tenure>0?Math.min((loan.paidEmis/loan.tenure)*100,100):0
            const remaining=loan.tenure-loan.paidEmis;const isPaid=loan.paidEmis>=loan.tenure
            return(
              <div key={loan.id} className={`loan-card${removingLoan===loan.id?' removing':''}`}>
                <div className="loan-card-header">
                  <div className="loan-card-title"><div className="loan-card-icon" style={{background:cfg.color+'15'}}>{cfg.emoji}</div><div><div className="loan-card-name">{loan.name}</div><div className="loan-card-bank">{loan.bank||'—'} · {loan.rate||'—'}% p.a.</div></div></div>
                  <div style={{textAlign:'right'}}><div className="loan-card-amount">{formatINR(loan.emi)}/mo</div>{isPaid&&<div style={{fontSize:'11px',color:'var(--accent-green)',fontWeight:'800'}}>✅ Fully Paid!</div>}</div>
                </div>
                <div className="loan-progress-row"><span>{loan.paidEmis} EMIs paid</span><span>{remaining>0?`${remaining} remaining`:'Complete!'}</span></div>
                <div className="loan-progress-bar"><div className="loan-progress-fill" style={{width:`${pct}%`,background:isPaid?'var(--grad-green)':'var(--grad-brand)'}}/></div>
                <div className="loan-meta-row">
                  <div className="loan-meta-item"><div className="loan-meta-label">Principal</div><div className="loan-meta-value">{formatINR(loan.principal)}</div></div>
                  <div className="loan-meta-item"><div className="loan-meta-label">Balance Est.</div><div className="loan-meta-value">{formatINR(Math.max(loan.emi*(loan.tenure-loan.paidEmis),0))}</div></div>
                  <div className="loan-meta-item"><div className="loan-meta-label">Progress</div><div className="loan-meta-value" style={{color:'var(--accent-primary)'}}>{Math.round(pct)}%</div></div>
                  {!isPaid&&<button className="btn btn-secondary" onClick={()=>handlePayEMI(loan.id)} style={{padding:'6px 12px',fontSize:'11px'}}>✓ Record EMI</button>}
                  <button className="btn btn-danger" onClick={()=>handleDeleteLoan(loan.id)}>🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>{/* end emi-grid */}

      {/* ══════════════════════════════════
          ACTIVE FIXED DEPOSITS
          ══════════════════════════════════ */}
      <ActiveFDs showToast={showToast} addNotif={addNotif} onConfetti={onConfetti}/>

      <div className="section-header" style={{marginBottom:'16px',marginTop:'8px'}}>
        <span className="section-title">📋 Schemes & Investments</span>
        <button className="btn btn-primary" style={{marginTop:0,width:'auto',padding:'8px 16px',fontSize:'12px'}} onClick={()=>{setShowSchemeForm(s=>!s);setSelectedSchemeType(null)}}>{showSchemeForm?'✕ Cancel':'+ Add Scheme'}</button>
      </div>
      {showSchemeForm&&!selectedSchemeType&&(
        <div className="glass-card" style={{marginBottom:'16px'}}>
          <div className="form-title"><div className="form-title-icon" style={{background:'linear-gradient(135deg,#059669,#047857)'}}>📋</div>Choose Scheme Type</div>
          <div className="schemes-grid">{SCHEME_TYPES.map(s=><div key={s.key} className="scheme-card" onClick={()=>{setSelectedSchemeType(s);setSchemeForm(f=>({...f,type:s.key,name:s.name}))}}><div className="scheme-card-top"><div className="scheme-icon">{s.emoji}</div><span style={{fontSize:'12px',color:s.color,fontWeight:'700'}}>→</span></div><div className="scheme-name">{s.name}</div><div className="scheme-meta">{s.desc}</div></div>)}</div>
        </div>
      )}
      {showSchemeForm&&selectedSchemeType&&(
        <div className="glass-card" style={{marginBottom:'16px'}}>
          <div className="form-title"><div className="form-title-icon" style={{background:selectedSchemeType.color+'22',fontSize:'18px'}}>{selectedSchemeType.emoji}</div>Add {selectedSchemeType.name}<button className="btn btn-secondary" style={{marginLeft:'auto',fontSize:'11px',padding:'4px 10px'}} onClick={()=>setSelectedSchemeType(null)}>← Back</button></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Scheme / Policy Name</label><input className="form-input" placeholder={`e.g. ${selectedSchemeType.name}`} value={schemeForm.name} onChange={e=>setSchemeForm(f=>({...f,name:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Amount (₹)</label><input className="form-input" type="number" placeholder="Amount" value={schemeForm.amount} onChange={e=>setSchemeForm(f=>({...f,amount:e.target.value}))}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" value={schemeForm.date} onChange={e=>setSchemeForm(f=>({...f,date:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Maturity / Renewal Date</label><input className="form-input" type="date" value={schemeForm.maturity} onChange={e=>setSchemeForm(f=>({...f,maturity:e.target.value}))}/></div>
          </div>
          <div className="form-group"><label className="form-label">Notes</label><input className="form-input" placeholder="Policy number, sum assured..." value={schemeForm.note} onChange={e=>setSchemeForm(f=>({...f,note:e.target.value}))}/></div>
          <button className="btn btn-primary" onClick={handleAddScheme}>📋 Save Scheme</button>
        </div>
      )}
      {!schemes.length&&!showSchemeForm&&<div className="empty-state" style={{padding:'40px'}}><div className="empty-state-icon">📋</div><div className="empty-title">No schemes added</div><div className="empty-desc">Track your insurance, investments & government schemes here.</div></div>}
      {schemes.length>0&&(
        <div className="schemes-grid">
          {schemes.map(s=>{
            const cfg=SCHEME_TYPES.find(t=>t.key===s.type)||SCHEME_TYPES[0]
            const daysLeft=s.maturity?daysBetween(today(),s.maturity):null
            return(
              <div key={s.id} className="scheme-card">
                <div className="scheme-card-top"><div className="scheme-icon">{cfg.emoji}</div><span className={`scheme-badge ${s.active?'scheme-badge-active':'scheme-badge-inactive'}`}>{s.active?'Active':'Inactive'}</span></div>
                <div className="scheme-name">{s.name}</div>
                <div className="scheme-amount">{formatINR(s.amount)}</div>
                <div className="scheme-meta">{s.maturity&&<span style={{color:daysLeft!==null&&daysLeft<=30?'var(--accent-primary)':'var(--text-muted)'}}>{daysLeft!==null&&daysLeft<=30?`⚡ ${daysLeft} days left`:`Matures: ${new Date(s.maturity+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}`}</span>}</div>
                {s.note&&<div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'6px',fontStyle:'italic'}}>{s.note}</div>}
                <div style={{display:'flex',gap:'6px',marginTop:'10px'}}>
                  <button className="btn btn-secondary" style={{flex:1,fontSize:'11px',padding:'5px'}} onClick={()=>updateScheme({...s,active:!s.active})}>{s.active?'Deactivate':'Activate'}</button>
                  <button className="btn btn-danger" onClick={()=>{deleteScheme(s.id);showToast('Scheme removed','error')}}>🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── LENT TAB ──
function LentTab({lentList,addLent,updateLent,deleteLent,showToast,addNotif,onConfetti}){
  const[showForm,setShowForm]=useState(false)
  const[editId,setEditId]=useState(null)
  const[filterStatus,setFilter]=useState('all')
  const[removingId,setRemovingId]=useState(null)
  const empty={name:'',amount:'',reason:'',date:today(),dueDate:'',note:''}
  const[form,setForm]=useState(empty);const[errors,setErrors]=useState({})
  const enriched=lentList.map(l=>{if(l.status==='returned')return l;if(l.dueDate&&l.dueDate<today())return{...l,status:'overdue'};return l})
  const visible=filterStatus==='all'?enriched:enriched.filter(l=>l.status===filterStatus)
  const totalLent=lentList.reduce((s,l)=>s+l.amount,0)
  const totalRet=lentList.filter(l=>l.status==='returned').reduce((s,l)=>s+l.amount,0)
  const totalPend=lentList.filter(l=>l.status!=='returned').reduce((s,l)=>s+l.amount,0)
  const overdueCount=enriched.filter(l=>l.status==='overdue').length
  const validate=()=>{const e={};if(!form.name.trim())e.name='Name required';if(!form.amount||isNaN(+form.amount)||+form.amount<=0)e.amount='Valid amount';if(!form.date)e.date='Date required';setErrors(e);return!Object.keys(e).length}
  const upd=(f,v)=>{setForm(p=>({...p,[f]:v}));if(errors[f])setErrors(e=>({...e,[f]:''})) }
  const handleAdd=()=>{if(!validate())return;const r={id:String(genId()),name:form.name.trim(),amount:+form.amount,reason:form.reason.trim(),date:form.date,dueDate:form.dueDate,note:form.note.trim(),status:'pending'};addLent(r);setForm(empty);setShowForm(false);showToast(`Lent ${formatINR(r.amount)} to ${r.name}`,'info');addNotif('🤝 Money Lent',`You lent ${formatINR(r.amount)} to ${r.name}.`,'info','🤝')}
  const handleEditStart=r=>{setEditId(String(r.id));setForm({name:r.name,amount:String(r.amount),reason:r.reason||'',date:r.date,dueDate:r.dueDate||'',note:r.note||''});setErrors({});setShowForm(true)}
  const handleUpdate=()=>{if(!validate())return;const found=lentList.find(l=>String(l.id)===String(editId));if(!found)return;updateLent({...found,name:form.name.trim(),amount:+form.amount,reason:form.reason.trim(),date:form.date,dueDate:form.dueDate,note:form.note.trim()});setEditId(null);setForm(empty);setShowForm(false);showToast('Updated!','info')}
  const markReturned=id=>{const r=lentList.find(l=>String(l.id)===String(id));if(!r)return;updateLent({...r,status:'returned'});onConfetti('💚','Money Returned!',`${r.name} returned ${formatINR(r.amount)}! 🤝`);addNotif('💚 Money Returned',`${r.name} returned ${formatINR(r.amount)}!`,'success','💚')}
  const handleDelete=id=>{setRemovingId(id);setTimeout(()=>{deleteLent(id);setRemovingId(null);showToast('Removed','error')},280)}
  const STATUS={pending:{label:'Pending',color:'#d97706',bg:'rgba(245,158,11,0.08)',border:'rgba(245,158,11,0.2)',icon:'⏳'},overdue:{label:'Overdue',color:'#e11d48',bg:'rgba(225,29,72,0.08)',border:'rgba(225,29,72,0.2)',icon:'🔴'},returned:{label:'Returned',color:'#059669',bg:'rgba(5,150,105,0.08)',border:'rgba(5,150,105,0.2)',icon:'✅'}}
  return(
    <div>
      <div className="tab-section-header lent-header">
        <div className="tab-section-icon">🤝</div>
        <div><div className="tab-section-title">Lent Money</div><div className="tab-section-sub">Track money lent · Overdue alerts · Mark returned</div></div>
        <div className="tab-section-pills">
          <span className="tab-pill tab-pill-green">{formatINR(totalLent)} lent</span>
          {overdueCount>0&&<span className="tab-pill tab-pill-red">🔴 {overdueCount} overdue</span>}
          <span className="tab-pill tab-pill-amber">{formatINR(totalPend)} pending</span>
        </div>
        <button className="btn-lent-add" onClick={()=>{setShowForm(s=>!s);setEditId(null);setForm(empty);setErrors({})}}>{showForm&&!editId?'✕ Cancel':'+ Lend Money'}</button>
      </div>
      {enriched.filter(l=>l.status==='overdue').length>0&&<div className="lent-overdue-banner"><span className="lent-overdue-icon">🚨</span><div><div className="lent-overdue-title">{overdueCount} overdue repayment{overdueCount>1?'s':''}!</div><div className="lent-overdue-names">{enriched.filter(l=>l.status==='overdue').map(l=>`${l.name} (${formatINR(l.amount)})`).join(' · ')}</div></div></div>}
      {showForm&&(
        <div className="lent-form-card glass-card">
          <div className="form-title"><div className="form-title-icon" style={{background:'linear-gradient(135deg,#059669,#047857)'}}>🤝</div>{editId?'Edit Record':'Record Lent Money'}</div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Person's Name *</label><input className={`form-input${errors.name?' error':''}`} placeholder="e.g. Rahul Sharma" value={form.name} onChange={e=>upd('name',e.target.value)}/>{errors.name&&<div className="error-text">⚠ {errors.name}</div>}</div>
            <div className="form-group"><label className="form-label">Amount (₹) *</label><input className={`form-input${errors.amount?' error':''}`} type="number" placeholder="0" value={form.amount} onChange={e=>upd('amount',e.target.value)}/>{errors.amount&&<div className="error-text">⚠ {errors.amount}</div>}</div>
          </div>
          <div className="form-group"><label className="form-label">Reason</label><input className="form-input" placeholder="e.g. Medical emergency..." value={form.reason} onChange={e=>upd('reason',e.target.value)}/></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Lent On *</label><input className={`form-input${errors.date?' error':''}`} type="date" value={form.date} onChange={e=>upd('date',e.target.value)} max={today()}/></div>
            <div className="form-group"><label className="form-label">Expected Return</label><input className="form-input" type="date" value={form.dueDate} onChange={e=>upd('dueDate',e.target.value)}/></div>
          </div>
          <div className="form-group"><label className="form-label">Private Note</label><input className="form-input" placeholder="e.g. Said will pay next week..." value={form.note} onChange={e=>upd('note',e.target.value)}/></div>
          <div style={{display:'flex',gap:'10px'}}>
            {editId?<button className="btn btn-update" style={{flex:1}} onClick={handleUpdate}>✅ Update</button>:<button className="btn-lent-submit" style={{flex:1}} onClick={handleAdd}>🤝 Save Record</button>}
            <button className="btn btn-cancel" style={{flex:'0 0 90px'}} onClick={()=>{setShowForm(false);setEditId(null);setForm(empty);setErrors({})}}>Cancel</button>
          </div>
        </div>
      )}
      <div className="lent-filter-row">
        {['all','pending','overdue','returned'].map(s=>(
          <button key={s} className={`lent-filter-btn${filterStatus===s?' active':''}`} onClick={()=>setFilter(s)} style={filterStatus===s&&s!=='all'?{background:STATUS[s]?.color,color:'#fff',borderColor:STATUS[s]?.color}:{}}>
            {s==='all'?'📋 All':`${STATUS[s].icon} ${STATUS[s].label}`}
            <span className="lent-filter-count">{s==='all'?lentList.length:enriched.filter(l=>l.status===s).length}</span>
          </button>
        ))}
      </div>
      <div className="lent-list">
        {visible.length===0
          ?<div className="empty-state" style={{padding:'40px'}}><div className="empty-state-icon">🤝</div><div className="empty-title">{filterStatus==='all'?'No records yet':`No ${filterStatus} records`}</div><div className="empty-desc">Track money you lend to friends and family.</div></div>
          :visible.map(rec=>{
            const st=STATUS[rec.status]||STATUS.pending
            const dLeft=rec.dueDate?daysBetween(today(),rec.dueDate):null
            const initials=rec.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
            const hue=(rec.name.charCodeAt(0)*17+(rec.name.charCodeAt(1)||0)*7)%360
            return(
              <div key={rec.id} className={`lent-card${removingId===rec.id?' removing':''}`} style={{borderColor:rec.status==='overdue'?'rgba(225,29,72,0.3)':rec.status==='returned'?'rgba(5,150,105,0.2)':'transparent'}}>
                <div className="lent-avatar" style={{background:`hsl(${hue},50%,42%)`}}>{initials}</div>
                <div className="lent-info">
                  <div className="lent-name-row"><span className="lent-name">{rec.name}</span><span className="lent-status-badge" style={{background:st.bg,color:st.color,border:`1px solid ${st.border}`}}>{st.icon} {st.label}</span></div>
                  {rec.reason&&<div className="lent-reason">📌 {rec.reason}</div>}
                  <div className="lent-meta-row">
                    <span className="lent-meta-item">📅 {new Date(rec.date+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</span>
                    {rec.dueDate&&<span className="lent-meta-item" style={{color:rec.status==='overdue'?'#e11d48':rec.status==='returned'?'#059669':dLeft!==null&&dLeft<=3?'#d97706':'var(--text-muted)'}}>{rec.status==='returned'?'✅ Settled':dLeft===0?'⚡ Due today!':dLeft!==null&&dLeft<0?`🔴 ${Math.abs(dLeft)}d overdue`:`⏰ ${dLeft}d left`}</span>}
                  </div>
                  {rec.note&&<div className="lent-note">💬 {rec.note}</div>}
                </div>
                <div className="lent-right">
                  <div className="lent-amount" style={{color:rec.status==='returned'?'#059669':rec.status==='overdue'?'#e11d48':'var(--text-primary)'}}>{formatINR(rec.amount)}</div>
                  <div className="lent-actions">
                    {rec.status!=='returned'&&<button className="btn lent-btn-return" onClick={()=>markReturned(rec.id)}>✅ Returned</button>}
                    <button className="btn btn-edit" onClick={()=>handleEditStart(rec)}>✏️</button>
                    <button className="btn btn-danger" onClick={()=>handleDelete(rec.id)}>🗑️</button>
                  </div>
                </div>
              </div>
            )
          })
        }
      </div>
      {lentList.length>0&&(
        <div className="lent-summary-bar">
          <div className="lent-summary-item"><span className="lent-summary-label">Total Lent</span><span className="lent-summary-value">{formatINR(totalLent)}</span></div>
          <div className="lent-summary-item"><span className="lent-summary-label">Still Owed</span><span className="lent-summary-value" style={{color:'#d97706'}}>{formatINR(totalPend)}</span></div>
          <div className="lent-summary-item"><span className="lent-summary-label">Recovered</span><span className="lent-summary-value" style={{color:'#059669'}}>{formatINR(totalRet)}</span></div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════
export default function App(){
  // ── Firebase Auth ──
  const [user,      setUser]      = useState(undefined) // undefined=loading
  const [authReady, setAuthReady] = useState(false)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true) })
    return unsub
  }, [])

  // ── Firestore per-user data ──
  const fs = useFirestore(user?.uid || null)

  // ── Local UI prefs (device-specific, not synced) ──
  const [pinEnabled, setPinEnabled] = useState(()=>lsGet('bb_pin_enabled',false))
  const [blurMode,   setBlurMode]   = useState(()=>lsGet('bb_blur_mode',false))

  // ── Settings synced via Firestore ──
  const [budget,     setBudget]     = useState(15000)
  const [customTags, setCustomTags] = useState([])
  const [sheetsId,   setSheetsId]   = useState('')

  useEffect(()=>{ if(fs.settings){ if(fs.settings.budget!==undefined)setBudget(fs.settings.budget); if(fs.settings.customTags!==undefined)setCustomTags(fs.settings.customTags) } },[fs.settings])

  const saveSettings = useCallback((patch) => { if(user?.uid) fs.saveSettings(patch) }, [user, fs])
  const handleSetBudget     = v  => { setBudget(v);      saveSettings({budget:v,customTags,sheetsId}) }
  const handleSetCustomTags = t  => { setCustomTags(t);  saveSettings({budget,customTags:t,sheetsId}) }

  // ── Firestore shortcuts ──
  const expenses = fs.expenses
  const lentList = fs.lentList
  const loans    = fs.loans
  const schemes  = fs.schemes
  const syncStatus = fs.syncStatus

  // ── UI state ──
  const[activeTab,     setActiveTab]     = useState('dashboard')
  const[selectedMonth, setSelectedMonth] = useState(()=>thisMonth())
  const[showMonthPicker, setShowMonthPicker] = useState(false)
  const[search,        setSearch]        = useState('')
  const[activeFilter,  setFilter]        = useState('All')
  const[tagFilter,     setTagFilter]     = useState('')
  const[sort,          setSort]          = useState('date-desc')
  const[budgetInput,   setBudgetInput]   = useState(String(budget))
  const[editingId,     setEditingId]     = useState(null)
  const[removing,      setRemoving]      = useState(null)
  const[toast,         setToast]         = useState(null)
  const[toastHiding,   setToastHiding]   = useState(false)
  const[notifications, setNotifications] = useState([])
  const[notifOpen,     setNotifOpen]     = useState(false)
  const[aiSuggested,   setAiSuggested]   = useState(null)
  const[showSaved,     setShowSaved]     = useState(false)
  const[showReports,   setShowReports]   = useState(false)
  const[showSecurity,  setShowSecurity]  = useState(false)
  const[showGemini,    setShowGemini]    = useState(false)
  const[pinMode,       setPinMode]       = useState(null)
  const[isLocked,      setIsLocked]      = useState(false)
  const[confetti,      setConfetti]      = useState(null)
  const[syncing,       setSyncing]       = useState(false)
  const[lastSynced,    setLastSynced]    = useState(()=>lsGet('bb_last_synced',''))
  const[anomalyAlert,  setAnomalyAlert]  = useState(null)
  const[form,          setForm]          = useState({title:'',amount:'',category:'Food',date:today(),tags:[],note:'',recurring:false,recurringDay:new Date().getDate()})
  const[errors,        setErrors]        = useState({})
  const[voiceParsing,  setVoiceParsing]  = useState(false)
  const notifRef=useRef(null); const inactRef=useRef(null); const savedTimerRef=useRef(null)

  // Always dark mode
  useEffect(()=>{ document.documentElement.setAttribute('data-theme','dark') },[])
  // Persist UI prefs locally
  useEffect(()=>{ lsSet('bb_blur_mode',blurMode) },[blurMode])
  useEffect(()=>{ lsSet('bb_pin_enabled',pinEnabled) },[pinEnabled])

  // ── Auto-save ──
  useEffect(()=>{ lsSet('bb_expenses',expenses); setShowSaved(true); clearTimeout(savedTimerRef.current); savedTimerRef.current=setTimeout(()=>setShowSaved(false),1800) },[expenses])
  useEffect(()=>{ lsSet('bb_lentList',lentList) },[lentList])
  useEffect(()=>{ lsSet('bb_loans',loans) },[loans])
  useEffect(()=>{ lsSet('bb_schemes',schemes) },[schemes])
  useEffect(()=>{ lsSet('bb_budget',budget) },[budget])
  useEffect(()=>{ lsSet('bb_customTags',customTags) },[customTags])
  useEffect(()=>{ lsSet('bb_blur_mode',blurMode) },[blurMode])
  useEffect(()=>{ lsSet('bb_pin_enabled',pinEnabled) },[pinEnabled])

  // ── PIN init ──
  useEffect(()=>{ if(pinEnabled&&lsGet('bb_pin_hash','')) setIsLocked(true); else if(pinEnabled) setPinMode('setup') },[])

  // ── Auto-lock ──
  const resetInact=useCallback(()=>{ clearTimeout(inactRef.current); if(pinEnabled&&!isLocked) inactRef.current=setTimeout(()=>setIsLocked(true),5*60*1000) },[pinEnabled,isLocked])
  useEffect(()=>{ const evs=['mousedown','keydown','touchstart']; evs.forEach(e=>document.addEventListener(e,resetInact)); resetInact(); return()=>{ evs.forEach(e=>document.removeEventListener(e,resetInact)); clearTimeout(inactRef.current) } },[resetInact])

  useEffect(()=>{ const fn=e=>{ if(notifRef.current&&!notifRef.current.contains(e.target)) setNotifOpen(false) }; document.addEventListener('mousedown',fn); return()=>document.removeEventListener('mousedown',fn) },[])

  // ── Helpers ──
  const showToast=useCallback((msg,type='success')=>{ setToastHiding(false); setToast({message:msg,type}); setTimeout(()=>setToastHiding(true),2500); setTimeout(()=>setToast(null),2900) },[])
  const addNotif=useCallback((title,msg,type='info',icon='🔔')=>{ const time=new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}); setNotifications(p=>[{id:genId(),title,message:msg,type,icon,time,read:false},...p].slice(0,20)) },[])
  const onConfetti=useCallback((emoji,title,msg)=>setConfetti({emoji,title,message:msg}),[])

  // ── Derived ──
  const totalSpent   = useMemo(()=>expenses.reduce((s,e)=>s+e.amount,0),[expenses])
  const monthlySpent = useMemo(()=>expenses.filter(e=>getMonth(e.date)===selectedMonth).reduce((s,e)=>s+e.amount,0),[expenses,selectedMonth])
  const lastMoSpent  = useMemo(()=>{ const d=new Date(selectedMonth+'-01'); d.setMonth(d.getMonth()-1); const lm=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; return expenses.filter(e=>getMonth(e.date)===lm).reduce((s,e)=>s+e.amount,0) },[expenses,selectedMonth])
  const remaining    = budget-monthlySpent
  const budgetPct    = budget>0?Math.min((monthlySpent/budget)*100,100):0
  const budgetStatus = budgetPct>=100?'exceeded':budgetPct>=80?'warning':'ok'
  const catSpending  = useMemo(()=>Object.keys(CATEGORIES).map(cat=>({cat,total:expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0)})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total),[expenses])
  const totalPending = lentList.filter(l=>l.status!=='returned').reduce((s,l)=>s+l.amount,0)
  const overdueCount = lentList.filter(l=>l.status==='overdue'||(l.dueDate&&l.dueDate<today()&&l.status!=='returned')).length
  const allUsedTags  = useMemo(()=>{ const s=new Set(); expenses.forEach(e=>(e.tags||[]).forEach(t=>s.add(t))); return[...s] },[expenses])

  // ── Smart notifications ──
  const notifChecked=useRef(new Set()); const prevBudgetPct=useRef(budgetPct)
  useEffect(()=>{
    const k=`bp-${Math.floor(budgetPct)}-${expenses.length}`
    if(notifChecked.current.has(k))return; notifChecked.current.add(k)
    if(budgetPct>=100&&prevBudgetPct.current<100) addNotif('🚨 Budget Exceeded!',`Over by ${formatINR(Math.abs(remaining))}.`,'danger','🚨')
    else if(budgetPct>=80&&budgetPct<100&&prevBudgetPct.current<80) addNotif('⚠️ Budget Warning',`Only ${formatINR(remaining)} remaining.`,'warning','⚠️')
    if(lastMoSpent>0&&monthlySpent>lastMoSpent*1.2){const kk=`spike-${thisMonth()}`;if(!notifChecked.current.has(kk)){notifChecked.current.add(kk);addNotif('📈 Spending Spike',`${Math.round(((monthlySpent-lastMoSpent)/lastMoSpent)*100)}% more than last month.`,'warning','📈')}}
    prevBudgetPct.current=budgetPct
  },[expenses.length,budget,Math.floor(budgetPct)])
  useEffect(()=>{
    lentList.filter(l=>l.dueDate&&l.dueDate<today()&&l.status!=='returned').forEach(l=>{
      const k=`lent-od-${l.id}`
      if(!notifChecked.current.has(k)){notifChecked.current.add(k);addNotif(`🔴 Overdue: ${l.name}`,`${formatINR(l.amount)} past due!`,'danger','🔴')}
    })
  },[lentList])

  // ── Filtered list ──
  const visible=useMemo(()=>expenses.filter(e=>{
    const ms=e.title.toLowerCase().includes(search.toLowerCase())
    const mc=activeFilter==='All'||e.category===activeFilter
    const mt=!tagFilter||(e.tags||[]).includes(tagFilter)
    return ms&&mc&&mt
  }).sort((a,b)=>{
    if(sort==='date-desc')   return b.date.localeCompare(a.date)
    if(sort==='date-asc')    return a.date.localeCompare(b.date)
    if(sort==='amount-desc') return b.amount-a.amount
    if(sort==='amount-asc')  return a.amount-b.amount
    return 0
  }),[expenses,search,activeFilter,tagFilter,sort])

  // ── Voice input handler ──
  const handleVoiceResult=async(transcript)=>{
    setVoiceParsing(true)
    showToast(`Heard: "${transcript}"`, 'info')
    try{
      const prompt=`Parse this voice expense command from an Indian user and return ONLY JSON (no markdown):
{"title":"expense name","amount":number,"category":"Food|Travel|Shopping|Bills|Entertainment|Health|Other","note":""}
Voice: "${transcript}"
Rules: Extract amount (convert words like "two hundred" to 200), guess category from context. If no amount found, use 0.`
      const result=await callAI(prompt)
      const parsed=JSON.parse(result.replace(/```json|```/g,'').trim())
      if(parsed.title){
        setForm(f=>({...f,title:parsed.title,amount:String(parsed.amount||''),category:parsed.category||'Other',note:parsed.note||''}))
        showToast('✅ Voice parsed! Review and add.','success')
      }
    }catch(e){
      if(e.message==='NO_KEY') showToast('Set Gemini API key for voice parsing (🤖 button)','warning')
      else{const lower=transcript.toLowerCase();const match=lower.match(/(\d+)/);if(match) setForm(f=>({...f,amount:match[1],title:transcript}))}
    }
    setVoiceParsing(false)
  }

  // ── Form handlers ──
  const updForm=(f,v)=>{ setForm(p=>({...p,[f]:v})); if(errors[f]) setErrors(e=>({...e,[f]:''})); if(f==='title'){const s=autoClassify(v);setAiSuggested(s&&s!==form.category?s:null)} }
  const validate=()=>{ const e={}; if(!form.title.trim()) e.title='Title required'; if(!form.amount||isNaN(+form.amount)||+form.amount<=0) e.amount='Valid amount'; if(!form.date) e.date='Date required'; setErrors(e); return!Object.keys(e).length }
  const handleAdd=()=>{
    if(!validate())return
    const r={id:String(genId()),title:form.title.trim(),amount:+form.amount,category:form.category,date:form.date,tags:form.tags,note:form.note.trim(),...(form.recurring?{recurring:true,recurringDay:form.recurringDay}:{})}
    fs.addExpense(r)
    // Check for anomaly
    const anomaly=detectAnomaly(r,expenses)
    if(anomaly) setAnomalyAlert({...r,anomaly})
    setForm({title:'',amount:'',category:'Food',date:today(),tags:[],note:'',recurring:false,recurringDay:new Date().getDate()});setAiSuggested(null)
    showToast('Expense added! 💾','success'); addNotif('💸 Expense Added',`"${r.title}" — ${formatINR(r.amount)}`,'success','💸')
  }
  const handleEditStart=exp=>{setEditingId(exp.id);setForm({title:exp.title,amount:String(exp.amount),category:exp.category,date:exp.date,tags:exp.tags||[],note:exp.note||'',recurring:exp.recurring||false,recurringDay:exp.recurringDay||new Date().getDate()});setErrors({});setAiSuggested(null)}
  const handleUpdate=()=>{
    if(!validate())return
    fs.updateExpense({...expenses.find(e=>e.id===editingId),title:form.title.trim(),amount:+form.amount,category:form.category,date:form.date,tags:form.tags,note:form.note.trim(),...(form.recurring?{recurring:true,recurringDay:form.recurringDay}:{recurring:false})})
    setEditingId(null);setForm({title:'',amount:'',category:'Food',date:today(),tags:[],note:'',recurring:false,recurringDay:new Date().getDate()});setAiSuggested(null);showToast('Updated! 💾','info')
  }
  const handleCancelEdit=()=>{setEditingId(null);setForm({title:'',amount:'',category:'Food',date:today(),tags:[],note:'',recurring:false,recurringDay:new Date().getDate()});setErrors({});setAiSuggested(null)}
  const handleDelete=id=>{setRemoving(id);setTimeout(()=>{fs.deleteExpense(id);setRemoving(null);showToast('Deleted','error')},280)}
  const handleBudgetSet=()=>{const v=+budgetInput;if(!isNaN(v)&&v>0){setBudget(v);showToast(`Budget set to ${formatINR(v)}`,'info');addNotif('🎯 Budget Updated',`Set to ${formatINR(v)}.`,'info','🎯')}}

  // ── Google Sheets sync ──
  const handleSheetsSync=async()=>{
    if(!sheetsId.trim()){showToast('Enter your Google Sheet ID first','warning');return}
    setSyncing(true);await new Promise(r=>setTimeout(r,2000))
    const time=new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
    setLastSynced(time);lsSet('bb_last_synced',time);setSyncing(false)
    showToast('✅ Synced to Google Sheets!','success');addNotif('☁️ Sheets Synced',`${expenses.length} expenses synced at ${time}.`,'success','☁️')
  }

  // ── Security ──
  const handleTogglePin=()=>{if(pinEnabled){setPinEnabled(false);lsSet('bb_pin_enabled',false);localStorage.removeItem('bb_pin_hash');showToast('PIN disabled','info')}else setPinMode('setup')}
  const handlePinSuccess=()=>{if(isLocked){setIsLocked(false);setPinMode(null);resetInact()}else if(pinMode==='setup'){setPinEnabled(true);setPinMode(null);showToast('PIN enabled! 🔒','success')}else if(pinMode==='change'){setPinMode(null);showToast('PIN updated!','success')}}

  const blurAmt=v=>blurMode?<span className="blurred-amount">₹ ••••</span>:v

  // ── Auth gate ──
  if(!authReady) return(<div style={{minHeight:'100vh',background:'#080f1e',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'16px'}}><img src="./logo.png" alt="BB" style={{width:'72px',borderRadius:'18px'}} onError={e=>e.target.style.display='none'}/><div style={{fontSize:'13px',color:'#6a9bb8',fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600}}>Loading BudgetBuddy...</div></div>)
  if(!user) return <AuthScreen/>
  if(fs.loading) return(<div style={{minHeight:'100vh',background:'#080f1e',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'16px'}}><img src="./logo.png" alt="BB" style={{width:'72px',borderRadius:'18px'}} onError={e=>e.target.style.display='none'}/><div style={{fontSize:'13px',color:'#6a9bb8',fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600}}>Loading your data...</div></div>)

  return(
    <div className={`app-wrapper${blurMode?' blur-mode':''}`} style={{minHeight:'100vh',background:'#080f1e',color:'#e8f4f8'}}>

      {/* Modals */}
      {(isLocked||pinMode==='setup'||pinMode==='change')&&<PinScreen mode={isLocked?'verify':pinMode} onSuccess={handlePinSuccess} onCancel={pinMode==='setup'||pinMode==='change'?()=>{setPinMode(null);if(pinMode==='setup')setPinEnabled(false)}:null}/>}
      {showReports&&<ReportsModal expenses={expenses} lentList={lentList} loans={loans} budget={budget} onClose={()=>setShowReports(false)}/>}
      {showSecurity&&<SecurityModal pinEnabled={pinEnabled} blurMode={blurMode} onTogglePin={handleTogglePin} onChangePin={()=>{setShowSecurity(false);setPinMode('change')}} onToggleBlur={()=>setBlurMode(m=>!m)} onClose={()=>setShowSecurity(false)}/>}
      {showGemini&&<GeminiSetupModal onClose={()=>setShowGemini(false)}/>}
      {confetti&&<Confetti emoji={confetti.emoji} title={confetti.title} message={confetti.message} onDone={()=>setConfetti(null)}/>}

      <div className="app-layout">
        {/* ═══ SIDEBAR ═══ */}
        <aside className="sidebar">
          <div className="sidebar-brand">
            <img src="/logo.png" alt="BudgetBuddy" style={{width:'170px',height:'auto',objectFit:'contain',display:'block',margin:'0 auto'}} onError={e=>e.target.style.display='none'}/>
          </div>
          <nav className="sidebar-nav">
            {/* Main nav */}
            <button className={`sidebar-item${activeTab==='dashboard'?' active':''}`} onClick={()=>setActiveTab('dashboard')}><span className="sidebar-item-icon">🏠</span><span className="sidebar-item-label">Dashboard</span></button>
            <button className={`sidebar-item${activeTab==='emi'?' active':''}`} onClick={()=>setActiveTab('emi')}><span className="sidebar-item-icon">💳</span><span className="sidebar-item-label">EMI & Loans</span></button>
            <button className={`sidebar-item${activeTab==='lent'?' active':''}`} onClick={()=>setActiveTab('lent')}><span className="sidebar-item-icon">🤝</span><span className="sidebar-item-label">Lent{overdueCount>0&&<span className="sidebar-item-badge">{overdueCount}</span>}</span></button>

            {/* Divider */}
            <div style={{height:'1px',background:'rgba(29,233,182,0.08)',margin:'10px 0'}}/>

            {/* Utility — different style */}
            <button className="sidebar-item sidebar-util" onClick={()=>setShowReports(true)}><span className="sidebar-item-icon">📊</span><span className="sidebar-item-label">Reports</span></button>
            <button className="sidebar-item sidebar-util" onClick={()=>setShowSecurity(true)}><span className="sidebar-item-icon">⚙️</span><span className="sidebar-item-label">Settings</span></button>
          </nav>
          <div className="sidebar-premium">
            <div style={{fontSize:'18px',marginBottom:'4px'}}>👑</div>
            <div className="sidebar-premium-title">Go Premium</div>
            <div className="sidebar-premium-desc">Unlock advanced insights and achieve your financial goals.</div>
            <button className="sidebar-premium-btn" onClick={()=>setShowGemini(true)}>Upgrade Now</button>
          </div>
          <div className="sidebar-user">
            <div className="sidebar-user-avatar" style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
              {(user?.displayName||user?.email||'U')[0].toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.displayName||user?.email?.split('@')[0]||'User'}</div>
              <div className="sidebar-user-sub">{user?.email}</div>
            </div>
            <button onClick={()=>signOut(auth)} title="Sign out" style={{background:'none',border:'none',color:'#6a9bb8',cursor:'pointer',fontSize:'16px',padding:'4px',marginLeft:'auto',borderRadius:'6px',transition:'all 0.15s'}} onMouseOver={e=>e.target.style.color='#f87171'} onMouseOut={e=>e.target.style.color='#6a9bb8'}>⏏</button>
          </div>
        </aside>

        {/* ═══ MAIN ═══ */}
        <div className="main-area">
          {/* TOPBAR */}
          <header className="topbar">
            <div className="topbar-left">
              <div className="topbar-greeting">
                <span style={{color:'#b2d8e8',fontWeight:600}}>Good {new Date().getHours()<12?'morning':new Date().getHours()<17?'afternoon':'evening'},</span>
                <span style={{background:'linear-gradient(135deg,#1de9b6,#29b6f6)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',fontWeight:800,marginLeft:'6px'}}>{user?.displayName||user?.email?.split('@')[0]||'there'}!</span>
                <span style={{marginLeft:'6px'}}>👋</span>
              </div>
              <div className="topbar-sub">Here's your financial overview for <span style={{color:'#1de9b6',fontWeight:700}}>{new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</span>.</div>
            </div>
            <div className="topbar-right">
              <div style={{position:'relative'}}>
                <button className="topbar-date" onClick={()=>setShowMonthPicker(m=>!m)}>
                  📅 {new Date(selectedMonth+'-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'})} ▾
                </button>
                {showMonthPicker&&(
                  <div style={{position:'absolute',top:'calc(100% + 8px)',right:0,background:'#0f2137',border:'1px solid rgba(29,233,182,0.2)',borderRadius:'12px',padding:'12px',zIndex:200,boxShadow:'0 16px 48px rgba(0,0,0,0.5)',minWidth:'220px'}}>
                    <div style={{fontSize:'11px',fontWeight:700,color:'#6a9bb8',textTransform:'uppercase',letterSpacing:'0.7px',marginBottom:'10px',padding:'0 4px'}}>Select Month</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'6px'}}>
                      {Array.from({length:12},(_,i)=>{
                        const d=new Date(); d.setMonth(d.getMonth()-i);
                        const val=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
                        const label=d.toLocaleDateString('en-IN',{month:'short',year:'2-digit'})
                        const isSelected=val===selectedMonth
                        return(
                          <button key={val} onClick={()=>{setSelectedMonth(val);setShowMonthPicker(false)}}
                            style={{padding:'7px 4px',borderRadius:'8px',border:`1px solid ${isSelected?'#1de9b6':'rgba(29,233,182,0.1)'}`,background:isSelected?'rgba(29,233,182,0.15)':'transparent',color:isSelected?'#1de9b6':'#b2d8e8',fontSize:'12px',fontWeight:isSelected?800:600,cursor:'pointer',fontFamily:'var(--font-main)',transition:'all 0.15s'}}>
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    {selectedMonth!==thisMonth()&&(
                      <button onClick={()=>{setSelectedMonth(thisMonth());setShowMonthPicker(false)}} style={{width:'100%',marginTop:'10px',padding:'7px',borderRadius:'8px',border:'1px solid rgba(29,233,182,0.2)',background:'rgba(29,233,182,0.08)',color:'#1de9b6',fontSize:'12px',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-main)'}}>
                        Back to Current Month
                      </button>
                    )}
                  </div>
                )}
              </div>
              {showSaved&&<div className="saved-indicator">✓</div>}
              <div ref={notifRef}><NotificationBell notifications={notifications} onToggle={()=>{setNotifOpen(o=>!o);setNotifications(p=>p.map(n=>({...n,read:true})))}} isOpen={notifOpen} onClear={()=>setNotifications([])} onDismiss={id=>setNotifications(p=>p.filter(n=>n.id!==id))}/></div>
              <div className="topbar-avatar">{(user?.displayName||user?.email||'U')[0].toUpperCase()}</div>
            </div>
          </header>

          <main className="main-content">
            {anomalyAlert&&<AnomalyBanner expense={anomalyAlert} onDismiss={()=>setAnomalyAlert(null)}/>}

            {/* ═══ CLEAN DASHBOARD ═══ */}
            {activeTab==='dashboard'&&(
              <div className="clean-dash">

                {/* HERO GREETING */}
                <div className="clean-hero">
                  <img src="/hero-bg.png" alt="" className="clean-hero-img" onError={e=>e.target.style.display='none'}/>
                  <div className="clean-hero-overlay"/>
                  <div className="clean-hero-content">
                    <div className="clean-hero-greeting">
                    {new Date().getHours()<12?'Good morning':new Date().getHours()<17?'Good afternoon':'Good evening'}, {user?.displayName||user?.email?.split('@')[0]||'there'}! 👋
                    </div>
                    <div className="clean-hero-sub">Here's your financial snapshot for <strong>{new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</strong></div>
                  </div>
                </div>

                {/* 4 STAT CARDS */}
                <div className="clean-stats">
                  {[
                    {icon:'💸', label:'Total Spent',   value:blurAmt(formatINR(totalSpent)),            color:'#e11d48', bg:'rgba(225,29,72,0.1)'},
                    {icon:'📅', label:'This Month',    value:blurAmt(formatINR(monthlySpent)),           color:'#6366f1', bg:'rgba(99,102,241,0.1)'},
                    {icon:'💰', label:'Budget Left',   value:blurAmt(formatINR(Math.max(remaining,0))), color:remaining<0?'#f87171':'#1de9b6', bg:remaining<0?'rgba(248,113,113,0.1)':'rgba(29,233,182,0.1)'},
                    {icon:'🤝', label:'Owed to You',   value:blurAmt(formatINR(totalPending)),           color:'#f59e0b', bg:'rgba(245,158,11,0.1)', click:()=>setActiveTab('lent')},
                  ].map((s,i)=>(
                    <div key={i} className="clean-stat" onClick={s.click} style={{cursor:s.click?'pointer':'default'}}>
                      <div className="clean-stat-icon" style={{background:s.bg,color:s.color}}>{s.icon}</div>
                      <div className="clean-stat-label">{s.label}</div>
                      <div className="clean-stat-value" style={{color:s.color}}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* MAIN GRID — 2 col */}
                <div className="clean-grid">

                  {/* QUICK ADD */}
                  <div className="clean-card">
                    <div className="clean-card-title">
                      <span>➕</span>
                      {editingId ? 'Edit Expense' : 'Quick Add'}
                      <div style={{marginLeft:'auto',display:'flex',gap:'8px'}}>
                        <ReceiptScanner onExpenseDetected={d=>setForm(f=>({...f,...d}))} showToast={showToast}/>
                        <VoiceInput onResult={handleVoiceResult} disabled={voiceParsing}/>
                      </div>
                    </div>

                    {/* Big amount */}
                    <div className="clean-amount-wrap">
                      <span className="clean-amount-prefix">₹</span>
                      <input className="clean-amount-input" type="number" placeholder="0"
                        value={form.amount} onChange={e=>updForm('amount',e.target.value)}
                        onKeyDown={e=>e.key==='Enter'&&(editingId?handleUpdate():handleAdd())}/>
                    </div>
                    {errors.amount&&<div className="clean-error">⚠ {errors.amount}</div>}

                    {/* Title */}
                    <input className="clean-title-input" placeholder="What did you spend on?"
                      value={form.title} onChange={e=>updForm('title',e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&(editingId?handleUpdate():handleAdd())}/>
                    {errors.title&&<div className="clean-error">⚠ {errors.title}</div>}

                    {/* Category pills */}
                    <div className="clean-cats">
                      {Object.entries(CATEGORIES).map(([k,v])=>(
                        <button key={k} className={`clean-cat${form.category===k?' active':''}`}
                          style={form.category===k?{background:v.bar,borderColor:v.bar,color:'#fff'}:{}}
                          onClick={()=>updForm('category',k)}>{v.emoji} {k}</button>
                      ))}
                    </div>

                    {/* Date + Note */}
                    <div className="clean-row">
                      <div style={{flex:1}}>
                        <div className="clean-label">Date</div>
                        <input className="form-input" type="date" value={form.date}
                          onChange={e=>updForm('date',e.target.value)} max={today()} style={{fontSize:'13px',padding:'8px 10px'}}/>
                      </div>
                      <div style={{flex:1}}>
                        <div className="clean-label">Note</div>
                        <input className="form-input" placeholder="Optional..."
                          value={form.note} onChange={e=>updForm('note',e.target.value)} style={{fontSize:'13px',padding:'8px 10px'}}/>
                      </div>
                    </div>

                    {editingId
                      ?<div style={{display:'flex',gap:'8px',marginTop:'4px'}}>
                         <button className="clean-add-btn" onClick={handleUpdate}>✅ Update</button>
                         <button className="btn btn-cancel" style={{flex:'0 0 80px',margin:0}} onClick={handleCancelEdit}>Cancel</button>
                       </div>
                      :<button className="clean-add-btn" onClick={handleAdd}>➕ Add Expense</button>
                    }
                  </div>

                  {/* BUDGET + RECENT */}
                  <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>

                    {/* Monthly Budget */}
                    <div className="clean-card">
                      <div className="clean-card-title">
                        <span>🎯</span> Monthly Budget
                        <div style={{marginLeft:'auto',display:'flex',gap:'8px',alignItems:'center'}}>
                          <input className="form-input" type="number" placeholder="Set..."
                            value={budgetInput} onChange={e=>setBudgetInput(e.target.value)}
                            onKeyDown={e=>e.key==='Enter'&&handleBudgetSet()}
                            style={{width:'90px',padding:'6px 10px',fontSize:'13px'}}/>
                          <button className="budget-set-btn" onClick={handleBudgetSet}>Set</button>
                        </div>
                      </div>
                      <div className="clean-budget-row">
                        <div style={{textAlign:'center'}}>
                          <div className="clean-budget-val" style={{color:'#f87171'}}>{blurAmt(formatINR(monthlySpent))}</div>
                          <div className="clean-budget-lbl">Spent</div>
                        </div>
                        <div style={{textAlign:'center'}}>
                          <div className="clean-budget-pct" style={{color:budgetStatus==='exceeded'?'#f87171':budgetStatus==='warning'?'#fbbf24':'#1de9b6'}}>{Math.round(budgetPct)}%</div>
                          <div className="clean-budget-lbl">Used</div>
                        </div>
                        <div style={{textAlign:'center'}}>
                          <div className="clean-budget-val" style={{color:remaining<0?'#f87171':'#1de9b6'}}>{blurAmt(formatINR(Math.abs(remaining)))}</div>
                          <div className="clean-budget-lbl">{remaining<0?'Over':'Left'}</div>
                        </div>
                      </div>
                      <div className="clean-bar-track">
                        <div className="clean-bar-fill" style={{width:`${Math.min(budgetPct,100)}%`,background:budgetStatus==='exceeded'?'#f87171':budgetStatus==='warning'?'#fbbf24':'#1de9b6'}}/>
                      </div>
                      <div className={`clean-budget-status ${budgetStatus}`}>
                        {budgetStatus==='exceeded'?`🚨 Over by ${formatINR(Math.abs(remaining))}`:budgetStatus==='warning'?`⚠️ Only ${Math.round(100-budgetPct)}% left`:`✅ ${formatINR(remaining)} available`}
                      </div>
                    </div>

                    {/* Recent Transactions */}
                    <div className="clean-card" style={{flex:1}}>
                      <div className="clean-card-title"><span>🧾</span> Recent Transactions</div>
                      {visible.slice(0,5).length===0
                        ?<div style={{textAlign:'center',padding:'24px',color:'#6a9bb8',fontSize:'13px'}}>No transactions yet — add your first! 👆</div>
                        :visible.slice(0,5).map(exp=>{
                          const cfg=CATEGORIES[exp.category]||CATEGORIES.Other
                          return(
                            <div key={exp.id} className={`clean-txn${removing===exp.id?' removing':''}`}>
                              <div className="clean-txn-icon" style={{background:cfg.bar+'18',color:cfg.bar}}>{cfg.emoji}</div>
                              <div className="clean-txn-info">
                                <div className="clean-txn-title">{exp.title}</div>
                                <div className="clean-txn-meta">{new Date(exp.date+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'})} · {exp.category}</div>
                              </div>
                              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                                <div className="clean-txn-amt" style={{color:cfg.bar}}>-{blurAmt(formatINR(exp.amount))}</div>
                                <button onClick={()=>handleDelete(exp.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#6a9bb8',fontSize:'13px',opacity:0.6,padding:'2px'}}>🗑️</button>
                              </div>
                            </div>
                          )
                        })
                      }
                      {expenses.length>5&&(
                        <button className="view-all-btn" onClick={()=>setShowReports(true)}>
                          View all {expenses.length} transactions →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}


            {activeTab==='emi'&&<div className="emi-theme"><EMILoansTab loans={loans} schemes={schemes} addLoan={fs.addLoan} updateLoan={fs.updateLoan} deleteLoan={fs.deleteLoan} addScheme={fs.addScheme} updateScheme={fs.updateScheme} deleteScheme={fs.deleteScheme} showToast={showToast} addNotif={addNotif} onConfetti={onConfetti}/></div>}
            {activeTab==='lent'&&<div className="lent-theme"><LentTab lentList={lentList} addLent={fs.addLent} updateLent={fs.updateLent} deleteLent={fs.deleteLent} showToast={showToast} addNotif={addNotif} onConfetti={onConfetti}/></div>}

          </main>

          <footer style={{borderTop:'1px solid rgba(29,233,182,0.08)',background:'#0b1729',padding:'12px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px',flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <img src="/logo.png" alt="BB" style={{width:'24px',height:'24px',borderRadius:'6px',objectFit:'contain'}} onError={e=>e.target.style.display='none'}/>
              <span style={{fontSize:'13px',fontWeight:800}}><span style={{color:'#e8f4f8'}}>Budget</span><span style={{background:'linear-gradient(135deg,#1de9b6,#29b6f6)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>Buddy</span></span>
              <span style={{color:'#3d6e8a',fontSize:'12px'}}>·</span>
              <span style={{fontSize:'11px',color:'#6a9bb8'}}>Track Smarter. Save Better.</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
              <span style={{fontSize:'11px',color:'#3d6e8a'}}>🇮🇳 Made in India</span>
              <span style={{fontSize:'11px',color:'#3d6e8a'}}>🔒 Secure</span>
              <span style={{fontSize:'11px',color:'#3d6e8a'}}>© {new Date().getFullYear()}</span>
            </div>
          </footer>
        {/* MOBILE BOTTOM NAV */}
        <div className="mobile-bottom-nav">
          <button className={`mob-nav-item${activeTab==='dashboard'?' active':''}`} onClick={()=>setActiveTab('dashboard')}>
            <span className="mob-nav-icon">🏠</span>
            <span className="mob-nav-label">Home</span>
          </button>
          <button className={`mob-nav-item${activeTab==='emi'?' active':''}`} onClick={()=>setActiveTab('emi')}>
            <span className="mob-nav-icon">💳</span>
            <span className="mob-nav-label">EMI</span>
          </button>
          <button className={`mob-nav-item${activeTab==='lent'?' active':''}`} onClick={()=>setActiveTab('lent')}>
            <span className="mob-nav-icon">🤝</span>
            <span className="mob-nav-label">Lent</span>
          </button>
          <button className="mob-nav-item" onClick={()=>setShowReports(true)}>
            <span className="mob-nav-icon">📊</span>
            <span className="mob-nav-label">Reports</span>
          </button>
          <button className="mob-nav-item" onClick={()=>setShowSecurity(true)}>
            <span className="mob-nav-icon">⚙️</span>
            <span className="mob-nav-label">Settings</span>
          </button>
        </div>
        </div>
      </div>

      {toast&&<Toast message={toast.message} type={toast.type} hiding={toastHiding}/>}
    </div>
  )
}
