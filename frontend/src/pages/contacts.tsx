import { useEffect, useState } from "react"
import DataTable, { StatusBadge } from "../components/DataTable"
import Modal, { Field, Input, Select, Textarea } from "../components/Modal"

import { authHeaders } from "../lib/auth"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8889"
const req = async (path: string, opts?: any) => {
  const res = await fetch(API+path,{headers:{"Content-Type":"application/json",...authHeaders()},...opts})
  if(!res.ok) throw new Error("Error "+res.status)
  return res.json()
}

const empty = { legal_name:"", commercial_name:"", type:"both", country:"", tax_id:"", email:"", phone:"", notes:"" }
const COUNTRIES = ["","Mexico","Costa Rica","Jamaica","St. Lucia","Other"]

export default function ContactsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [form, setForm] = useState<any>(empty)
  const [editId, setEditId] = useState<string|null>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("")

  const load = async () => {
    const params = new URLSearchParams()
    if (search) params.append("q", search)
    if (filterType) params.append("type", filterType)
    const data = await req(`/contacts?${params.toString()}&limit=100`)
    setRows(data)
  }

  useEffect(() => { load() }, [search, filterType])

  const save = async () => {
    if (editId) await req(`/contacts/${editId}`, { method:"PUT", body:JSON.stringify(form) })
    else await req("/contacts", { method:"POST", body:JSON.stringify(form) })
    setOpen(false); setForm(empty); setEditId(null); load()
  }

  const onEdit = (row: any) => { setForm({...row}); setEditId(row.id); setOpen(true) }
  const onDelete = async (id: string) => { await req(`/contacts/${id}`, { method:"DELETE" }); load() }

  const typeBadge = (v: string) => {
    const colors: Record<string,{bg:string,color:string}> = {
      client: {bg:"#dcfce7",color:"#166534"},
      vendor: {bg:"#fee2e2",color:"#991b1b"},
      both: {bg:"#dbeafe",color:"#1e40af"},
    }
    const c = colors[v] || {bg:"#f3f4f6",color:"#6b7280"}
    return <span style={{...c,padding:"2px 10px",borderRadius:20,fontSize:12,fontWeight:500}}>{v}</span>
  }

  const columns = [
    { key:"legal_name", label:"Legal Name" },
    { key:"commercial_name", label:"Commercial Name", width:180, render:(v:any) => <span style={{fontSize:12,color:"#6b7280"}}>{v||"--"}</span> },
    { key:"type", label:"Type", width:90, render:typeBadge },
    { key:"country", label:"Country", width:110, render:(v:any) => <span style={{fontSize:12}}>{v||"--"}</span> },
    { key:"tax_id", label:"RFC / Tax ID", width:130, render:(v:any) => <span style={{fontSize:12,color:"#6b7280"}}>{v||"--"}</span> },
    { key:"email", label:"Email", width:180, render:(v:any) => <span style={{fontSize:12,color:"#1e40af"}}>{v||"--"}</span> },
    { key:"phone", label:"Phone", width:120, render:(v:any) => <span style={{fontSize:12}}>{v||"--"}</span> },
  ]

  const clients = rows.filter(r => r.type === "client" || r.type === "both").length
  const vendors = rows.filter(r => r.type === "vendor" || r.type === "both").length

  return (
    <div style={{padding:"28px 32px",maxWidth:1300}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:500,margin:0}}>Contacts</h1>
          <p style={{fontSize:13,color:"#6b7280",marginTop:4}}>Client and vendor catalog — standardized names</p>
        </div>
        <div style={{display:"flex",gap:12}}>
          <div style={{background:"#dcfce7",border:"1px solid #86efac",borderRadius:10,padding:"10px 18px",textAlign:"right"}}>
            <p style={{fontSize:11,color:"#166534",margin:0}}>Clients</p>
            <p style={{fontSize:18,fontWeight:500,color:"#166534",margin:"2px 0 0"}}>{clients}</p>
          </div>
          <div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:10,padding:"10px 18px",textAlign:"right"}}>
            <p style={{fontSize:11,color:"#991b1b",margin:0}}>Vendors</p>
            <p style={{fontSize:18,fontWeight:500,color:"#991b1b",margin:"2px 0 0"}}>{vendors}</p>
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search by name..."
          style={{padding:"7px 14px",borderRadius:20,fontSize:13,border:"1px solid #e5e7eb",background:"#fff",width:220}}/>
        {[["","All"],["client","Clients"],["vendor","Vendors"],["both","Both"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilterType(v)}
            style={{padding:"5px 14px",borderRadius:20,fontSize:12,cursor:"pointer",border:"none",
              background:filterType===v?"#1d4ed8":"#f3f4f6",color:filterType===v?"#fff":"#374151"}}>{l}</button>
        ))}
      </div>

      <DataTable columns={columns} data={rows} onEdit={onEdit} onDelete={onDelete}
        onAdd={()=>{setForm(empty);setEditId(null);setOpen(true)}}
        addLabel="+ New contact" emptyMsg="No contacts found"/>

      <Modal title={editId?"Edit contact":"New contact"} open={open} onClose={()=>setOpen(false)} onSubmit={save}>
        <Field label="Legal Name"><Input value={form.legal_name} onChange={e=>setForm({...form,legal_name:e.target.value})} placeholder="Full legal name"/></Field>
        <Field label="Commercial Name"><Input value={form.commercial_name||""} onChange={e=>setForm({...form,commercial_name:e.target.value})} placeholder="Trade name / brand"/></Field>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Type">
            <Select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
              <option value="client">Client</option>
              <option value="vendor">Vendor</option>
              <option value="both">Both</option>
            </Select>
          </Field>
          <Field label="Country">
            <Select value={form.country||""} onChange={e=>setForm({...form,country:e.target.value})}>
              {COUNTRIES.map(c=><option key={c} value={c}>{c||"Select..."}</option>)}
            </Select>
          </Field>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="RFC / Tax ID"><Input value={form.tax_id||""} onChange={e=>setForm({...form,tax_id:e.target.value})} placeholder="RFC or Tax ID"/></Field>
          <Field label="Phone"><Input value={form.phone||""} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+52 998 000 0000"/></Field>
        </div>
        <Field label="Email"><Input type="email" value={form.email||""} onChange={e=>setForm({...form,email:e.target.value})} placeholder="contact@company.com"/></Field>
        <Field label="Notes"><Textarea value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Additional notes..."/></Field>
      </Modal>
    </div>
  )
}