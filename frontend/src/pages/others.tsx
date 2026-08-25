import { useEffect, useState } from "react"
import { api } from "../lib/api"
import DataTable, { StatusBadge } from "../components/DataTable"
import Modal, { Field, Input, Select, Textarea } from "../components/Modal"
import PaymentBlock, { paymentEmpty } from "../components/PaymentBlock"
import Tabs from "../components/Tabs"

const empty = { concept:"", category:"reembolso", direction:"cobrar", amount:"", currency:"MXN", counterparty:"", due_date:"", status:"pendiente", priority:"media", comments:"", amount_paid:0 }

import { authHeaders } from "../lib/auth"
import { downloadFile } from "../lib/download"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8889"
const req = async (path: string, opts?: any) => {
  const res = await fetch(API+path,{headers:{"Content-Type":"application/json",...authHeaders()},...opts})
  if(!res.ok) throw new Error("Error "+res.status)
  return res.json()
}

export default function OthersPage() {
  const [rows, setRows] = useState<any[]>([])
  const [form, setForm] = useState<any>(empty)
  const [payForm, setPayForm] = useState<any>(paymentEmpty)
  const [editId, setEditId] = useState<string|null>(null)
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("active")
  const [filterDir, setFilterDir] = useState("")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [filterCountry, setFilterCountry] = useState("")

  const load = async () => setRows(await api.others.list(filterDir || undefined))
  useEffect(() => { load() }, [filterDir])

  const save = async () => {
    const totalAmount = parseFloat(form.amount)
    const amountPaid = payForm.amount_paid ? parseFloat(payForm.amount_paid) : 0
    const currentPaid = parseFloat(form.amount_paid || "0")
    const newTotalPaid = currentPaid + amountPaid
    const remaining = totalAmount - newTotalPaid

    let newStatus = form.status
    if (amountPaid > 0 && form.direction === "pagar") {
      newStatus = remaining <= 0 ? "liquidado" : "parcial"
    }

    const d = { ...form, amount: totalAmount, amount_paid: newTotalPaid, status: newStatus }
    if (editId) await api.others.update(editId, d)
    else await api.others.create(d)

    if (amountPaid > 0 && form.direction === "pagar" && payForm.bank_name) {
      await req("/payments", {
        method: "POST",
        body: JSON.stringify({
          payment_date: payForm.payment_date,
          vendor_name: form.counterparty || form.concept,
          amount: amountPaid,
          currency: form.currency,
          bank_name: payForm.bank_name,
          account_label: payForm.account_label,
          reference: payForm.reference,
          notes: `${remaining > 0 ? "Partial payment" : "Full payment"} - ${form.concept}`
        })
      })
    }

    setOpen(false); setForm(empty); setPayForm(paymentEmpty); setEditId(null); load()
  }

  const onEdit = (row: any) => {
    setForm({ ...row, amount: String(row.amount), amount_paid: String(row.amount_paid || 0) })
    setPayForm(paymentEmpty)
    setEditId(row.id); setOpen(true)
  }
  const onDelete = async (id: string) => { await api.others.delete(id); load() }

  const fmt = (n: number, cur = "MXN") => new Intl.NumberFormat("en-US",{style:"currency",currency:cur==="MXN"?"MXN":"USD",maximumFractionDigits:0}).format(Number(n))

  const active = rows.filter(r => ["pendiente","parcial"].includes(r.status))
  const toCobrar = active.filter(r => r.direction === "cobrar").reduce((s,r) => s + Number(r.amount) - Number(r.amount_paid||0), 0)
  const toPagar = active.filter(r => r.direction === "pagar").reduce((s,r) => s + Number(r.amount) - Number(r.amount_paid||0), 0)

  const tabFiltered = rows.filter(r => {
    if (activeTab === "active") return r.status === "pendiente"
    if (activeTab === "parcial") return r.status === "parcial"
    if (activeTab === "liquidado") return r.status === "liquidado"
    return true
  })

  const dirBadge = (v: string) => (
    <span style={{padding:"2px 10px",borderRadius:20,fontSize:12,fontWeight:500,background:v==="cobrar"?"#dcfce7":"#fee2e2",color:v==="cobrar"?"#166534":"#991b1b"}}>{v}</span>
  )

  const showPayForm = form.direction === "pagar" && ["pendiente","parcial","liquidado"].includes(form.status)
  const remainingAmount = parseFloat(form.amount||"0") - parseFloat(form.amount_paid||"0")

  const columns = [
    { key:"concept", label:"Concept" },
    { key:"category", label:"Category", width:120 },
    { key:"direction", label:"Direction", width:100, render:dirBadge },
    { key:"amount", label:"Total", width:120, render:(v:any,row:any) => fmt(v,row.currency) },
    { key:"amount_paid", label:"Paid", width:110, render:(v:any,row:any) => (
      <span style={{fontSize:12,color:Number(v)>0?"#065f46":"#9ca3af"}}>
        {Number(v)>0 ? fmt(v,row.currency) : "--"}
      </span>
    )},
    { key:"amount", label:"Balance", width:110, render:(v:any,row:any) => {
      const bal = Number(v) - Number(row.amount_paid||0)
      return <span style={{fontSize:12,fontWeight:500,color:bal>0?"#92400e":"#166534"}}>{fmt(bal,row.currency)}</span>
    }},
    { key:"counterparty", label:"Counterparty", width:130 },
    { key:"due_date", label:"Date", width:100 },
    { key:"priority", label:"Priority", width:90, render:(v:any) => {
      const c = v==="alta"?{bg:"#fee2e2",color:"#991b1b"}:v==="media"?{bg:"#fef3c7",color:"#92400e"}:{bg:"#f3f4f6",color:"#6b7280"}
      return v ? <span style={{...c,padding:"2px 10px",borderRadius:20,fontSize:12,fontWeight:500}}>{v}</span> : null
    }},
    { key:"status", label:"Status", width:110, render:(v:any) => <StatusBadge value={v}/> },
  ]

  return (
    <div style={{padding:"28px 32px",maxWidth:1300}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <h1 style={{fontSize:20,fontWeight:500,margin:0}}>Others</h1>
        <div style={{display:"flex",gap:12}}>
          <div style={{background:"#dcfce7",border:"1px solid #86efac",borderRadius:10,padding:"10px 18px",textAlign:"right"}}>
            <p style={{fontSize:11,color:"#166534",margin:0}}>To collect</p>
            <p style={{fontSize:17,fontWeight:500,color:"#166534",margin:"2px 0 0"}}>{fmt(toCobrar)}</p>
          </div>
          <div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:10,padding:"10px 18px",textAlign:"right"}}>
            <p style={{fontSize:11,color:"#991b1b",margin:0}}>Balance to pay</p>
            <p style={{fontSize:17,fontWeight:500,color:"#991b1b",margin:"2px 0 0"}}>{fmt(toPagar)}</p>
          </div>
        </div>
      </div>

      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key:"active", label:"Pending", count: rows.filter(r=>r.status==="pendiente").length },
          { key:"parcial", label:"Partial", count: rows.filter(r=>r.status==="parcial").length },
          { key:"liquidado", label:"Settled", count: rows.filter(r=>r.status==="liquidado").length },
          { key:"all", label:"All", count: rows.length },
        ]}
      />
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <input type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)}
          style={{padding:"5px 10px",borderRadius:20,fontSize:12,border:"1px solid #e5e7eb",background:"#fff"}}/>
        <span style={{fontSize:12,color:"#6b7280"}}>to</span>
        <input type="date" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)}
          style={{padding:"5px 10px",borderRadius:20,fontSize:12,border:"1px solid #e5e7eb",background:"#fff"}}/>
        <select value={filterCountry} onChange={e=>setFilterCountry(e.target.value)}
          style={{padding:"5px 12px",borderRadius:20,fontSize:12,border:"1px solid #e5e7eb",background:"#fff",cursor:"pointer"}}>
          {["","Mexico","Costa Rica","Jamaica","St. Lucia","Other"].map(c=><option key={c} value={c}>{c||"All countries"}</option>)}
        </select>
        {(filterDateFrom||filterDateTo||filterCountry) && (
          <button onClick={()=>{setFilterDateFrom("");setFilterDateTo("");setFilterCountry("")}}
            style={{padding:"5px 12px",borderRadius:20,fontSize:12,border:"none",background:"#fee2e2",color:"#991b1b",cursor:"pointer"}}>Clear</button>
        )}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["","All"],["cobrar","To collect"],["pagar","To pay"]].map(([v,l]) => (
          <button key={v} onClick={()=>setFilterDir(v)}
            style={{padding:"5px 14px",borderRadius:20,fontSize:12,cursor:"pointer",border:"none",
              background:filterDir===v?"#1d4ed8":"#f3f4f6",color:filterDir===v?"#fff":"#374151"}}>{l}</button>
        ))}
      </div>

      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
        <button onClick={()=>{
          const params = new URLSearchParams()
          if (filterDir) params.append("direction", filterDir)
          if (filterDateFrom) params.append("date_from", filterDateFrom)
          if (filterDateTo) params.append("date_to", filterDateTo)
          downloadFile(`${API}/export/others?${params.toString()}`, "Dreamart_Otros.xlsx")
        }}
          style={{padding:"7px 16px",background:"#7c3aed",color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer"}}>
          Export Excel
        </button>
      </div>
      <DataTable columns={columns} data={tabFiltered.filter(r => !filterDir || r.direction === filterDir).filter(r => !filterCountry || r.country === filterCountry).filter(r => !filterDateFrom || (r.due_date && r.due_date >= filterDateFrom)).filter(r => !filterDateTo || (r.due_date && r.due_date <= filterDateTo))} onEdit={onEdit} onDelete={onDelete}
        onAdd={()=>{setForm(empty);setPayForm(paymentEmpty);setEditId(null);setOpen(true)}}
        addLabel="+ New" emptyMsg="No records"/>

      <Modal title={editId?"Edit record":"New record"} open={open} onClose={()=>setOpen(false)} onSubmit={save}>
        <Field label="Concept"><Input value={form.concept} onChange={e=>setForm({...form,concept:e.target.value})} placeholder="Description"/></Field>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Category">
            <Select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
              <option value="reembolso">Reimbursement</option>
              <option value="anticipo">Advance</option>
              <option value="garantia">Guarantee</option>
              <option value="prestamo_interno">Internal loan</option>
              <option value="otro">Other</option>
            </Select>
          </Field>
          <Field label="Direction">
            <Select value={form.direction} onChange={e=>setForm({...form,direction:e.target.value})}>
              <option value="cobrar">To collect</option>
              <option value="pagar">To pay</option>
            </Select>
          </Field>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Total amount"><Input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0.00"/></Field>
          <Field label="Currency">
            <Select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}>
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </Select>
          </Field>
        </div>
        <Field label="Counterparty"><Input value={form.counterparty||""} onChange={e=>setForm({...form,counterparty:e.target.value})} placeholder="Person or company"/></Field>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Expected date"><Input type="date" value={form.due_date||""} onChange={e=>setForm({...form,due_date:e.target.value})}/></Field>
          <Field label="Status">
            <Select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
              <option value="pendiente">Pending</option>
              <option value="parcial">Partial</option>
              <option value="liquidado">Settled</option>
              <option value="cancelado">Cancelled</option>
            </Select>
          </Field>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Priority">
            <Select value={form.priority||"media"} onChange={e=>setForm({...form,priority:e.target.value})}>
              <option value="alta">High</option>
              <option value="media">Medium</option>
              <option value="baja">Low</option>
            </Select>
          </Field>
        </div>
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