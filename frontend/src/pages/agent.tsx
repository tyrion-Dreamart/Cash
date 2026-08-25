import { useEffect, useState, useRef } from "react"

import { authHeaders } from "../lib/auth"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8889"

const req = async (path: string, opts?: any) => {
  const res = await fetch(API+path,{headers:{"Content-Type":"application/json",...authHeaders()},...opts})
  if(!res.ok) throw new Error("Error "+res.status)
  return res.json()
}

const SUGGESTED = [
  "What should I pay this week to avoid going negative?",
  "Which invoices are most at risk of not being collected?",
  "How much do I need to collect before June 4th?",
  "What is our current liquidity risk?",
  "Summarize the financial position of Dreamart today",
  "Which country has the worst CXP vs CXC ratio?",
]

export default function AgentPage() {
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState<any>(null)
  const bottomRef = useRef<any>(null)

  useEffect(() => {
    loadContext()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const loadContext = async () => {
    try {
      const [dashboard, forecast, collection] = await Promise.all([
        req("/dashboard?fx_rate=17.5"),
        req("/forecast/liquidity?days=30&scenario=base&fx_rate=17.5"),
        req("/collection/summary")
      ])
      setContext({ dashboard, forecast, collection })
    } catch(e) { console.error(e) }
  }

  const send = async (text?: string) => {
    const msg = text || input
    if (!msg.trim() || loading) return
    setInput("")
    const userMsg = { role: "user", content: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const systemPrompt = `You are the CFO advisor for Dreamart Photography Group, a multi-hotel photography company operating in Mexico, Costa Rica, Jamaica, and St. Lucia.

You have access to real-time financial data:

CURRENT FINANCIAL POSITION:
- Total banks: $${context?.dashboard?.total_banks_usd_equiv?.toLocaleString()} USD
- CXC active (receivables): $${context?.dashboard?.total_cxc_active?.toLocaleString()} USD
- CXC overdue: $${context?.dashboard?.total_cxc_overdue?.toLocaleString()} USD  
- CXP pending (payables): $${context?.dashboard?.total_cxp_pending?.toLocaleString()} USD
- High priority CXP: $${context?.dashboard?.cxp_alta_prioridad?.toLocaleString()} USD
- Total debt: $${context?.dashboard?.total_debt_balance?.toLocaleString()} USD
- Net working capital: $${context?.dashboard?.working_capital_net?.toLocaleString()} USD
- CXC/CXP ratio: ${context?.dashboard?.cxc_cxp_ratio?.toFixed(2)} (healthy >1.2)
- Net flow 30d estimated: $${context?.dashboard?.estimated_net_flow_30d?.toLocaleString()} USD

FORECAST (30 days base scenario):
- Starting balance: $${context?.forecast?.starting_balance?.toLocaleString()} USD
- Day 30 projected: $${context?.forecast?.summary?.day_30_balance?.toLocaleString()} USD
- Minimum balance: $${context?.forecast?.summary?.min_balance?.toLocaleString()} USD
- Critical day (goes negative): ${context?.forecast?.summary?.critical_day || "None"}
- Days at risk: ${context?.forecast?.summary?.days_negative} of 30
- Total expected inflows: $${context?.forecast?.summary?.total_inflows?.toLocaleString()} USD
- Total expected outflows: $${context?.forecast?.summary?.total_outflows?.toLocaleString()} USD

COLLECTION STATUS:
- Total overdue invoices: ${context?.collection?.total_overdue}
- With follow-up: ${context?.collection?.with_followup}
- Without follow-up: ${context?.collection?.without_followup}
- Pending actions today: ${context?.collection?.pending_actions_today}

POSITION BY COUNTRY:
${context?.dashboard?.by_country?.map((c: any) => `- ${c.country}: CXC $${c.total_cxc?.toLocaleString()}, CXP $${c.total_cxp?.toLocaleString()}, Net $${c.net?.toLocaleString()}`).join('\n')}

Be direct, concise and action-oriented. Give specific recommendations based on the data. Use numbers. Format responses clearly with bullet points when listing items. Respond in the same language the user writes in (Spanish or English).`

      const response = await fetch(`${API}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          fx_rate: 17.5
        })
      })
      const data = await response.json()
      const reply = data.content || "Error getting response"
      setMessages(prev => [...prev, { role: "assistant", content: reply }])
    } catch(e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error connecting to AI. Please try again." }])
    }
    setLoading(false)
  }

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 50px)",maxWidth:900,margin:"0 auto",padding:"0 24px"}}>
      <div style={{padding:"20px 0 16px",borderBottom:"1px solid #e5e7eb"}}>
        <h1 style={{fontSize:20,fontWeight:500,margin:0}}>CFO Agent</h1>
        <p style={{fontSize:13,color:"#6b7280",marginTop:4}}>
          Ask anything about Dreamart finances — real data, real answers
          {context && <span style={{marginLeft:8,fontSize:11,background:"#dcfce7",color:"#166534",padding:"1px 8px",borderRadius:20}}>Live data loaded</span>}
        </p>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 0"}}>
        {messages.length === 0 && (
          <div>
            <div style={{background:"#111827",borderRadius:12,padding:"16px 20px",marginBottom:20}}>
              <p style={{fontSize:13,fontWeight:500,color:"#f9fafb",margin:"0 0 8px"}}>Financial snapshot</p>
              {context ? (
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
                  {[
                    ["Banks", `$${context.dashboard?.total_banks_usd_equiv?.toLocaleString()} USD`],
                    ["CXC active", `$${context.dashboard?.total_cxc_active?.toLocaleString()} USD`],
                    ["CXP pending", `$${context.dashboard?.total_cxp_pending?.toLocaleString()} USD`],
                    ["Days at risk", `${context.forecast?.summary?.days_negative} of 30`],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p style={{fontSize:11,color:"#9ca3af",margin:0}}>{label}</p>
                      <p style={{fontSize:14,fontWeight:500,color:"#f9fafb",margin:"2px 0 0"}}>{value}</p>
                    </div>
                  ))}
                </div>
              ) : <p style={{fontSize:13,color:"#9ca3af",margin:0}}>Loading financial data...</p>}
            </div>
            <p style={{fontSize:12,color:"#9ca3af",marginBottom:12}}>Suggested questions:</p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {SUGGESTED.map((q,i) => (
                <button key={i} onClick={()=>send(q)}
                  style={{textAlign:"left",padding:"10px 14px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,color:"#374151",cursor:"pointer"}}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{marginBottom:16,display:"flex",flexDirection:msg.role==="user"?"row-reverse":"row",gap:10}}>
            <div style={{
              maxWidth:"80%",padding:"12px 16px",borderRadius:12,fontSize:13,lineHeight:1.6,
              background:msg.role==="user"?"#1d4ed8":"#fff",
              color:msg.role==="user"?"#fff":"#111827",
              border:msg.role==="assistant"?"1px solid #e5e7eb":"none",
              whiteSpace:"pre-wrap"
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            <div style={{padding:"12px 16px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,fontSize:13,color:"#9ca3af"}}>
              Analyzing financial data...
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      <div style={{padding:"12px 0",borderTop:"1px solid #e5e7eb"}}>
        <div style={{display:"flex",gap:10}}>
          <input value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
            placeholder="Ask about cash flow, payments, collections..."
            style={{flex:1,padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontSize:13,outline:"none"}}/>
          <button onClick={()=>send()} disabled={loading||!input.trim()}
            style={{padding:"10px 20px",background:"#1d4ed8",color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:500,cursor:"pointer",opacity:loading||!input.trim()?0.5:1}}>
            Send
          </button>
        </div>
        <p style={{fontSize:11,color:"#9ca3af",marginTop:8,textAlign:"center"}}>
          Real-time data from Dreamart Cash Control
        </p>
      </div>
    </div>
  )
}