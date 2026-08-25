import { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"
import Modal, { Field, Input, Select } from "../components/Modal"

const COUNTRIES = ["Mexico","Costa Rica","Jamaica","St. Lucia","Otro"]
const fmt = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n)
const fmtAmt = (n: number, cur: string) => new Intl.NumberFormat("en-US",{style:"currency",currency:cur==="MXN"?"MXN":"USD",maximumFractionDigits:0}).format(n)

const empty = { payment_date:new Date().toISOString().split("T")[0], vendor_name:"", amount:"", currency:"USD", bank_name:"", account_label:"", country:"Mexico", hotel:"", reference:"", notes:"" }
import { authHeaders } from "../lib/auth"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8889"
const req = async (path: string, opts?: any) => {
  const res = await fetch(API+path,{headers:{"Content-Type":"application/json",...authHeaders()},...opts})
  if(!res.ok) throw new Error("Error "+res.status)
  return res.json()
}

export default function PaymentsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [daily, setDaily] = useState<any[]>([])
  const [byVendor, setByVendor] = useState<any[]>([])
  const [form, setForm] = useState<any>(empty)
  const [editId, setEditId] = useState<string|null>(null)
  const [open, setOpen] = useState(false)
  const [fx, setFx] = useState(17.5)
  const [filterCountry, setFilterCountry] = useState("")
  const [filterHotel, setFilterHotel] = useState("")
  const [role, setRole] = useState("")

  useEffect(() => { setRole(localStorage.getItem("role") || "") }, [])

  const load = async () => {
    try {
      const params = new URLSearchParams()
      if (filterCountry) params.set("country", filterCountry)
      if (filterHotel) params.set("hotel", filterHotel)
      const [r, d, v] = await Promise.all([
        req(`/payments${params.toString()?"?"+params:""}`),
        req(`/payments/summary/daily?fx_rate=${fx}`),
        req(`/payments/summary/by-vendor?fx_rate=${fx}`)
      ])
      setRows(r); setDaily(d); setByVendor(v.slice(0,10))
    } catch(e) { console.error(e) }
  }
  useEffect(() => { load() }, [filterCountry, filterHotel, fx])

  const save = async () => {
    const d = {...form, amount:parseFloat(form.amount)}
    if(editId) await req(`/payments/${editId}`,{method:"PUT",body:JSON.stringify(d)})
    else await req("/payments",{method:"POST",body:JSON.stringify(d)})
    setOpen(false); setForm(empty); setEditId(null); load()
  }
  const onEdit = (row: any) => { setForm({...row,amount:String(row.amount)}); setEditId(row.id); setOpen(true) }
  const onDelete = async (id: string) => { await req(`/payments/${id}`,{method:"DELETE"}); load() }

  const isViewer = role === "viewer"
  const todayStr = new Date().toISOString().split("T")[0]
  const totalUSD = rows.filter((r:any) => r.currency === "USD").reduce((s:number,r:any) => s + Number(r.amount), 0)
  const totalMXN = rows.filter((r:any) => r.currency === "MXN").reduce((s:number,r:any) => s + Number(r.amount), 0)
  const totalPaid = totalUSD + totalMXN / fx
  const todayPaidUSD = rows.filter((r:any) => r.payment_date === todayStr && r.currency === "USD").reduce((s:number,r:any) => s + Number(r.amount), 0)
  const todayPaidMXN = rows.filter((r:any) => r.payment_date === todayStr && r.currency === "MXN").reduce((s:number,r:any) => s + Number(r.amount), 0)

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,padding:"10px 14px"}}>
          <p style={{fontSize:12,color:"#6b7280",margin:"0 0 4px"}}>{label}</p>
          <p style={{fontSize:15,fontWeight:500,color:"#991b1b",margin:0}}>{fmt(payload[0].value)}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div style={{padding:"28px 32px",maxWidth:1300}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:500,margin:0}}>Payments made</h1>
          <p style={{fontSize:13,color:"#6b7280",marginTop:4}}>Track all outgoing payments</p>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:12,color:"#6b7280"}}>FX</span>
            <input type="number" value={fx} onChange={e=>setFx(Number(e.target.value))} style={{width:70,padding:"7px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13}}/>
          </div>
          {!isViewer && (
            <button onClick={()=>{setForm(empty);setEditId(null);setOpen(true)}} style={{padding:"8px 18px",background:"#1d4ed8",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:500,cursor:"pointer"}}>
              + Register payment
            </button>
          )}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"16px 20px"}}>
          <p style={{fontSize:11,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>Total paid USD equiv</p>
          <p style={{fontSize:22,fontWeight:500,color:"#991b1b",margin:"6px 0 0"}}>{fmt(totalPaid)}</p>
          <p style={{fontSize:12,color:"#9ca3af",marginTop:2}}>USD {new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(totalUSD)} + MXN {new Intl.NumberFormat("es-MX",{maximumFractionDigits:0}).format(totalMXN)}</p>
          <p style={{fontSize:11,color:"#9ca3af"}}>{rows.length} payments</p>
        </div>
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"16px 20px"}}>
          <p style={{fontSize:11,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>Paid today</p>
          <p style={{fontSize:22,fontWeight:500,color:"#92400e",margin:"6px 0 0"}}>{fmt(todayPaidUSD + todayPaidMXN/fx)}</p>
          <p style={{fontSize:12,color:"#9ca3af",marginTop:2}}>USD {new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(todayPaidUSD)} + MXN {new Intl.NumberFormat("es-MX",{maximumFractionDigits:0}).format(todayPaidMXN)}</p>
        </div>
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"16px 20px"}}>
          <p style={{fontSize:11,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>Top vendor 30d</p>
          {byVendor[0] ? (
            <>
              <p style={{fontSize:15,fontWeight:500,color:"#374151",margin:"6px 0 0"}}>{byVendor[0].vendor}</p>
              <p style={{fontSize:14,color:"#991b1b",marginTop:2}}>{fmt(byVendor[0].total_usd)}</p>
            </>
          ) : <p style={{fontSize:13,color:"#9ca3af",marginTop:8}}>No data yet</p>}
        </div>
      </div>

      {daily.length > 1 && (
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"20px 24px",marginBottom:20}}>
          <p style={{fontSize:12,fontWeight:500,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:16}}>30-day payment trend (USD)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={daily} margin={{top:4,right:16,left:0,bottom:4}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
              <XAxis dataKey="date" tick={{fontSize:11,fill:"#9ca3af"}} tickFormatter={v=>v.slice(5)}/>
              <YAxis tick={{fontSize:11,fill:"#9ca3af"}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="total_usd" fill="#ef4444" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {byVendor.length > 0 && (
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"20px 24px",marginBottom:20}}>
          <p style={{fontSize:12,fontWeight:500,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:14}}>Top vendors by payment (30d)</p>
          {byVendor.map((v,i) => (
            <div key={v.vendor} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f3f4f6"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:12,color:"#9ca3af",minWidth:20}}>{i+1}</span>
                <span style={{fontSize:13,color:"#374151"}}>{v.vendor}</span>
                <span style={{fontSize:11,color:"#9ca3af"}}>{v.count} payments</span>
              </div>
              <span style={{fontSize:14,fontWeight:500,color:"#991b1b"}}>{fmt(v.total_usd)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <select value={filterCountry} onChange={e=>setFilterCountry(e.target.value)}
          style={{padding:"5px 12px",borderRadius:20,fontSize:12,border:"1px solid #e5e7eb",background:"#fff",cursor:"pointer"}}>
          <option value="">All countries</option>
          {COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <input value={filterHotel} onChange={e=>setFilterHotel(e.target.value)}
          placeholder="Filter by hotel..."
          style={{padding:"5px 12px",borderRadius:20,fontSize:12,border:"1px solid #e5e7eb",background:"#fff",width:160}}/>
        {(filterCountry||filterHotel) && (
          <button onClick={()=>{setFilterCountry("");setFilterHotel("")}} style={{padding:"5px 12px",borderRadius:20,fontSize:12,border:"none",background:"#fee2e2",color:"#991b1b",cursor:"pointer"}}>Clear</button>
        )}
      </div>

      <div style={{border:"1px solid #e5e7eb",borderRadius:12,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:"#f9fafb"}}>
              {["Date","Vendor","Amount","Bank","Country","Hotel","Reference","Notes",...(!isViewer?[""]:[])].map(h=>(
                <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:500,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",borderBottom:"1px solid #e5e7eb"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length===0 ? (
              <tr><td colSpan={isViewer?8:9} style={{padding:32,textAlign:"center",color:"#9ca3af",fontSize:13}}>No payments registered yet.</td></tr>
            ) : rows.map(row=>(
              <tr key={row.id} style={{background:"#fff",borderBottom:"1px solid #f3f4f6"}}>
                <td style={{padding:"11px 14px",fontSize:12}}>{row.payment_date}</td>
                <td style={{padding:"11px 14px",fontSize:13,fontWeight:500}}>{row.vendor_name}</td>
                <td style={{padding:"11px 14px",fontSize:13,fontWeight:500,color:"#991b1b"}}>{fmtAmt(Number(row.amount),row.currency)} <span style={{fontSize:11,color:"#9ca3af"}}>{row.currency}</span></td>
                <td style={{padding:"11px 14px",fontSize:12,color:"#6b7280"}}>{row.bank_name||"--"}</td>
                <td style={{padding:"11px 14px",fontSize:12}}>{row.country||"--"}</td>
                <td style={{padding:"11px 14px",fontSize:12}}>{row.hotel||"--"}</td>
                <td style={{padding:"11px 14px",fontSize:12,color:"#6b7280"}}>{row.reference||"--"}</td>
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
        <Modal title={editId?"Edit payment":"Register payment"} open={open} onClose={()=>setOpen(false)} onSubmit={save}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Payment date"><Input type="date" value={form.payment_date} onChange={e=>setForm({...form,payment_date:e.target.value})}/></Field>
            <Field label="Country"><Select value={form.country||""} onChange={e=>setForm({...form,country:e.target.value})}><option value="">Select...</option>{COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}</Select></Field>
          </div>
          <Field label="Vendor / Concept"><Input value={form.vendor_name} onChange={e=>setForm({...form,vendor_name:e.target.value})} placeholder="Who was paid"/></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Amount"><Input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0.00"/></Field>
            <Field label="Currency"><Select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}><option value="USD">USD</option><option value="MXN">MXN</option></Select></Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Bank"><Input value={form.bank_name||""} onChange={e=>setForm({...form,bank_name:e.target.value})} placeholder="BBVA, Banamex..."/></Field>
            <Field label="Account"><Input value={form.account_label||""} onChange={e=>setForm({...form,account_label:e.target.value})} placeholder="Operating account"/></Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Hotel"><Input value={form.hotel||""} onChange={e=>setForm({...form,hotel:e.target.value})} placeholder="Hotel name"/></Field>
            <Field label="Reference / Transfer #"><Input value={form.reference||""} onChange={e=>setForm({...form,reference:e.target.value})} placeholder="Transfer reference"/></Field>
          </div>
          <Field label="Notes"><Input value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Additional notes"/></Field>
        </Modal>
      )}
    </div>
  )
}