import { useEffect, useState } from "react"
import { ComposedChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import Modal, { Field, Input, Select } from "../components/Modal"

const COUNTRIES = ["Mexico","Costa Rica","Jamaica","St. Lucia","Otro"]
const fmt = (n: number, cur="USD") => new Intl.NumberFormat("en-US",{style:"currency",currency:cur==="MXN"?"MXN":"USD",maximumFractionDigits:0}).format(n)
const empty = { position_date:new Date().toISOString().split("T")[0], country:"Mexico", bank_name:"", account_label:"", currency:"USD", balance_available:"", balance_book:"", notes:"" }
import { authHeaders } from "../lib/auth"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8889"
const req = async (path: string, opts?: any) => {
  const res = await fetch(API+path,{headers:{"Content-Type":"application/json",...authHeaders()},...opts})
  if(!res.ok) throw new Error("Error "+res.status)
  return res.json()
}

export default function BankPositionsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [cashflow, setCashflow] = useState<any[]>([])
  const [form, setForm] = useState<any>(empty)
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [editId, setEditId] = useState<string|null>(null)
  const [open, setOpen] = useState(false)
  const [fx, setFx] = useState(17.5)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [role, setRole] = useState("")

  useEffect(() => { setRole(localStorage.getItem("role") || "") }, [])
  useEffect(() => { req("/banks", undefined).then(setBankAccounts).catch(console.error) }, [])

  const load = async () => {
    try {
      const [r, s, cf] = await Promise.all([
        req(`/bank-positions?position_date=${selectedDate}`, undefined),
        req(`/bank-positions/summary/today?fx_rate=${fx}`, undefined),
        req(`/bank-positions/history/cashflow?fx_rate=${fx}&days=30`, undefined)
      ])
      setRows(r); setSummary(s); setCashflow(cf)
    } catch(e) { console.error(e) }
  }
  useEffect(() => { load() }, [selectedDate, fx])

  const save = async () => {
    if(!form.bank_name || !form.account_label) { alert("Selecciona una cuenta bancaria antes de guardar."); return }
    const d = {...form, balance_available:parseFloat(form.balance_available), balance_book:form.balance_book?parseFloat(form.balance_book):null}
    if(editId) await req(`/bank-positions/${editId}`,{method:"PUT",body:JSON.stringify(d)})
    else await req("/bank-positions",{method:"POST",body:JSON.stringify(d)})
    setOpen(false); setForm(empty); setEditId(null); load()
  }
  const onEdit = (row: any) => { setForm({...row,balance_available:String(row.balance_available),balance_book:row.balance_book?String(row.balance_book):""}); setEditId(row.id); setOpen(true) }
  const onDelete = async (id: string) => { await req(`/bank-positions/${id}`,{method:"DELETE"}); load() }
  const isViewer = role === "viewer"

  const CfTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,padding:"10px 14px",minWidth:180}}>
          <p style={{fontSize:12,color:"#6b7280",margin:"0 0 6px",fontWeight:500}}>{label}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} style={{fontSize:13,fontWeight:500,color:p.color,margin:"2px 0"}}>
              {p.name}: {new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(p.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div style={{padding:"28px 32px",maxWidth:1200}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:500,margin:0}}>Daily bank position</h1>
          <p style={{fontSize:13,color:"#6b7280",marginTop:4}}>Track your daily bank balances</p>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} style={{padding:"7px 12px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13}}/>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:12,color:"#6b7280"}}>FX</span>
            <input type="number" value={fx} onChange={e=>setFx(Number(e.target.value))} style={{width:70,padding:"7px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13}}/>
          </div>
          {!isViewer && (
            <button onClick={()=>{setForm({...empty,position_date:selectedDate});setEditId(null);setOpen(true)}} style={{padding:"8px 18px",background:"#1d4ed8",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:500,cursor:"pointer"}}>
              + Capture balance
            </button>
          )}
        </div>
      </div>

      {summary && (
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
            <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"16px 20px"}}>
              <p style={{fontSize:11,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>Total consolidated USD</p>
              <p style={{fontSize:26,fontWeight:500,color:"#1e40af",margin:"6px 0 0"}}>{fmt(summary.total_usd_equiv)}</p>
              <p style={{fontSize:12,color:summary.vs_yesterday>=0?"#166534":"#991b1b",marginTop:4}}>{summary.vs_yesterday>=0?"▲":"▼"} {fmt(Math.abs(summary.vs_yesterday))} vs yesterday</p>
            </div>
            {summary.by_currency?.map((c: any)=>(
              <div key={c.currency} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"16px 20px"}}>
                <p style={{fontSize:11,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>Total {c.currency}</p>
                <p style={{fontSize:22,fontWeight:500,color:"#374151",margin:"6px 0 0"}}>{new Intl.NumberFormat("en-US",{style:"currency",currency:c.currency==="MXN"?"MXN":c.currency==="CRC"?"CRC":c.currency==="JMD"?"JMD":"USD",maximumFractionDigits:0}).format(c.total)}</p>
                <p style={{fontSize:12,color:"#9ca3af",marginTop:4}}>approx {fmt(c.total_usd_equiv)} USD</p>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
            {summary.by_country?.map((c: any)=>(
              <div key={c.country} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 16px",minWidth:160}}>
                <p style={{fontSize:11,color:"#6b7280",margin:0}}>{c.country}</p>
                <p style={{fontSize:17,fontWeight:500,color:"#1e40af",margin:"4px 0 2px"}}>{fmt(c.total_usd_equiv)}</p>
                {c.total_mxn>0&&<p style={{fontSize:11,color:"#9ca3af"}}>MXN {new Intl.NumberFormat("es-MX").format(c.total_mxn)}</p>}
                {c.total_usd>0&&<p style={{fontSize:11,color:"#9ca3af"}}>USD {new Intl.NumberFormat("en-US").format(c.total_usd)}</p>}
              </div>
            ))}
          </div>
          {summary.missing_today?.length>0 && (
            <div style={{background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:10,padding:"12px 16px",marginBottom:20}}>
              <p style={{fontSize:13,fontWeight:500,color:"#92400e",margin:"0 0 4px"}}>Not updated today — {summary.missing_today.length}</p>
              <p style={{fontSize:12,color:"#b45309"}}>{summary.missing_today.join(" · ")}</p>
            </div>
          )}
        </>
      )}

      {cashflow.length > 0 && (
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"20px 24px",marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <p style={{fontSize:12,fontWeight:500,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>Daily balance & cash flow (USD)</p>
            <div style={{display:"flex",gap:16,fontSize:11,color:"#6b7280"}}>
              <span><span style={{display:"inline-block",width:10,height:10,background:"#059669",borderRadius:2,marginRight:4}}/>Inflows</span>
              <span><span style={{display:"inline-block",width:10,height:10,background:"#ef4444",borderRadius:2,marginRight:4}}/>Outflows</span>
              <span><span style={{display:"inline-block",width:20,height:2,background:"#1d4ed8",marginRight:4,verticalAlign:"middle"}}/>Balance</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={cashflow} margin={{top:4,right:60,left:0,bottom:4}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
              <XAxis dataKey="label" tick={{fontSize:11,fill:"#9ca3af"}}/>
              <YAxis yAxisId="left" tick={{fontSize:11,fill:"#9ca3af"}} tickFormatter={(v:number)=>`$${(v/1000).toFixed(0)}k`}/>
              <YAxis yAxisId="right" orientation="right" tick={{fontSize:11,fill:"#1d4ed8"}} tickFormatter={(v:number)=>`$${(v/1000).toFixed(0)}k`}/>
              <Tooltip content={<CfTooltip/>}/>
              <Bar yAxisId="left" dataKey="inflow" fill="#059669" radius={[3,3,0,0]} name="Inflows" opacity={0.85}/>
              <Bar yAxisId="left" dataKey="outflow" fill="#ef4444" radius={[3,3,0,0]} name="Outflows" opacity={0.85}/>
              <Line yAxisId="right" type="monotone" dataKey="balance" stroke="#1d4ed8" strokeWidth={2.5} dot={{r:3,fill:"#1d4ed8"}} activeDot={{r:5}} name="Balance"/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{border:"1px solid #e5e7eb",borderRadius:12,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:"#f9fafb"}}>
              {["Date","Country","Bank","Account","Currency","Available","Book","Notes",...(!isViewer?[""]:[])].map(h=>(
                <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",borderBottom:"1px solid #e5e7eb"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length===0 ? (
              <tr><td colSpan={isViewer?8:9} style={{padding:32,textAlign:"center",color:"#9ca3af",fontSize:13}}>No records for this date.</td></tr>
            ) : rows.map(row=>(
              <tr key={row.id} style={{background:"#fff",borderBottom:"1px solid #f3f4f6"}}>
                <td style={{padding:"11px 14px",fontSize:12}}>{row.position_date}</td>
                <td style={{padding:"11px 14px",fontSize:12}}>{row.country||"--"}</td>
                <td style={{padding:"11px 14px",fontSize:13,fontWeight:500}}>{row.bank_name}</td>
                <td style={{padding:"11px 14px",fontSize:12,color:"#6b7280"}}>{row.account_label}</td>
                <td style={{padding:"11px 14px",fontSize:12}}>{row.currency}</td>
                <td style={{padding:"11px 14px",fontSize:13,fontWeight:500,color:"#1e40af"}}>{new Intl.NumberFormat("en-US",{style:"currency",currency:row.currency==="MXN"?"MXN":row.currency==="CRC"?"CRC":row.currency==="JMD"?"JMD":"USD",maximumFractionDigits:0}).format(row.balance_available)}</td>
                <td style={{padding:"11px 14px",fontSize:12,color:"#6b7280"}}>{row.balance_book?new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(row.balance_book):"--"}</td>
                <td style={{padding:"11px 14px",fontSize:12,color:"#6b7280"}}>{row.notes||"--"}</td>
                {!isViewer && (
                  <td style={{padding:"11px 14px"}}>
                    <span style={{display:"flex",gap:6}}>
                      <button onClick={()=>onEdit(row)} style={{fontSize:12,padding:"3px 10px",background:"#dbeafe",color:"#1e40af",border:"none",borderRadius:6,cursor:"pointer"}}>Edit</button>
                      <button onClick={()=>onDelete(row.id)} style={{fontSize:12,padding:"3px 10px",background:"#fee2e2",color:"#991b1b",border:"none",borderRadius:6,cursor:"pointer"}}>x</button>
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isViewer && (
        <Modal title={editId?"Edit position":"Capture bank balance"} open={open} onClose={()=>setOpen(false)} onSubmit={save}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Date"><Input type="date" value={form.position_date} onChange={e=>setForm({...form,position_date:e.target.value})}/></Field>
            <Field label="Country"><Select value={form.country||""} onChange={e=>setForm({...form,country:e.target.value})}>{COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}</Select></Field>
          </div>
          <Field label="Account">
            <Select value={form.bank_name+"||"+form.account_label} onChange={e=>{
              const [bank,account] = e.target.value.split("||")
              const found = bankAccounts.find((b:any)=>b.bank_name===bank&&b.account_label===account)
              setForm({...form,bank_name:bank,account_label:account,currency:found?found.currency:form.currency})
            }}>
              <option value="||">-- Select account --</option>
              {bankAccounts.map((b:any)=>(
                <option key={b.id} value={b.bank_name+"||"+b.account_label}>
                  {b.bank_name} — {b.account_label} ({b.currency})
                </option>
              ))}
            </Select>
          </Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <Field label="Currency"><Select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}><option value="MXN">MXN</option><option value="USD">USD</option><option value="CRC">CRC</option><option value="JMD">JMD</option><option value="XCD">XCD</option></Select></Field>
            <Field label="Available balance"><Input type="number" value={form.balance_available} onChange={e=>setForm({...form,balance_available:e.target.value})} placeholder="0.00"/></Field>
            <Field label="Book balance"><Input type="number" value={form.balance_book||""} onChange={e=>setForm({...form,balance_book:e.target.value})} placeholder="0.00"/></Field>
          </div>
          <Field label="Notes"><Input value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Notes..."/></Field>
        </Modal>
      )}
    </div>
  )
}