import { useEffect, useState } from "react"
import { api } from "../lib/api"
import DataTable, { StatusBadge } from "../components/DataTable"
import Modal, { Field, Input, Select, Textarea } from "../components/Modal"
import ReceiptBlock, { receiptEmpty } from "../components/ReceiptBlock"
import ContactAutocomplete from "../components/ContactAutocomplete"
import Tabs from "../components/Tabs"
import CollectionPanel from "../components/CollectionPanel"

const empty = { invoice_number:"", client_name:"", amount:"", currency:"USD", invoice_date:"", due_date:"", status:"pendiente", country:"", hotel:"", legal_entity:"", comments:"" }
const COUNTRIES = ["","Mexico","Costa Rica","Jamaica","St. Lucia","Otro"]

import { authHeaders } from "../lib/auth"
import { downloadFile } from "../lib/download"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8889"
const req = async (path: string, opts?: any) => {
  const res = await fetch(API+path,{headers:{"Content-Type":"application/json",...authHeaders()},...opts})
  if(!res.ok) throw new Error("Error "+res.status)
  return res.json()
}

export default function ReceivablesPage() {
  const [rows, setRows] = useState<any[]>([])
  const [form, setForm] = useState<any>(empty)
  const [receiptForm, setReceiptForm] = useState<any>(receiptEmpty)
  const [editId, setEditId] = useState<string|null>(null)
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("active")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterCountry, setFilterCountry] = useState("")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [filterHotel, setFilterHotel] = useState("")
  const [selectedForCollection, setSelectedForCollection] = useState<any>(null)
  const [collectionSummary, setCollectionSummary] = useState<any>(null)

  const load = async () => {
    setRows(await api.receivables.list(filterStatus || undefined))
    try {
      const s = await req("/collection/summary")
      setCollectionSummary(s)
    } catch(e) {}
  }
  useEffect(() => { load() }, [filterStatus])

  const save = async () => {
    const totalAmount = parseFloat(form.amount)
    const amountReceived = receiptForm.amount_paid ? parseFloat(receiptForm.amount_paid) : 0
    const currentPaid = parseFloat(form.amount_paid || "0")
    const newTotalPaid = currentPaid + amountReceived
    const remaining = totalAmount - newTotalPaid

    let newStatus = form.status
    if (amountReceived > 0) {
      newStatus = remaining <= 0 ? "cobrado" : "parcial"
    }

    const d = { ...form, amount: totalAmount, amount_paid: newTotalPaid, status: newStatus }
    if (editId) await api.receivables.update(editId, d)
    else await api.receivables.create(d)

    if (amountReceived > 0 && receiptForm.bank_name) {
      await req("/receipts", {
        method: "POST",
        body: JSON.stringify({
          receipt_date: receiptForm.receipt_date,
          client_name: form.client_name,
          amount: amountReceived,
          currency: form.currency,
          bank_name: receiptForm.bank_name,
          account_label: receiptForm.account_label,
          country: form.country,
          hotel: form.hotel,
          reference: receiptForm.reference,
          notes: `Auto from CXC: ${form.client_name}`
        })
      })
    }
    setOpen(false); setForm(empty); setReceiptForm(receiptEmpty); setEditId(null); load()
  }

  const onEdit = (row: any) => { setForm({ ...row, amount: String(row.amount) }); setEditId(row.id); setOpen(true) }
  const onDelete = async (id: string) => { await api.receivables.delete(id); load() }

  const today = new Date().toISOString().split("T")[0]
  const tabFiltered = rows.filter(r => {
    if (activeTab === "active") return ["pendiente","vencido"].includes(r.status)
    if (activeTab === "parcial") return r.status === "parcial"
    if (activeTab === "cobrado") return r.status === "cobrado"
    return true
  })
  const filtered = tabFiltered
    .filter(r => !filterCountry || r.country === filterCountry)
    .filter(r => !filterHotel || (r.hotel||"").toLowerCase().includes(filterHotel.toLowerCase()))
    .filter(r => !filterDateFrom || (r.invoice_date && r.invoice_date >= filterDateFrom))
    .filter(r => !filterDateTo || (r.invoice_date && r.invoice_date <= filterDateTo))

  const active = filtered.filter(r => ["pendiente","parcial","vencido"].includes(r.status))
  const totalUSD = active.filter(r => r.currency === "USD").reduce((s,r) => s + Number(r.amount), 0)
  const totalMXN = active.filter(r => r.currency === "MXN").reduce((s,r) => s + Number(r.amount), 0)

  const byCountry: Record<string, number> = {}
  rows.filter(r => ["pendiente","parcial","vencido"].includes(r.status)).forEach(r => {
    const c = r.country || "Sin pais"
    byCountry[c] = (byCountry[c] || 0) + Number(r.amount)
  })

  const fmtUSD = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n)
  const fmtMXN = (n: number) => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(n)
  const showReceiptForm = form.status === "cobrado"

  const columns = [
    { key:"client_name", label:"Legal Name" },
    { key:"hotel", label:"Commercial Name", width:150, render:(v:any) => <span style={{fontSize:12}}>{v||"--"}</span> },
    { key:"country", label:"Country", width:100, render:(v:any) => <span style={{fontSize:12}}>{v||"--"}</span> },
    { key:"amount", label:"Amount", width:130, render:(v:any,row:any) => (
      <span style={{fontWeight:500}}>
        {new Intl.NumberFormat("en-US",{style:"currency",currency:row.currency==="MXN"?"MXN":"USD",maximumFractionDigits:0}).format(Number(v))}
        <span style={{fontSize:11,color:"#9ca3af",marginLeft:4}}>{row.currency}</span>
      </span>
    )},
    { key:"amount_paid", label:"Paid", width:110, render:(v:any,row:any) => (
      <span style={{fontSize:12,color:Number(v)>0?"#065f46":"#9ca3af"}}>
        {Number(v)>0 ? new Intl.NumberFormat("en-US",{style:"currency",currency:row.currency==="MXN"?"MXN":"USD",maximumFractionDigits:0}).format(Number(v)) : "--"}
      </span>
    )},
    { key:"amount", label:"Balance", width:110, render:(v:any,row:any) => {
      const bal = Number(v) - Number(row.amount_paid||0)
      return <span style={{fontSize:12,fontWeight:500,color:bal>0?"#92400e":"#166534"}}>{new Intl.NumberFormat("en-US",{style:"currency",currency:row.currency==="MXN"?"MXN":"USD",maximumFractionDigits:0}).format(bal)}</span>
    }},
    { key:"invoice_date", label:"Invoice date", width:110, render:(v:any) => <span style={{fontSize:12,color:"#6b7280"}}>{v||"--"}</span> },
    { key:"invoice_number", label:"Invoice #", width:110, render:(v:any) => <span style={{fontSize:12,color:"#1e40af",fontWeight:500}}>{v||"--"}</span> },
    { key:"due_date", label:"Due date", width:110, render:(v:any) => <span style={{color:v<today?"#991b1b":"#111827",fontWeight:v<today?500:400,fontSize:12}}>{v}</span> },
    { key:"status", label:"Status", width:110, render:(v:any,row:any) => (
      <span style={{display:"flex",gap:4,alignItems:"center"}}>
        <StatusBadge value={v}/>
        {(v==="vencido"||v==="pendiente"||v==="parcial") && row.due_date < today && (
          <button onClick={e=>{e.stopPropagation();setSelectedForCollection(row)}}
            style={{fontSize:10,padding:"2px 6px",background:"#fef3c7",color:"#92400e",border:"1px solid #fcd34d",borderRadius:4,cursor:"pointer",whiteSpace:"nowrap"}}>
            Follow up
          </button>
        )}
      </span>
    )},
    { key:"comments", label:"Notes", render:(v:any) => <span style={{color:"#6b7280",fontSize:11}}>{v||"--"}</span> },
  ]

  return (
    <div style={{padding:"28px 32px",maxWidth:1400}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:500,margin:0}}>CXC — Accounts Receivable</h1>
          {collectionSummary && (
            <div style={{display:"flex",gap:12,marginTop:8}}>
              <span style={{fontSize:12,color:"#991b1b"}}>{collectionSummary.total_overdue} overdue</span>
              <span style={{fontSize:12,color:"#92400e"}}>{collectionSummary.without_followup} without follow-up</span>
              {collectionSummary.pending_actions_today > 0 && (
                <span style={{fontSize:12,fontWeight:500,color:"#1e40af"}}>{collectionSummary.pending_actions_today} actions due today</span>
              )}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:12}}>
          {totalUSD > 0 && (
            <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"10px 18px",textAlign:"right"}}>
              <p style={{fontSize:11,color:"#6b7280",margin:0}}>Total USD</p>
              <p style={{fontSize:17,fontWeight:500,color:"#065f46",margin:"2px 0 0"}}>{fmtUSD(totalUSD)}</p>
            </div>
          )}
          {totalMXN > 0 && (
            <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"10px 18px",textAlign:"right"}}>
              <p style={{fontSize:11,color:"#6b7280",margin:0}}>Total MXN</p>
              <p style={{fontSize:17,fontWeight:500,color:"#065f46",margin:"2px 0 0"}}>{fmtMXN(totalMXN)}</p>
            </div>
          )}
        </div>
      </div>

      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key:"active", label:"Active", count: rows.filter(r=>["pendiente","vencido"].includes(r.status)).length },
          { key:"parcial", label:"Partial", count: rows.filter(r=>r.status==="parcial").length },
          { key:"cobrado", label:"Collected", count: rows.filter(r=>r.status==="cobrado").length },
          { key:"all", label:"All", count: rows.length },
        ]}
      />
      {Object.keys(byCountry).length > 0 && (
        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          {Object.entries(byCountry).sort((a,b)=>(b[1] as number)-(a[1] as number)).map(([country,total]) => (
            <div key={country} onClick={()=>setFilterCountry(filterCountry===country?"":country)}
              style={{background:filterCountry===country?"#1d4ed8":"#fff",color:filterCountry===country?"#fff":"#111827",border:"1px solid #e5e7eb",borderRadius:10,padding:"10px 16px",cursor:"pointer",minWidth:130}}>
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
        onAdd={()=>{setForm(empty);setReceiptForm(receiptEmpty);setEditId(null);setOpen(true)}}
        addLabel="+ New CXC" emptyMsg="No accounts receivable found"/>

      <Modal title={editId?"Edit CXC":"New CXC"} open={open} onClose={()=>setOpen(false)} onSubmit={save}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Legal Name"><ContactAutocomplete value={form.client_name||""} onChange={v=>setForm({...form,client_name:v})} onSelect={c=>setForm({...form,client_name:c.legal_name,hotel:c.commercial_name||form.hotel,country:c.country||form.country})} type="client" placeholder="Search client..."/></Field>
          <Field label="Invoice #"><Input value={form.invoice_number||""} onChange={e=>setForm({...form,invoice_number:e.target.value})} placeholder="F/00000"/></Field>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Commercial Name"><Input value={form.hotel||""} onChange={e=>setForm({...form,hotel:e.target.value})} placeholder="Commercial name"/></Field>
          <Field label="Country"><Select value={form.country||""} onChange={e=>setForm({...form,country:e.target.value})}><option value="">Select...</option><option value="Mexico">Mexico</option><option value="Costa Rica">Costa Rica</option><option value="Jamaica">Jamaica</option><option value="St. Lucia">St. Lucia</option><option value="Otro">Other</option></Select></Field>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Amount"><Input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0.00"/></Field>
          <Field label="Currency"><Select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}><option value="USD">USD</option><option value="MXN">MXN</option></Select></Field>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Invoice date"><Input type="date" value={form.invoice_date||""} onChange={e=>setForm({...form,invoice_date:e.target.value})}/></Field>
          <Field label="Due date"><Input type="date" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})}/></Field>
        </div>
        <Field label="Status">
          <Select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
            <option value="pendiente">Pending</option>
            <option value="parcial">Partial</option>
            <option value="cobrado">Collected</option>
            <option value="vencido">Overdue</option>
          </Select>
        </Field>
        <Field label="Notes"><Textarea value={form.comments||""} onChange={e=>setForm({...form,comments:e.target.value})}/></Field>
        {showReceiptForm && <ReceiptBlock receiptForm={receiptForm} setReceiptForm={setReceiptForm}/>}
      </Modal>

      {selectedForCollection && (
        <CollectionPanel
          receivable={selectedForCollection}
          onClose={()=>setSelectedForCollection(null)}
          onUpdate={load}
        />
      )}
    </div>
  )
}