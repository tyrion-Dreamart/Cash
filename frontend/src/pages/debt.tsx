import { useEffect, useState } from "react"
import { api } from "../lib/api"
import Modal, { Field, Input, Select, Textarea } from "../components/Modal"
import PaymentBlock, { paymentEmpty } from "../components/PaymentBlock"

const empty = { creditor_name:"", total_amount:"", monthly_payment:"", currency:"USD", next_payment_date:"", status:"al_corriente", country:"", hotel:"", legal_entity:"", comments:"" }

export default function DebtPage() {
  const [rows, setRows] = useState<any[]>([])
  const [form, setForm] = useState<any>(empty)
  const [payForm, setPayForm] = useState<any>(paymentEmpty)
  const [editId, setEditId] = useState<string|null>(null)
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState("")

  useEffect(() => { setRole(localStorage.getItem("role") || "") }, [])
  const load = async () => setRows(await api.debt.list())
  useEffect(() => { load() }, [])

  const save = async () => {
    const d = { ...form, total_amount: parseFloat(form.total_amount), monthly_payment: parseFloat(form.monthly_payment) }
    if (editId) await api.debt.update(editId, d)
    else await api.debt.create(d)
    setOpen(false); setForm(empty); setPayForm(paymentEmpty); setEditId(null); load()
  }

  const onEdit = (row: any) => {
    setForm({ ...row, total_amount: String(row.total_amount), monthly_payment: String(row.monthly_payment) })
    setEditId(row.id); setOpen(true)
  }
  const onDelete = async (id: string) => { await api.debt.delete(id); load() }

  const isViewer = role === "viewer"
  const fmt = (n: number, cur = "USD") => new Intl.NumberFormat("en-US",{style:"currency",currency:cur==="MXN"?"MXN":"USD",maximumFractionDigits:0}).format(Number(n))
  const totalDebt = rows.reduce((s,r) => s + Number(r.total_amount), 0)
  const totalMonthly = rows.filter(r => r.status !== "vencido").reduce((s,r) => s + Number(r.monthly_payment), 0)

  const statusColor: Record<string, string> = { al_corriente:"#166534", por_vencer:"#92400e", vencido:"#991b1b" }
  const statusBg: Record<string, string> = { al_corriente:"#dcfce7", por_vencer:"#fef3c7", vencido:"#fee2e2" }

  return (
    <div style={{padding:"16px",maxWidth:800}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <h1 style={{fontSize:18,fontWeight:500,margin:0}}>Financial debt</h1>
        <div style={{display:"flex",gap:8}}>
          <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"8px 14px",textAlign:"right"}}>
            <p style={{fontSize:10,color:"#6b7280",margin:0}}>Total debt</p>
            <p style={{fontSize:14,fontWeight:500,color:"#7c2d12",margin:"2px 0 0"}}>{fmt(totalDebt)}</p>
          </div>
          <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"8px 14px",textAlign:"right"}}>
            <p style={{fontSize:10,color:"#6b7280",margin:0}}>Monthly</p>
            <p style={{fontSize:14,fontWeight:500,color:"#92400e",margin:"2px 0 0"}}>{fmt(totalMonthly)}</p>
          </div>
        </div>
      </div>

      {!isViewer && (
        <button onClick={()=>{setForm(empty);setPayForm(paymentEmpty);setEditId(null);setOpen(true)}}
          style={{width:"100%",padding:"12px",background:"#1d4ed8",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:500,cursor:"pointer",marginBottom:16}}>
          + New debt
        </button>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {rows.map(row => (
          <div key={row.id} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <p style={{fontSize:14,fontWeight:500,margin:0}}>{row.creditor_name}</p>
                <p style={{fontSize:12,color:"#6b7280",margin:"2px 0 0"}}>{row.country||""} {row.hotel?`· ${row.hotel}`:""}</p>
              </div>
              <span style={{background:statusBg[row.status]||"#f3f4f6",color:statusColor[row.status]||"#374151",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:500}}>
                {row.status.replace("_"," ")}
              </span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div style={{background:"#f9fafb",borderRadius:8,padding:"8px 10px"}}>
                <p style={{fontSize:10,color:"#6b7280",margin:0}}>Total debt</p>
                <p style={{fontSize:15,fontWeight:500,color:"#7c2d12",margin:"2px 0 0"}}>{fmt(row.total_amount, row.currency)}</p>
              </div>
              <div style={{background:"#f9fafb",borderRadius:8,padding:"8px 10px"}}>
                <p style={{fontSize:10,color:"#6b7280",margin:0}}>Monthly payment</p>
                <p style={{fontSize:15,fontWeight:500,color:"#92400e",margin:"2px 0 0"}}>{fmt(row.monthly_payment, row.currency)}</p>
              </div>
            </div>
            <p style={{fontSize:12,color:"#6b7280",margin:0}}>Next payment: <strong>{row.next_payment_date}</strong></p>
            {row.comments && <p style={{fontSize:11,color:"#9ca3af",marginTop:6}}>{row.comments}</p>}
            {!isViewer && (
              <div style={{display:"flex",gap:6,marginTop:10,borderTop:"1px solid #f3f4f6",paddingTop:10}}>
                <button onClick={()=>onEdit(row)} style={{flex:1,padding:"8px",background:"#dbeafe",color:"#1e40af",border:"none",borderRadius:8,fontSize:12,cursor:"pointer"}}>Edit</button>
                <button onClick={()=>onDelete(row.id)} style={{padding:"8px 12px",background:"#fee2e2",color:"#991b1b",border:"none",borderRadius:8,fontSize:12,cursor:"pointer"}}>Delete</button>
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && <p style={{textAlign:"center",color:"#9ca3af",padding:32}}>No debt registered</p>}
      </div>

      <Modal title={editId?"Edit debt":"New debt"} open={open} onClose={()=>setOpen(false)} onSubmit={save}>
        <Field label="Creditor"><Input value={form.creditor_name} onChange={e=>setForm({...form,creditor_name:e.target.value})} placeholder="Bank or lender"/></Field>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Country"><Select value={form.country||""} onChange={e=>setForm({...form,country:e.target.value})}><option value="">Select...</option><option value="Mexico">Mexico</option><option value="Costa Rica">Costa Rica</option><option value="Jamaica">Jamaica</option><option value="St. Lucia">St. Lucia</option></Select></Field>
          <Field label="Currency"><Select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}><option value="USD">USD</option><option value="MXN">MXN</option></Select></Field>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Total amount"><Input type="number" value={form.total_amount} onChange={e=>setForm({...form,total_amount:e.target.value})} placeholder="0.00"/></Field>
          <Field label="Monthly payment"><Input type="number" value={form.monthly_payment} onChange={e=>setForm({...form,monthly_payment:e.target.value})} placeholder="0.00"/></Field>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Next payment"><Input type="date" value={form.next_payment_date} onChange={e=>setForm({...form,next_payment_date:e.target.value})}/></Field>
          <Field label="Status"><Select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="al_corriente">Current</option><option value="por_vencer">Due soon</option><option value="vencido">Overdue</option></Select></Field>
        </div>
        <Field label="Hotel"><Input value={form.hotel||""} onChange={e=>setForm({...form,hotel:e.target.value})} placeholder="Hotel name"/></Field>
        <Field label="Notes"><Textarea value={form.comments||""} onChange={e=>setForm({...form,comments:e.target.value})}/></Field>
      </Modal>
    </div>
  )
}