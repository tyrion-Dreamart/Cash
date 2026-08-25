import { useEffect, useState } from "react"
import { api } from "../lib/api"
import DataTable, { StatusBadge, PriorityBadge } from "../components/DataTable"
import Modal, { Field, Input, Select, Textarea } from "../components/Modal"
import PaymentBlock, { paymentEmpty } from "../components/PaymentBlock"
import ContactAutocomplete from "../components/ContactAutocomplete"
import Tabs from "../components/Tabs"

const empty = { invoice_number:"", vendor_name:"", amount:"", currency:"USD", invoice_date:"", due_date:"", priority:"media", status:"pendiente", country:"", hotel:"", legal_entity:"", comments:"", amount_paid:0 }
const COUNTRIES = ["","Mexico","Costa Rica","Jamaica","St. Lucia","Otro"]

import { authHeaders } from "../lib/auth"
import { downloadFile } from "../lib/download"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8889"
const req = async (path: string, opts?: any) => {
  const res = await fetch(API+path,{headers:{"Content-Type":"application/json",...authHeaders()},...opts})
  if(!res.ok) throw new Error("Error "+res.status)
  return res.json()
}

export default function PayablesPage() {
  const [rows, setRows] = useState<any[]>([])
  const [form, setForm] = useState<any>(empty)
  const [payForm, setPayForm] = useState<any>(paymentEmpty)
  const [editId, setEditId] = useState<string|null>(null)
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("active")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterCountry, setFilterCountry] = useState("")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [filterHotel, setFilterHotel] = useState("")

  const load = async () => {
    const params = filterStatus ? "?status="+filterStatus : ""
    try {
      const data = await req("/payables/scored"+params)
      setRows(data)
    } catch(e) { setRows(await api.payables.list(filterStatus || undefined)) }
  }
  useEffect(() => { load() }, [filterStatus])

  const save = async () => {
    const totalAmount = parseFloat(form.amount)
    const amountPaid = payForm.amount_paid ? parseFloat(payForm.amount_paid) : 0
    const currentPaid = parseFloat(form.amount_paid || "0")
    const newTotalPaid = currentPaid + amountPaid
    const remaining = totalAmount - newTotalPaid

    let newStatus = form.status
    if (amountPaid > 0) {
      newStatus = remaining <= 0 ? "pagado" : "parcial"
    }

    const d = { ...form, amount: totalAmount, amount_paid: newTotalPaid, status: newStatus }
    if (editId) await api.payables.update(editId, d)
    else await api.payables.create(d)

    if (amountPaid > 0 && payForm.bank_name) {
      await req("/payments", {
        method: "POST",
        body: JSON.stringify({
          payment_date: payForm.payment_date,
          vendor_name: form.vendor_name,
          amount: amountPaid,
          currency: form.currency,
          bank_name: payForm.bank_name,
          account_label: payForm.account_label,
          country: form.country,
          hotel: form.hotel,
          reference: payForm.reference,
          notes: `${remaining > 0 ? "Partial payment" : "Full payment"} - Balance: ${remaining > 0 ? remaining.toFixed(2) : 0} ${form.currency}`
        })
      })
    }

    setOpen(false); setForm(empty); setPayForm(paymentEmpty); setEditId(null); load()
  }

  const onEdit = (row: any) => {
    setForm({ ...row, amount: String(row.amount), amount_paid: String(row.amount_paid || 0) })
    setEditId(row.id); setOpen(true)
  }
  const onDelete = async (id: string) => { await api.payables.delete(id); load() }

  const today = new Date().toISOString().split("T")[0]
  const tabFiltered = rows.filter(r => {
    if (activeTab === "active") return ["pendiente","programado"].includes(r.status)
    if (activeTab === "parcial") return r.status === "parcial"
    if (activeTab === "pagado") return r.status === "pagado"
    return true
  })
  const filtered = tabFiltered
    .filter(r => !filterCountry || r.country === filterCountry)
    .filter(r => !filterHotel || (r.hotel||"").toLowerCase().includes(filterHotel.toLowerCase()))
    .filter(r => !filterDateFrom || (r.invoice_date && r.invoice_date >= filterDateFrom))
    .filter(r => !filterDateTo || (r.invoice_date && r.invoice_date <= filterDateTo))

  const pending = filtered.filter(r => r.status !== "pagado")
  const totalUSD = pending.filter(r => r.currency === "USD").reduce((s,r) => s + Number(r.amount) - Number(r.amount_paid||0), 0)
  const totalMXN = pending.filter(r => r.currency === "MXN").reduce((s,r) => s + Number(r.amount) - Number(r.amount_paid||0), 0)
  const totalAlta = pending.filter(r => r.priority === "alta").reduce((s,r) => s + Number(r.amount) - Number(r.amount_paid||0), 0)

  const byCountry: Record<string, number> = {}
  rows.filter(r => r.status !== "pagado").forEach(r => {
    const c = r.country || "Sin pais"
    byCountry[c] = (byCountry[c] || 0) + (Number(r.amount) - Number(r.amount_paid||0))
  })

  const fmtUSD = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n)
  const fmtMXN = (n: number) => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(n)

  const showPayForm = ["pendiente","programado","parcial"].includes(form.status)
  const remainingAmount = parseFloat(form.amount||"0") - parseFloat(form.amount_paid||"0")

  const columns = [
    { key:"vendor_name", label:"Legal Name" },
    { key:"hotel", label:"Commercial Name", width:130, render:(v:any) => <span style={{fontSize:12}}>{v||"--"}</span> },
    { key:"country", label:"Country", width:90, render:(v:any) => <span style={{fontSize:12}}>{v||"--"}</span> },
    { key:"amount", label:"Total", width:110, render:(v:any,row:any) => (
      <span style={{fontWeight:500,fontSize:12}}>
        {new Intl.NumberFormat("en-US",{style:"currency",currency:row.currency==="MXN"?"MXN":"USD",maximumFractionDigits:0}).format(Number(v))}
        <span style={{fontSize:10,color:"#9ca3af",marginLeft:3}}>{row.currency}</span>
      </span>
    )},
    { key:"amount_paid", label:"Paid", width:110, render:(v:any,row:any) => (
      <span style={{fontSize:12,color:Number(v)>0?"#065f46":"#9ca3af"}}>
        {Number(v)>0 ? new Intl.NumberFormat("en-US",{style:"currency",currency:row.currency==="MXN"?"MXN":"USD",maximumFractionDigits:0}).format(Number(v)) : "--"}
      </span>
    )},
    { key:"amount", label:"Balance", width:110, render:(v:any,row:any) => {
      const bal = Number(v) - Number(row.amount_paid||0)
      return <span style={{fontSize:12,fontWeight:500,color:bal>0?"#92400e":"#166534"}}>{fmtUSD(bal)}</span>
    }},
    { key:"invoice_number", label:"Invoice #", width:110, render:(v:any) => <span style={{fontSize:12,color:"#1e40af",fontWeight:500}}>{v||"--"}</span> },
    { key:"invoice_date", label:"Invoice date", width:110, render:(v:any) => <span style={{fontSize:12}}>{v||"--"}</span> },
    { key:"due_date", label:"Due", width:100, render:(v:any) => <span style={{color:v<today?"#991b1b":"#111827",fontWeight:v<today?500:400,fontSize:12}}>{v}</span> },
    { key:"priority", label:"Priority", width:85, render:(v:any) => <PriorityBadge value={v}/> },
    { key:"score", label:"Priority", width:90, render:(v:any,row:any) => {
      if(!v) return null
      const c = v>=70?{bg:"#fee2e2",color:"#991b1b"}:v>=40?{bg:"#fef3c7",color:"#92400e"}:{bg:"#f3f4f6",color:"#6b7280"}
      return <span style={{...c,padding:"2px 8px",borderRadius:20,fontSize:12,fontWeight:500}}>{v}</span>
    }},
    { key:"status", label:"Status", width:100, render:(v:any) => <StatusBadge value={v}/> },
  ]

  return (
    <div style={{padding:"28px 32px",maxWidth:1400}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <h1 style={{fontSize:20,fontWeight:500,margin:0}}>CXP — Accounts Payable</h1>
        <div style={{display:"flex",gap:12}}>
          {totalUSD > 0 && (
            <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"10px 18px",textAlign:"right"}}>
              <p style={{fontSize:11,color:"#6b7280",margin:0}}>Balance USD</p>
              <p style={{fontSize:17,fontWeight:500,color:"#92400e",margin:"2px 0 0"}}>{fmtUSD(totalUSD)}</p>
            </div>
          )}
          {totalMXN > 0 && (
            <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"10px 18px",textAlign:"right"}}>
              <p style={{fontSize:11,color:"#6b7280",margin:0}}>Balance MXN</p>
              <p style={{fontSize:17,fontWeight:500,color:"#92400e",margin:"2px 0 0"}}>{fmtMXN(totalMXN)}</p>
            </div>
          )}
          <div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:10,padding:"10px 18px",textAlign:"right"}}>
            <p style={{fontSize:11,color:"#991b1b",margin:0}}>High priority</p>
            <p style={{fontSize:17,fontWeight:500,color:"#991b1b",margin:"2px 0 0"}}>{fmtUSD(totalAlta)}</p>
          </div>
        </div>
      </div>

      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key:"active", label:"Pending", count: rows.filter(r=>["pendiente","programado"].includes(r.status)).length },
          { key:"parcial", label:"Partial", count: rows.filter(r=>r.status==="parcial").length },
          { key:"pagado", label:"Paid", count: rows.filter(r=>r.status==="pagado").length },
          { key:"all", label:"All", count: rows.length },
        ]}
      />
      {Object.keys(byCountry).length > 0 && (
        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          {Object.entries(byCountry).sort((a,b)=>(b[1] as number)-(a[1] as number)).map(([country,total]) => (
            <div key={country} onClick={()=>setFilterCountry(filterCountry===country?"":country)}
              style={{background:filterCountry===country?"#7c2d12":"#fff",color:filterCountry===country?"#fff":"#111827",border:"1px solid #e5e7eb",borderRadius:10,padding:"10px 16px",cursor:"pointer",minWidth:130}}>
              <p style={{fontSize:11,margin:0,opacity:0.7}}>{country}</p>
              <p style={{fontSize:15,fontWeight:500,margin:"3px 0 0"}}>{fmtUSD(total as number)}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{width:1,background:"#e5e7eb",margin:"0 4px"}}/>
        <select value={filterCountry} onChange={e=>setFilterCountry(e.target.value)}
          style={{padding:"5px 12px",borderRadius:20,fontSize:12,border:"1px solid #e5e7eb",background:"#fff",cursor:"pointer"}}>
          {COUNTRIES.map(c=><option key={c} value={c}>{c||"All countries"}</option>)}
        </select>
        <input value={filterHotel} onChange={e=>setFilterHotel(e.target.value)}
          placeholder="Filter by hotel..."
          style={{padding:"5px 12px",borderRadius:20,fontSize:12,border:"1px solid #e5e7eb",background:"#fff",width:160}}/>
        <input type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)}
          style={{padding:"5px 10px",borderRadius:20,fontSize:12,border:"1px solid #e5e7eb",background:"#fff"}}/>
        <span style={{fontSize:12,color:"#6b7280"}}>to</span>
        <input type="date" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)}
          style={{padding:"5px 10px",borderRadius:20,fontSize:12,border:"1px solid #e5e7eb",background:"#fff"}}/>
        {(filterCountry||filterHotel||filterDateFrom||filterDateTo) && (
          <button onClick={()=>{setFilterCountry("");setFilterHotel("");setFilterDateFrom("");setFilterDateTo("")}} style={{padding:"5px 12px",borderRadius:20,fontSize:12,border:"none",background:"#fee2e2",color:"#991b1b",cursor:"pointer"}}>Clear</button>
        )}
      </div>

      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
        <button onClick={()=>{
          const params = new URLSearchParams()
          if (filterCountry) params.append("country", filterCountry)
          if (filterHotel) params.append("hotel", filterHotel)
          if (filterDateFrom) params.append("date_from", filterDateFrom)
          if (filterDateTo) params.append("date_to", filterDateTo)
          downloadFile(`${process.env.NEXT_PUBLIC_API_URL||"http://localhost:8889"}/export/cxc-cxp?${params.toString()}`, "Dreamart_CXC_CXP.xlsx")
        }}
          style={{padding:"7px 16px",background:"#059669",color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer"}}>
          Export Excel
        </button>
      </div>
      <DataTable columns={columns} data={filtered} onEdit={onEdit} onDelete={onDelete}
        onAdd={()=>{setForm(empty);setPayForm(paymentEmpty);setEditId(null);setOpen(true)}}
        addLabel="+ New CXP" emptyMsg="No accounts payable found"/>

      <Modal title={editId?"Edit CXP":"New CXP"} open={open} onClose={()=>setOpen(false)} onSubmit={save}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Legal Name"><ContactAutocomplete value={form.vendor_name||""} onChange={v=>setForm({...form,vendor_name:v})} onSelect={c=>setForm({...form,vendor_name:c.legal_name,hotel:c.commercial_name||form.hotel,country:c.country||form.country})} type="vendor" placeholder="Search vendor..."/></Field>
          <Field label="Invoice #"><Input value={form.invoice_number||""} onChange={e=>setForm({...form,invoice_number:e.target.value})} placeholder="F/00000"/></Field>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Commercial Name"><Input value={form.hotel||""} onChange={e=>setForm({...form,hotel:e.target.value})} placeholder="Commercial name"/></Field>
          <Field label="Country"><Select value={form.country||""} onChange={e=>setForm({...form,country:e.target.value})}><option value="">Select...</option><option value="Mexico">Mexico</option><option value="Costa Rica">Costa Rica</option><option value="Jamaica">Jamaica</option><option value="St. Lucia">St. Lucia</option><option value="Otro">Other</option></Select></Field>
        </div>
        <Field label="Legal / Commercial Name"><Input value={form.legal_entity||""} onChange={e=>setForm({...form,legal_entity:e.target.value})} placeholder="Legal entity"/></Field>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Total amount"><Input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0.00"/></Field>
          <Field label="Currency"><Select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}><option value="USD">USD</option><option value="MXN">MXN</option></Select></Field>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <Field label="Invoice date"><Input type="date" value={form.invoice_date||""} onChange={e=>setForm({...form,invoice_date:e.target.value})}/></Field>
          <Field label="Due date"><Input type="date" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})}/></Field>
          <Field label="Priority"><Select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option value="alta">High</option><option value="media">Medium</option><option value="baja">Low</option></Select></Field>
        </div>
        <Field label="Status">
          <Select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
            <option value="pendiente">Pending</option>
            <option value="programado">Scheduled</option>
            <option value="parcial">Partial</option>
            <option value="pagado">Paid</option>
          </Select>
        </Field>
        <Field label="Notes"><Textarea value={form.comments||""} onChange={e=>setForm({...form,comments:e.target.value})}/></Field>
        {showPayForm && (
          <PaymentBlock
            payForm={payForm}
            setPayForm={setPayForm}
            totalAmount={remainingAmount}
            currency={form.currency}
          />
        )}
      </Modal>
    </div>
  )
}