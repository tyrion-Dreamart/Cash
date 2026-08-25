import { useEffect, useState } from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LineChart, Line, Legend } from "recharts"
import { authHeaders } from "../lib/auth"

const fmt = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n)
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8889"

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0]?.payload
    return (
      <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 16px",minWidth:200,boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}>
        <p style={{fontSize:12,fontWeight:500,color:"#374151",margin:"0 0 8px"}}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{fontSize:13,fontWeight:500,color:p.color,margin:"2px 0"}}>
            {p.name}: {fmt(p.value)}
          </p>
        ))}
        {d?.inflow_events?.length>0&&(
          <div style={{marginTop:6,borderTop:"1px solid #f3f4f6",paddingTop:6}}>
            {d.inflow_events.map((e:any,i:number)=>(
              <p key={i} style={{fontSize:11,color:"#059669",margin:"1px 0"}}>+ {e.label}: {fmt(e.amount)}</p>
            ))}
          </div>
        )}
        {d?.outflow_events?.length>0&&(
          <div style={{marginTop:4}}>
            {d.outflow_events.map((e:any,i:number)=>(
              <p key={i} style={{fontSize:11,color:"#ef4444",margin:"1px 0"}}>- {e.label}: {fmt(e.amount)}</p>
            ))}
          </div>
        )}
      </div>
    )
  }
  return null
}

interface SimEvent {
  id: string
  type: "inflow" | "outflow"
  label: string
  amount: number
  day: number
}

export default function ForecastPage() {
  const [data, setData] = useState<any>(null)
  const [scenario, setScenario] = useState("base")
  const [view, setView] = useState("balance")
  const [fx, setFx] = useState(17.5)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [simEvents, setSimEvents] = useState<SimEvent[]>([])
  const [showSimPanel, setShowSimPanel] = useState(false)
  const [simForm, setSimForm] = useState({ type:"inflow", label:"", amount:"", day:"" })

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/forecast/liquidity?days=${days}&scenario=${scenario}&fx_rate=${fx}`, { headers: authHeaders() })
      setData(await res.json())
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [scenario, fx, days])

  const applySimulation = (baseData: any) => {
    if (!simEvents.length) return baseData
    const modified = baseData.days.map((d: any) => {
      const dayEvents = simEvents.filter(e => e.day === d.day)
      const extraInflow = dayEvents.filter(e => e.type === "inflow").reduce((s,e) => s + e.amount, 0)
      const extraOutflow = dayEvents.filter(e => e.type === "outflow").reduce((s,e) => s + e.amount, 0)
      return { ...d, sim_inflow: extraInflow, sim_outflow: extraOutflow }
    })
    let balance = baseData.starting_balance
    const result = modified.map((d: any) => {
      balance = balance + d.inflow + d.sim_inflow - d.outflow - d.sim_outflow
      return { ...d, sim_balance: Math.round(balance), sim_risk: balance < 0 }
    })
    return { ...baseData, days: result }
  }

  const addSimEvent = () => {
    if (!simForm.label || !simForm.amount || !simForm.day) return
    setSimEvents([...simEvents, {
      id: Date.now().toString(),
      type: simForm.type as "inflow" | "outflow",
      label: simForm.label,
      amount: parseFloat(simForm.amount),
      day: parseInt(simForm.day)
    }])
    setSimForm({ type:"inflow", label:"", amount:"", day:"" })
  }

  if (loading) return <div style={{padding:40,color:"#6b7280"}}>Calculating forecast...</div>
  if (!data) return <div style={{padding:40,color:"#ef4444"}}>Error loading forecast</div>

  const simData = applySimulation(data)
  const s = data.summary
  const hasSimulation = simEvents.length > 0

  const simSummary = hasSimulation ? {
    day_final: simData.days[simData.days.length-1]?.sim_balance || 0,
    min_balance: Math.min(...simData.days.map((d:any) => d.sim_balance || 0)),
    days_negative: simData.days.filter((d:any) => d.sim_risk).length
  } : null

  const scenarioColor: Record<string,string> = { optimistic:"#059669", base:"#1e40af", conservative:"#991b1b" }
  const color = scenarioColor[scenario]

  const upcomingOutflows = data.days
    .flatMap((d:any) => d.outflow_events.map((e:any) => ({...e, date:d.label, day:d.day})))
    .filter((e:any) => e.amount > 0)
    .sort((a:any,b:any) => b.amount - a.amount)
    .slice(0,6)

  const upcomingInflows = data.days
    .flatMap((d:any) => d.inflow_events.map((e:any) => ({...e, date:d.label, day:d.day})))
    .filter((e:any) => e.amount > 0)
    .sort((a:any,b:any) => a.day - b.day)
    .slice(0,6)

  return (
    <div style={{padding:"28px 32px",maxWidth:1200}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:500,margin:0}}>Liquidity Forecast — {days} days</h1>
          <p style={{fontSize:13,color:"#6b7280",marginTop:4}}>Projected cash position based on CXC, CXP and debt</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:4}}>
            {[30,60,90].map(d=>(
              <button key={d} onClick={()=>setDays(d)}
                style={{padding:"5px 12px",borderRadius:20,fontSize:12,cursor:"pointer",border:"none",
                  background:days===d?"#1d4ed8":"#f3f4f6",color:days===d?"#fff":"#374151"}}>{d}d</button>
            ))}
          </div>
          <label style={{fontSize:12,color:"#6b7280"}}>FX</label>
          <input type="number" value={fx} onChange={e=>setFx(Number(e.target.value))} onBlur={load}
            style={{width:70,padding:"6px 8px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13}}/>
          <button onClick={()=>setShowSimPanel(!showSimPanel)}
            style={{padding:"6px 14px",background:showSimPanel?"#7c3aed":"#f3f4f6",color:showSimPanel?"#fff":"#374151",border:"none",borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer"}}>
            {showSimPanel ? "Hide simulation" : "Simulate"}
          </button>
        </div>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[["optimistic","Optimistic","130% CXC"],["base","Base","100% CXC"],["conservative","Conservative","60% CXC"]].map(([key,label,desc])=>(
          <div key={key} onClick={()=>setScenario(key)}
            style={{padding:"10px 14px",borderRadius:10,cursor:"pointer",flex:1,
              background:scenario===key?"#111827":"#fff",
              border:`1px solid ${scenario===key?"#111827":"#e5e7eb"}`}}>
            <p style={{fontSize:13,fontWeight:500,color:scenario===key?"#f9fafb":"#374151",margin:0}}>{label}</p>
            <p style={{fontSize:11,color:scenario===key?"#9ca3af":"#6b7280",marginTop:2}}>{desc}</p>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"14px 16px"}}>
          <p style={{fontSize:11,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>Balance today</p>
          <p style={{fontSize:20,fontWeight:500,color:"#1e40af",margin:"6px 0 0"}}>{fmt(data.starting_balance)}</p>
        </div>
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"14px 16px"}}>
          <p style={{fontSize:11,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>Day {days} base</p>
          <p style={{fontSize:20,fontWeight:500,color:s.day_30_balance>=0?"#065f46":"#991b1b",margin:"6px 0 0"}}>{fmt(s.day_30_balance)}</p>
          {simSummary && <p style={{fontSize:12,color:simSummary.day_final>=0?"#059669":"#dc2626",marginTop:4}}>Sim: {fmt(simSummary.day_final)}</p>}
        </div>
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"14px 16px"}}>
          <p style={{fontSize:11,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>Min balance</p>
          <p style={{fontSize:20,fontWeight:500,color:s.min_balance>=0?"#065f46":"#991b1b",margin:"6px 0 0"}}>{fmt(s.min_balance)}</p>
          {simSummary && <p style={{fontSize:12,color:simSummary.min_balance>=0?"#059669":"#dc2626",marginTop:4}}>Sim: {fmt(simSummary.min_balance)}</p>}
        </div>
        <div style={{background:s.days_negative>0?"#fee2e2":"#dcfce7",border:`1px solid ${s.days_negative>0?"#fca5a5":"#86efac"}`,borderRadius:12,padding:"14px 16px"}}>
          <p style={{fontSize:11,color:s.days_negative>0?"#991b1b":"#166534",textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>Days at risk</p>
          <p style={{fontSize:20,fontWeight:500,color:s.days_negative>0?"#991b1b":"#166534",margin:"6px 0 0"}}>{s.days_negative}d</p>
          {simSummary && <p style={{fontSize:12,color:simSummary.days_negative<s.days_negative?"#059669":"#dc2626",marginTop:4}}>Sim: {simSummary.days_negative}d</p>}
        </div>
      </div>

      {showSimPanel && (
        <div style={{background:"#faf5ff",border:"1px solid #e9d5ff",borderRadius:12,padding:"16px 20px",marginBottom:20}}>
          <p style={{fontSize:13,fontWeight:500,color:"#7c3aed",margin:"0 0 12px"}}>Simulation — add events to see impact</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 2fr 1fr 1fr auto",gap:10,alignItems:"end",marginBottom:12}}>
            <div>
              <label style={{fontSize:11,color:"#6b7280",display:"block",marginBottom:4}}>Type</label>
              <select value={simForm.type} onChange={e=>setSimForm({...simForm,type:e.target.value})}
                style={{width:"100%",padding:"7px 10px",border:"1px solid #d1d5db",borderRadius:8,fontSize:13}}>
                <option value="inflow">Inflow (+)</option>
                <option value="outflow">Outflow (-)</option>
              </select>
            </div>
            <div>
              <label style={{fontSize:11,color:"#6b7280",display:"block",marginBottom:4}}>Description</label>
              <input value={simForm.label} onChange={e=>setSimForm({...simForm,label:e.target.value})}
                placeholder="e.g. Collect Fiesta Jamaica"
                style={{width:"100%",padding:"7px 10px",border:"1px solid #d1d5db",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
            </div>
            <div>
              <label style={{fontSize:11,color:"#6b7280",display:"block",marginBottom:4}}>Amount USD</label>
              <input type="number" value={simForm.amount} onChange={e=>setSimForm({...simForm,amount:e.target.value})}
                placeholder="0"
                style={{width:"100%",padding:"7px 10px",border:"1px solid #d1d5db",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
            </div>
            <div>
              <label style={{fontSize:11,color:"#6b7280",display:"block",marginBottom:4}}>Day (1-{days})</label>
              <input type="number" value={simForm.day} onChange={e=>setSimForm({...simForm,day:e.target.value})}
                placeholder="1"
                style={{width:"100%",padding:"7px 10px",border:"1px solid #d1d5db",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
            </div>
            <button onClick={addSimEvent}
              style={{padding:"7px 16px",background:"#7c3aed",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap"}}>
              Add
            </button>
          </div>
          {simEvents.length > 0 && (
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {simEvents.map(e=>(
                <div key={e.id} style={{display:"flex",alignItems:"center",gap:6,background:"#fff",border:"1px solid #e9d5ff",borderRadius:20,padding:"4px 12px",fontSize:12}}>
                  <span style={{color:e.type==="inflow"?"#059669":"#ef4444"}}>{e.type==="inflow"?"+":"-"}{fmt(e.amount)}</span>
                  <span style={{color:"#374151"}}>{e.label}</span>
                  <span style={{color:"#9ca3af"}}>day {e.day}</span>
                  <button onClick={()=>setSimEvents(simEvents.filter(s=>s.id!==e.id))}
                    style={{background:"none",border:"none",cursor:"pointer",color:"#9ca3af",fontSize:14,padding:0}}>×</button>
                </div>
              ))}
              <button onClick={()=>setSimEvents([])}
                style={{padding:"4px 12px",background:"#fee2e2",color:"#991b1b",border:"none",borderRadius:20,fontSize:12,cursor:"pointer"}}>
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <p style={{fontSize:13,fontWeight:500,color:"#374151",margin:0}}>
            {scenario.charAt(0).toUpperCase()+scenario.slice(1)} scenario
            {hasSimulation && <span style={{fontSize:11,background:"#ede9fe",color:"#7c3aed",padding:"1px 8px",borderRadius:20,marginLeft:8}}>Simulation active</span>}
          </p>
          <div style={{display:"flex",gap:6}}>
            {[["balance","Balance"],["flows","Cash flows"]].map(([key,label])=>(
              <button key={key} onClick={()=>setView(key)}
                style={{padding:"4px 12px",borderRadius:20,fontSize:12,cursor:"pointer",border:"none",
                  background:view===key?"#1d4ed8":"#f3f4f6",color:view===key?"#fff":"#374151"}}>{label}</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          {view==="balance" ? (
            <AreaChart data={simData.days} margin={{top:4,right:16,left:0,bottom:4}}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.15}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
              <XAxis dataKey="label" tick={{fontSize:10,fill:"#9ca3af"}} interval={Math.floor(days/8)}/>
              <YAxis tick={{fontSize:10,fill:"#9ca3af"}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
              <Tooltip content={<CustomTooltip/>}/>
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={2}/>
              <Area type="monotone" dataKey="balance" stroke={color} strokeWidth={2} fill="url(#grad)" name="Base" dot={false}/>
              {hasSimulation && <Area type="monotone" dataKey="sim_balance" stroke="#7c3aed" strokeWidth={2} fill="none" strokeDasharray="5 3" name="Simulated" dot={false}/>}
            </AreaChart>
          ) : (
            <LineChart data={simData.days} margin={{top:4,right:16,left:0,bottom:4}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
              <XAxis dataKey="label" tick={{fontSize:10,fill:"#9ca3af"}} interval={Math.floor(days/8)}/>
              <YAxis tick={{fontSize:10,fill:"#9ca3af"}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
              <Tooltip/>
              <Legend/>
              <Line type="monotone" dataKey="inflow" stroke="#059669" strokeWidth={2} dot={false} name="Inflows"/>
              <Line type="monotone" dataKey="outflow" stroke="#ef4444" strokeWidth={2} dot={false} name="Outflows"/>
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"16px 20px"}}>
          <p style={{fontSize:12,fontWeight:500,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Expected inflows</p>
          {upcomingInflows.map((e:any,i:number)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f3f4f6"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,background:"#dcfce7",color:"#166534",padding:"1px 8px",borderRadius:20,whiteSpace:"nowrap"}}>{e.date}</span>
                <span style={{fontSize:12,color:"#374151"}}>{e.label}</span>
              </div>
              <span style={{fontSize:13,fontWeight:500,color:"#065f46",whiteSpace:"nowrap"}}>+{fmt(e.amount)}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",marginTop:4}}>
            <span style={{fontSize:12,color:"#6b7280",fontWeight:500}}>Total {days}d</span>
            <span style={{fontSize:14,fontWeight:500,color:"#065f46"}}>{fmt(s.total_inflows)}</span>
          </div>
        </div>
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"16px 20px"}}>
          <p style={{fontSize:12,fontWeight:500,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Upcoming payments</p>
          {upcomingOutflows.map((e:any,i:number)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f3f4f6"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,background:"#fee2e2",color:"#991b1b",padding:"1px 8px",borderRadius:20,whiteSpace:"nowrap"}}>{e.date}</span>
                <span style={{fontSize:12,color:"#374151"}}>{e.label}</span>
              </div>
              <span style={{fontSize:13,fontWeight:500,color:"#991b1b",whiteSpace:"nowrap"}}>-{fmt(e.amount)}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",marginTop:4}}>
            <span style={{fontSize:12,color:"#6b7280",fontWeight:500}}>Total {days}d</span>
            <span style={{fontSize:14,fontWeight:500,color:"#991b1b"}}>{fmt(s.total_outflows)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}