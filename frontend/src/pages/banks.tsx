import { useEffect, useState } from "react"
import { api } from "../lib/api"
import Modal, { Field, Input, Select, Textarea } from "../components/Modal"

const empty = { bank_name:"", account_label:"", currency:"MXN", balance:"", updated_at:new Date().toISOString().split("T")[0], notes:"" }

export default function BanksPage() {
  const [rows, setRows] = useState<any[]>([])
  const [form, setForm] = useState<any>(empty)
  const [editId, setEditId] = useState<string|null>(null)
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState("")

  useEffect(() => { setRole(localStorage.getItem("role") || "") }, [])
  const load = async () => setRows(await api.banks.list())
  useEffect(() => { load() }, [])

  const save = async () => {
    const d = { ...form, balance: parseFloat(form.balance) }
    if (editId) await api.banks.update(editId, d)
    else await api.banks.create(d)
    setOpen(false); setForm(empty); setEditId(null); load()
  }

  const onEdit = (row: any) => { setForm({ ...row, balance: String(row.balance) }); setEditId(row.id); setOpen(true) }
  const onDelete = async (id: string) => { await api.banks.delete(id); load() }

  const isViewer = role === "viewer"
  const totalMXN = rows.filter(r => r.currency === "MXN").reduce((s,r) => s + Number(r.balance), 0)
  const totalUSD = rows.filter(r => r.currency === "USD").reduce((s,r) => s + Number(r.balance), 0)
  const fmtMXN = (n: number) => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(n)
  const fmtUSD = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n)

  return (
    <div style={{padding:"16px",maxWidth:800}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <h1 style={{fontSize:18,fontWeight:500,margin:0}}>Bank accounts</h1>
        <div style={{display:"flex",gap:8}}>
          <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"8px 14px",textAlign:"right"}}>
            <p style={{fontSize:10,color:"#6b7280",margin:0}}>MXN</p>
            <p style={{fontSize:14,fontWeight:500,color:"#1e40af",margin:"2px 0 0"}}>{fmtMXN(totalMXN)}</p>
          </div>
          <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"8px 14px",textAlign:"right"}}>
            <p style={{fontSize:10,color:"#6b7280",margin:0}}>USD</p>
            <p style={{fontSize:14,fontWeight:500,color:"#065f46",margin:"2px 0 0"}}>{fmtUSD(totalUSD)}</p>
          </div>
        </div>
      </div>

      {!isViewer && (
        <button onClick={()=>{setForm(empty);setEditId(null);setOpen(true)}}
          style={{width:"100%",padding:"12px",background:"#1d4ed8",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:500,cursor:"pointer",marginBottom:16}}>
          + New account
        </button>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {rows.map(row => (
          <div key={row.id} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <p style={{fontSize:14,fontWeight:500,margin:0}}>{row.bank_name}</p>
                <p style={{fontSize:12,color:"#6b7280",margin:"2px 0 0"}}>{row.account_label} · {row.currency}</p>
                <p style={{fontSize:11,color:"#9ca3af",margin:"2px 0 0"}}>Updated: {row.updated_at}</p>
              </div>
              <div style={{textAlign:"right"}}>
                <p style={{fontSize:18,fontWeight:500,color:"#1e40af",margin:0}}>
                  {new Intl.NumberFormat("en-US",{style:"currency",currency:row.currency==="MXN"?"MXN":"USD",maximumFractionDigits:0}).format(Number(row.balance))}
                </p>
                {!isViewer && (
                  <div style={{display:"flex",gap:6,marginTop:8,justifyContent:"flex-end"}}>
                    <button onClick={()=>onEdit(row)} style={{fontSize:12,padding:"4px 12px",background:"#dbeafe",color:"#1e40af",border:"none",borderRadius:6,cursor:"pointer"}}>Edit</button>
                    <button onClick={()=>onDelete(row.id)} style={{fontSize:12,padding:"4px 12px",background:"#fee2e2",color:"#991b1b",border:"none",borderRadius:6,cursor:"pointer"}}>Delete</button>
                  </div>
                )}
              </div>
            </div>
            {row.notes && <p style={{fontSize:12,color:"#6b7280",marginTop:8,borderTop:"1px solid #f3f4f6",paddingTop:8}}>{row.notes}</p>}
          </div>
        ))}
        {rows.length === 0 && <p style={{textAlign:"center",color:"#9ca3af",padding:32}}>No accounts registered</p>}
      </div>

      <Modal title={editId?"Edit account":"New account"} open={open} onClose={()=>setOpen(false)} onSubmit={save}>
        <Field label="Bank"><Input value={form.bank_name} onChange={e=>setForm({...form,bank_name:e.target.value})} placeholder="BBVA, Banamex..."/></Field>
        <Field label="Account label"><Input value={form.account_label} onChange={e=>setForm({...form,account_label:e.target.value})} placeholder="Operating account"/></Field>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Currency"><Select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}><option value="MXN">MXN — Mexican Peso</option><option value="USD">USD — US Dollar</option><option value="CRC">CRC — Costa Rica Colon</option><option value="JMD">JMD — Jamaica Dollar</option><option value="XCD">XCD — East Caribbean (St. Lucia)</option></Select></Field>
          <Field label="Balance"><Input type="number" value={form.balance} onChange={e=>setForm({...form,balance:e.target.value})} placeholder="0.00"/></Field>
        </div>
        <Field label="Updated"><Input type="date" value={form.updated_at} onChange={e=>setForm({...form,updated_at:e.target.value})}/></Field>
        <Field label="Notes"><Textarea value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
      </Modal>
    </div>
  )
}