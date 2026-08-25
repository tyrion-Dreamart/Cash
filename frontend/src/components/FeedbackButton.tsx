import { useState } from "react"
import { useRouter } from "next/router"
import { authHeaders } from "../lib/auth"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8889"

export default function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ type:"suggestion", description:"", priority:"normal" })
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async () => {
    if (!form.description.trim()) return
    setLoading(true)
    try {
      await fetch(`${API}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ...form,
          page: router.pathname,
          created_by: localStorage.getItem("username") || "unknown"
        })
      })
      setSent(true)
      setTimeout(() => { setOpen(false); setSent(false); setForm({ type:"suggestion", description:"", priority:"normal" }) }, 2000)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{position:"fixed",bottom:24,right:24,zIndex:999,background:"#7c3aed",color:"#fff",border:"none",borderRadius:"50%",width:48,height:48,fontSize:20,cursor:"pointer",boxShadow:"0 4px 12px rgba(124,58,237,0.4)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        💬
      </button>

      {open && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:1000,padding:16}}
          onClick={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
          <div style={{background:"#fff",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:480,padding:"24px 20px"}}>
            {sent ? (
              <div style={{textAlign:"center",padding:"20px 0"}}>
                <p style={{fontSize:32,margin:0}}>✅</p>
                <p style={{fontSize:15,fontWeight:500,color:"#065f46",marginTop:8}}>Feedback sent!</p>
                <p style={{fontSize:13,color:"#6b7280",marginTop:4}}>Thanks — we will review it.</p>
              </div>
            ) : (
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <h3 style={{fontSize:16,fontWeight:500,margin:0}}>Send feedback</h3>
                  <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#9ca3af"}}>×</button>
                </div>
                <p style={{fontSize:11,color:"#9ca3af",margin:"0 0 14px"}}>Page: {router.pathname}</p>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                  <div>
                    <label style={{fontSize:12,color:"#6b7280",display:"block",marginBottom:6}}>Type</label>
                    <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}
                      style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13}}>
                      <option value="bug">🐛 Bug</option>
                      <option value="suggestion">💡 Suggestion</option>
                      <option value="question">❓ Question</option>
                      <option value="confusion">😕 Confusing</option>
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:12,color:"#6b7280",display:"block",marginBottom:6}}>Priority</label>
                    <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}
                      style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13}}>
                      <option value="urgent">🔴 Urgent</option>
                      <option value="normal">🟡 Normal</option>
                      <option value="low">🟢 Low</option>
                    </select>
                  </div>
                </div>

                <div style={{marginBottom:16}}>
                  <label style={{fontSize:12,color:"#6b7280",display:"block",marginBottom:6}}>Description</label>
                  <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}
                    placeholder="Describe the issue or suggestion..."
                    rows={4}
                    style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,resize:"vertical",boxSizing:"border-box"}}/>
                </div>

                <button onClick={submit} disabled={loading||!form.description.trim()}
                  style={{width:"100%",padding:"11px",background:"#7c3aed",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:500,cursor:"pointer",opacity:loading||!form.description.trim()?0.5:1}}>
                  {loading ? "Sending..." : "Send feedback"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}