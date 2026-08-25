import { useEffect, useState } from "react"
import { authHeaders } from "../lib/auth"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8889"
const req = async (path: string, opts?: any) => {
  const res = await fetch(API+path,{headers:{"Content-Type":"application/json",...authHeaders()},...opts})
  if(!res.ok) throw new Error("Error "+res.status)
  return res.json()
}

const typeIcon: Record<string,string> = { bug:"🐛", suggestion:"💡", question:"❓", confusion:"😕" }
const priorityColor: Record<string,{bg:string,color:string}> = {
  urgent: {bg:"#fee2e2",color:"#991b1b"},
  normal: {bg:"#fef3c7",color:"#92400e"},
  low: {bg:"#dcfce7",color:"#166534"}
}
const statusColor: Record<string,{bg:string,color:string}> = {
  pending: {bg:"#f3f4f6",color:"#6b7280"},
  "in-progress": {bg:"#dbeafe",color:"#1e40af"},
  resolved: {bg:"#dcfce7",color:"#166534"}
}

export default function FeedbackAdmin() {
  const [items, setItems] = useState<any[]>([])
  const [filter, setFilter] = useState("all")
  const [selected, setSelected] = useState<any>(null)
  const [response, setResponse] = useState("")

  const load = async () => {
    const data = await req("/feedback")
    setItems(data)
  }
  useEffect(() => { load() }, [])

  const update = async (id: string, status: string, resp?: string) => {
    await req(`/feedback/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status, response: resp || undefined })
    })
    setSelected(null)
    setResponse("")
    load()
  }

  const filtered = filter === "all" ? items : items.filter(i => i.status === filter)
  const pending = items.filter(i => i.status === "pending").length
  const urgent = items.filter(i => i.priority === "urgent").length

  return (
    <div style={{padding:"28px 32px",maxWidth:1000}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:500,margin:0}}>Feedback — Admin</h1>
          <p style={{fontSize:13,color:"#6b7280",marginTop:4}}>
            {pending > 0 && <span style={{color:"#92400e",fontWeight:500}}>{pending} pending</span>}
            {urgent > 0 && <span style={{color:"#991b1b",fontWeight:500,marginLeft:12}}>🔴 {urgent} urgent</span>}
          </p>
        </div>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[["all","All"],["pending","Pending"],["in-progress","In Progress"],["resolved","Resolved"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)}
            style={{padding:"5px 14px",borderRadius:20,fontSize:12,cursor:"pointer",border:"none",
              background:filter===v?"#1d4ed8":"#f3f4f6",color:filter===v?"#fff":"#374151"}}>{l}</button>
        ))}
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {filtered.length === 0 && <p style={{color:"#9ca3af",textAlign:"center",padding:32}}>No feedback yet</p>}
        {filtered.map(item => (
          <div key={item.id} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"16px 20px",cursor:"pointer"}}
            onClick={()=>{setSelected(item);setResponse(item.response||"")}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{display:"flex",gap:10,alignItems:"center",flex:1}}>
                <span style={{fontSize:20}}>{typeIcon[item.type]||"💬"}</span>
                <div style={{flex:1}}>
                  <p style={{fontSize:14,color:"#111827",margin:0}}>{item.description}</p>
                  <p style={{fontSize:11,color:"#9ca3af",marginTop:4}}>
                    {item.page} · {item.created_by} · {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div style={{display:"flex",gap:6,marginLeft:12}}>
                <span style={{...priorityColor[item.priority],padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:500}}>{item.priority}</span>
                <span style={{...statusColor[item.status],padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:500}}>{item.status}</span>
              </div>
            </div>
            {item.response && (
              <div style={{background:"#f0fdf4",borderRadius:8,padding:"8px 12px",marginTop:10}}>
                <p style={{fontSize:12,color:"#065f46",margin:0}}>✅ {item.response}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {selected && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}
          onClick={e=>{if(e.target===e.currentTarget)setSelected(null)}}>
          <div style={{background:"#fff",borderRadius:16,padding:"24px",width:"100%",maxWidth:500}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
              <h3 style={{fontSize:16,fontWeight:500,margin:0}}>{typeIcon[selected.type]} {selected.type}</h3>
              <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#9ca3af"}}>×</button>
            </div>
            <p style={{fontSize:14,color:"#111827",marginBottom:8}}>{selected.description}</p>
            <p style={{fontSize:12,color:"#9ca3af",marginBottom:16}}>{selected.page} · {selected.created_by} · {new Date(selected.created_at).toLocaleDateString()}</p>

            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,color:"#6b7280",display:"block",marginBottom:6}}>Response / Notes</label>
              <textarea value={response} onChange={e=>setResponse(e.target.value)}
                placeholder="Write your response or fix notes..."
                rows={3}
                style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,resize:"vertical",boxSizing:"border-box"}}/>
            </div>

            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>update(selected.id,"in-progress",response)}
                style={{flex:1,padding:"9px",background:"#dbeafe",color:"#1e40af",border:"none",borderRadius:8,fontSize:13,cursor:"pointer"}}>
                In Progress
              </button>
              <button onClick={()=>update(selected.id,"resolved",response)}
                style={{flex:1,padding:"9px",background:"#dcfce7",color:"#166534",border:"none",borderRadius:8,fontSize:13,cursor:"pointer"}}>
                Resolved ✅
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}