import { useEffect, useState } from "react"
import Modal, { Field, Input, Select, Textarea } from "../components/Modal"

import { authHeaders } from "../lib/auth"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8889"
const req = async (path: string, opts?: any) => {
  const res = await fetch(API+path,{headers:{"Content-Type":"application/json",...authHeaders()},...opts})
  if(!res.ok) throw new Error("Error "+res.status)
  return res.json()
}

const STATUS_COLORS: Record<string,{bg:string,color:string}> = {
  contacted:  {bg:"#dbeafe",color:"#1e40af"},
  promise:    {bg:"#fef3c7",color:"#92400e"},
  dispute:    {bg:"#fee2e2",color:"#991b1b"},
  bad_debt:   {bg:"#f3f4f6",color:"#6b7280"},
  collected:  {bg:"#dcfce7",color:"#166534"},
  cancelled:  {bg:"#f3f4f6",color:"#6b7280"},
}

const CONTACT_TYPES = ["call","email","whatsapp","meeting","letter","other"]
const STATUSES = ["contacted","promise","dispute","bad_debt","collected","cancelled"]

const logEmpty = {
  contact_date: new Date().toISOString().split("T")[0],
  contact_type: "call",
  contact_person: "",
  notes: "",
  next_action_date: "",
  next_action: "",
  collection_status: "contacted",
  created_by: ""
}

interface Props {
  receivable: any
  onClose: () => void
  onUpdate: () => void
}

export default function CollectionPanel({ receivable, onClose, onUpdate }: Props) {
  const [logs, setLogs] = useState<any[]>([])
  const [form, setForm] = useState<any>(logEmpty)
  const [open, setOpen] = useState(false)

  const load = async () => {
    const data = await req(`/collection/receivable/${receivable.id}`)
    setLogs(data)
  }
  useEffect(() => { load() }, [receivable.id])

  const save = async () => {
    await req("/collection", {
      method: "POST",
      body: JSON.stringify({ ...form, receivable_id: receivable.id })
    })
    setOpen(false); setForm(logEmpty); load(); onUpdate()
  }

  const fmt = (n: number, cur: string) => new Intl.NumberFormat("en-US",{style:"currency",currency:cur==="MXN"?"MXN":"USD",maximumFractionDigits:0}).format(n)
  const today = new Date().toISOString().split("T")[0]
  const daysOverdue = receivable.due_date ? Math.max(0, Math.floor((new Date().getTime() - new Date(receivable.due_date).getTime()) / 86400000)) : 0

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:1000}}
      onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:"#fff",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:600,maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"20px 20px 0",borderBottom:"1px solid #e5e7eb",paddingBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <h2 style={{fontSize:16,fontWeight:500,margin:0}}>{receivable.client_name}</h2>
              <p style={{fontSize:13,color:"#6b7280",margin:"4px 0 0"}}>{receivable.hotel||""} {receivable.country?`· ${receivable.country}`:""}</p>
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#9ca3af"}}>×</button>
          </div>
          <div style={{display:"flex",gap:12,marginTop:12}}>
            <div style={{background:"#fee2e2",borderRadius:8,padding:"8px 12px"}}>
              <p style={{fontSize:10,color:"#991b1b",margin:0}}>Amount</p>
              <p style={{fontSize:15,fontWeight:500,color:"#991b1b",margin:"2px 0 0"}}>{fmt(receivable.amount, receivable.currency)}</p>
            </div>
            <div style={{background:"#fef3c7",borderRadius:8,padding:"8px 12px"}}>
              <p style={{fontSize:10,color:"#92400e",margin:0}}>Days overdue</p>
              <p style={{fontSize:15,fontWeight:500,color:"#92400e",margin:"2px 0 0"}}>{daysOverdue}d</p>
            </div>
            <div style={{background:"#f3f4f6",borderRadius:8,padding:"8px 12px"}}>
              <p style={{fontSize:10,color:"#6b7280",margin:0}}>Due date</p>
              <p style={{fontSize:15,fontWeight:500,color:"#374151",margin:"2px 0 0"}}>{receivable.due_date}</p>
            </div>
          </div>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>
          {logs.length === 0 ? (
            <div style={{textAlign:"center",padding:"32px 0",color:"#9ca3af"}}>
              <p style={{fontSize:14,margin:0}}>No follow-up yet</p>
              <p style={{fontSize:12,marginTop:4}}>Register the first contact below</p>
            </div>
          ) : logs.map(log => (
            <div key={log.id} style={{borderLeft:"3px solid #e5e7eb",paddingLeft:14,marginBottom:16,position:"relative"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:12,fontWeight:500,color:"#374151"}}>{log.contact_date}</span>
                  <span style={{fontSize:11,background:"#f3f4f6",color:"#6b7280",padding:"1px 8px",borderRadius:20}}>{log.contact_type}</span>
                  <span style={{fontSize:11,...(STATUS_COLORS[log.collection_status]||{bg:"#f3f4f6",color:"#6b7280"}),padding:"1px 8px",borderRadius:20}}>
                    {log.collection_status}
                  </span>
                </div>
              </div>
              {log.contact_person && <p style={{fontSize:12,color:"#6b7280",margin:"0 0 4px"}}>Contact: {log.contact_person}</p>}
              <p style={{fontSize:13,color:"#374151",margin:0}}>{log.notes}</p>
              {log.next_action && (
                <div style={{background:"#fef3c7",borderRadius:6,padding:"6px 10px",marginTop:8}}>
                  <p style={{fontSize:11,color:"#92400e",margin:0}}>Next: {log.next_action} — {log.next_action_date}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{padding:"12px 20px",borderTop:"1px solid #e5e7eb"}}>
          <button onClick={()=>setOpen(true)}
            style={{width:"100%",padding:"12px",background:"#1d4ed8",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:500,cursor:"pointer"}}>
            + Register contact
          </button>
        </div>
      </div>

      <Modal title="Register contact" open={open} onClose={()=>setOpen(false)} onSubmit={save}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Date"><Input type="date" value={form.contact_date} onChange={e=>setForm({...form,contact_date:e.target.value})}/></Field>
          <Field label="Type">
            <Select value={form.contact_type} onChange={e=>setForm({...form,contact_type:e.target.value})}>
              {CONTACT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Contact person"><Input value={form.contact_person||""} onChange={e=>setForm({...form,contact_person:e.target.value})} placeholder="Who did you speak to?"/></Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="What was discussed? Any commitments?"/></Field>
        <Field label="Status">
          <Select value={form.collection_status} onChange={e=>setForm({...form,collection_status:e.target.value})}>
            <option value="contacted">Contacted</option>
            <option value="promise">Promise to pay</option>
            <option value="dispute">In dispute</option>
            <option value="bad_debt">Bad debt</option>
            <option value="collected">Collected</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </Field>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Next action date"><Input type="date" value={form.next_action_date||""} onChange={e=>setForm({...form,next_action_date:e.target.value})}/></Field>
          <Field label="Next action"><Input value={form.next_action||""} onChange={e=>setForm({...form,next_action:e.target.value})} placeholder="Call, email, escalate..."/></Field>
        </div>
        <Field label="Created by"><Input value={form.created_by||""} onChange={e=>setForm({...form,created_by:e.target.value})} placeholder="Your name"/></Field>
      </Modal>
    </div>
  )
}