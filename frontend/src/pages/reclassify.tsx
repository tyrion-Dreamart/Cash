import { useEffect, useState } from "react"
import { authHeaders } from "../lib/auth"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8889"
const fmt = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n)

export default function ReclassifyPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState<string|null>(null)
  const [applied, setApplied] = useState<string[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/agent/reclassify/suggestions`, { headers: authHeaders() })
      if (!res.ok) throw new Error("Error "+res.status)
      setData(await res.json())
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  const apply = async (type: string, id: string, new_date: string, key: string) => {
    setApplying(key)
    try {
      const res = await fetch(`${API}/agent/reclassify/apply`, {
        method: "POST",
        headers: {"Content-Type":"application/json", ...authHeaders()},
        body: JSON.stringify({type, id, new_date})
      })
      if (!res.ok) throw new Error("Error "+res.status)
      setApplied(prev => [...prev, key])
    } catch(e) { console.error(e) }
    finally { setApplying(null) }
  }

  const SuggestionCard = ({ item, type, color, bgColor }: any) => {
    const key = `${type}-${item.invoice || item.concept}-${item.current_date}`
    const isApplied = applied.includes(key)
    const isApplying = applying === key

    return (
      <div style={{background:"#fff",border:`1px solid ${isApplied?"#86efac":"#e5e7eb"}`,borderRadius:10,padding:"14px 16px",marginBottom:10,opacity:isApplied?0.7:1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
              <span style={{background:bgColor,color:color,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:500}}>
                {type.toUpperCase()}
              </span>
              <span style={{fontSize:13,fontWeight:500,color:"#111827"}}>
                {item.vendor || item.client || item.concept}
              </span>
              {item.invoice && <span style={{fontSize:12,color:"#6b7280"}}>{item.invoice}</span>}
            </div>
            <div style={{display:"flex",gap:16,fontSize:12,color:"#6b7280",marginBottom:6}}>
              <span>Vencida: <span style={{color:"#991b1b",fontWeight:500}}>{item.current_date}</span></span>
              <span>→</span>
              <span>Propuesta: <span style={{color:"#1e40af",fontWeight:500}}>{item.suggested_date}</span></span>
              <span style={{color:"#065f46",fontWeight:500}}>{fmt(item.amount)}</span>
            </div>
            <p style={{fontSize:12,color:"#6b7280",margin:0,fontStyle:"italic"}}>{item.reason}</p>
          </div>
          <div style={{marginLeft:12}}>
            {isApplied ? (
              <span style={{fontSize:12,color:"#166534",background:"#dcfce7",padding:"4px 12px",borderRadius:20}}>✅ Applied</span>
            ) : (
              <button
                onClick={() => apply(type, item.id, item.suggested_date, key)}
                disabled={!!isApplying}
                style={{padding:"6px 14px",background:"#1d4ed8",color:"#fff",border:"none",borderRadius:8,fontSize:12,cursor:"pointer",opacity:isApplying?0.5:1}}>
                {isApplying ? "..." : "Apply"}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{padding:"28px 32px",maxWidth:1000}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:500,margin:0}}>CFO Agent — Date Reclassification</h1>
          <p style={{fontSize:13,color:"#6b7280",marginTop:4}}>AI analyzes overdue invoices and suggests new dates based on cash flow</p>
        </div>
        <button onClick={load} disabled={loading}
          style={{padding:"8px 20px",background:"#7c3aed",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:500,cursor:"pointer",opacity:loading?0.5:1}}>
          {loading ? "Analyzing..." : "Analyze & Suggest"}
        </button>
      </div>

      {!data && !loading && (
        <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:12,padding:40,textAlign:"center"}}>
          <p style={{fontSize:32,margin:0}}>🤖</p>
          <p style={{fontSize:15,fontWeight:500,color:"#374151",marginTop:12}}>Ready to analyze overdue invoices</p>
          <p style={{fontSize:13,color:"#6b7280",marginTop:4}}>Click "Analyze & Suggest" to get AI recommendations</p>
        </div>
      )}

      {loading && (
        <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:12,padding:40,textAlign:"center"}}>
          <p style={{fontSize:32,margin:0}}>⏳</p>
          <p style={{fontSize:15,fontWeight:500,color:"#374151",marginTop:12}}>Analyzing cash flow and overdue invoices...</p>
          <p style={{fontSize:13,color:"#6b7280",marginTop:4}}>This may take 10-20 seconds</p>
        </div>
      )}

      {data && !loading && (
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
            <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"14px 16px"}}>
              <p style={{fontSize:11,color:"#6b7280",textTransform:"uppercase",margin:0}}>Current balance</p>
              <p style={{fontSize:20,fontWeight:500,color:"#1e40af",margin:"6px 0 0"}}>{fmt(data.current_balance)}</p>
            </div>
            <div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:12,padding:"14px 16px"}}>
              <p style={{fontSize:11,color:"#991b1b",textTransform:"uppercase",margin:0}}>CXP overdue</p>
              <p style={{fontSize:20,fontWeight:500,color:"#991b1b",margin:"6px 0 0"}}>{data.total_overdue_cxp} invoices</p>
            </div>
            <div style={{background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:12,padding:"14px 16px"}}>
              <p style={{fontSize:11,color:"#92400e",textTransform:"uppercase",margin:0}}>CXC overdue</p>
              <p style={{fontSize:20,fontWeight:500,color:"#92400e",margin:"6px 0 0"}}>{data.total_overdue_cxc} invoices</p>
            </div>
            <div style={{background:"#ede9fe",border:"1px solid #c4b5fd",borderRadius:12,padding:"14px 16px"}}>
              <p style={{fontSize:11,color:"#7c3aed",textTransform:"uppercase",margin:0}}>Others overdue</p>
              <p style={{fontSize:20,fontWeight:500,color:"#7c3aed",margin:"6px 0 0"}}>{data.total_overdue_others} items</p>
            </div>
          </div>

          {data.suggestions?.summary && (
            <div style={{background:"#111827",borderRadius:12,padding:"16px 20px",marginBottom:24}}>
              <p style={{fontSize:11,color:"#9ca3af",textTransform:"uppercase",margin:"0 0 8px"}}>CFO Analysis</p>
              <p style={{fontSize:14,color:"#f9fafb",margin:0,lineHeight:1.6}}>{data.suggestions.summary}</p>
            </div>
          )}

          {data.suggestions?.cxp?.length > 0 && (
            <div style={{marginBottom:24}}>
              <h3 style={{fontSize:14,fontWeight:500,color:"#991b1b",marginBottom:12}}>
                CXP — Payments to reschedule ({data.suggestions.cxp.length})
              </h3>
              {data.suggestions.cxp.map((item: any, i: number) => (
                <SuggestionCard key={i} item={item} type="cxp" color="#991b1b" bgColor="#fee2e2"/>
              ))}
            </div>
          )}

          {data.suggestions?.cxc?.length > 0 && (
            <div style={{marginBottom:24}}>
              <h3 style={{fontSize:14,fontWeight:500,color:"#92400e",marginBottom:12}}>
                CXC — Collections to follow up ({data.suggestions.cxc.length})
              </h3>
              {data.suggestions.cxc.map((item: any, i: number) => (
                <SuggestionCard key={i} item={item} type="cxc" color="#92400e" bgColor="#fef3c7"/>
              ))}
            </div>
          )}

          {data.suggestions?.others?.length > 0 && (
            <div style={{marginBottom:24}}>
              <h3 style={{fontSize:14,fontWeight:500,color:"#7c3aed",marginBottom:12}}>
                Others — To reschedule ({data.suggestions.others.length})
              </h3>
              {data.suggestions.others.map((item: any, i: number) => (
                <SuggestionCard key={i} item={item} type="other" color="#7c3aed" bgColor="#ede9fe"/>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}