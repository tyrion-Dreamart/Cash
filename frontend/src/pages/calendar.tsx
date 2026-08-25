import { useEffect, useState } from "react"
import { authHeaders } from "../lib/auth"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8889"
const req = async (path: string) => {
  const res = await fetch(API+path,{headers:{"Content-Type":"application/json",...authHeaders()}})
  if(!res.ok) throw new Error("Error "+res.status)
  return res.json()
}

const fmt = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n)

export default function CalendarPage() {
  const [payables, setPayables] = useState<any[]>([])
  const [receivables, setReceivables] = useState<any[]>([])
  const [others, setOthers] = useState<any[]>([])
  const [selected, setSelected] = useState<string|null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showOverdue, setShowOverdue] = useState(false)
  const [fx] = useState(17.5)

  const todayStr = new Date().toISOString().split("T")[0]

  useEffect(() => {
    Promise.all([
      req("/payables"),
      req("/receivables"),
      req("/others")
    ]).then(([p, r, o]) => {
      setPayables(p)
      setReceivables(r)
      setOthers(o)
    })
  }, [])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthName = currentDate.toLocaleString("es-MX", { month:"long", year:"numeric" })
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month+1, 0).getDate()
  const today = new Date().toISOString().split("T")[0]

  const getEventsForDay = (dateStr: string) => {
    if (!showOverdue && dateStr < todayStr) return []
    const events: any[] = []

    payables.filter(p => p.due_date === dateStr && !["pagado"].includes(p.status)).forEach(p => {
      const bal = Number(p.amount) - Number(p.amount_paid||0)
      events.push({ type:"pay", label:p.vendor_name, amount:bal, priority:p.priority?.replace("CXPPriority.",""), hotel:p.hotel, country:p.country, status:p.status })
    })

    receivables.filter(r => r.due_date === dateStr && !["cobrado"].includes(r.status)).forEach(r => {
      const bal = Number(r.amount) - Number(r.amount_paid||0)
      events.push({ type:"collect", label:r.client_name, amount:bal, hotel:r.hotel, country:r.country, status:r.status })
    })

    others.filter(o => o.due_date === dateStr && !["liquidado","cancelado"].includes(o.status)).forEach(o => {
      const bal = Number(o.amount) - Number(o.amount_paid||0)
      events.push({ type: o.direction==="pagar"?"pay":"collect", label:o.concept, amount:bal, hotel:"--", country:"--", status:o.status, isOther:true })
    })

    return events
  }

  const getDayColor = (events: any[]) => {
    if (!events.length) return null
    const hasAltaPay = events.some(e => e.type==="pay" && e.priority==="alta")
    const hasPayments = events.some(e => e.type==="pay")
    const hasCollections = events.some(e => e.type==="collect")
    if (hasAltaPay) return "#fee2e2"
    if (hasPayments && hasCollections) return "#fef3c7"
    if (hasPayments) return "#fff0f0"
    return "#f0fdf4"
  }

  const selectedEvents = selected ? getEventsForDay(selected) : []
  const totalPay = selectedEvents.filter(e=>e.type==="pay").reduce((s,e)=>s+e.amount,0)
  const totalCollect = selectedEvents.filter(e=>e.type==="collect").reduce((s,e)=>s+e.amount,0)

  const weeks: (number|null)[][] = []
  let week: (number|null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length) { while(week.length < 7) week.push(null); weeks.push(week) }

  return (
    <div style={{padding:"28px 32px",maxWidth:1100}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <h1 style={{fontSize:20,fontWeight:500,margin:0}}>Payment Calendar</h1>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>setShowOverdue(!showOverdue)}
            style={{padding:"5px 14px",borderRadius:20,fontSize:12,cursor:"pointer",border:"none",
              background:showOverdue?"#fee2e2":"#f3f4f6",color:showOverdue?"#991b1b":"#374151"}}>
            {showOverdue ? "Hide overdue" : "Show overdue"}
          </button>
          <div style={{display:"flex",gap:12,fontSize:12,color:"#6b7280",marginRight:8}}>
            <span><span style={{display:"inline-block",width:10,height:10,background:"#fee2e2",borderRadius:2,marginRight:4,border:"1px solid #fca5a5"}}/>High priority</span>
            <span><span style={{display:"inline-block",width:10,height:10,background:"#fff0f0",borderRadius:2,marginRight:4,border:"1px solid #fca5a5"}}/>Payments</span>
            <span><span style={{display:"inline-block",width:10,height:10,background:"#f0fdf4",borderRadius:2,marginRight:4,border:"1px solid #86efac"}}/>Collections</span>
            <span><span style={{display:"inline-block",width:10,height:10,background:"#fef3c7",borderRadius:2,marginRight:4,border:"1px solid #fcd34d"}}/>Both</span>
          </div>
          <button onClick={()=>setCurrentDate(new Date(year,month-1,1))}
            style={{padding:"6px 14px",background:"#f3f4f6",border:"none",borderRadius:8,cursor:"pointer",fontSize:14}}>←</button>
          <span style={{fontSize:14,fontWeight:500,textTransform:"capitalize",minWidth:140,textAlign:"center"}}>{monthName}</span>
          <button onClick={()=>setCurrentDate(new Date(year,month+1,1))}
            style={{padding:"6px 14px",background:"#f3f4f6",border:"none",borderRadius:8,cursor:"pointer",fontSize:14}}>→</button>
        </div>
      </div>

      <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:"#f9fafb",borderBottom:"1px solid #e5e7eb"}}>
          {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map(d=>(
            <div key={d} style={{padding:"10px",textAlign:"center",fontSize:11,fontWeight:500,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em"}}>{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
            {week.map((day, di) => {
              const dateStr = day ? `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}` : ""
              const events = day ? getEventsForDay(dateStr) : []
              const bgColor = getDayColor(events)
              const isToday = dateStr === today
              const isSelected = dateStr === selected
              const isPast = dateStr < todayStr

              return (
                <div key={di} onClick={()=>day&&events.length&&setSelected(isSelected?null:dateStr)}
                  style={{
                    minHeight:90, padding:"8px", borderRight:"1px solid #f3f4f6", borderBottom:"1px solid #f3f4f6",
                    background: isSelected?"#eff6ff":bgColor||(isPast&&!showOverdue?"#fafafa":"#fff"),
                    cursor:day&&events.length?"pointer":"default",
                    opacity: isPast && !showOverdue ? 0.5 : 1
                  }}>
                  {day && (
                    <>
                      <span style={{
                        display:"inline-flex",alignItems:"center",justifyContent:"center",
                        width:24,height:24,borderRadius:"50%",fontSize:13,fontWeight:isToday?500:400,
                        background:isToday?"#1d4ed8":"transparent",
                        color:isToday?"#fff":isPast?"#9ca3af":"#374151"
                      }}>{day}</span>
                      <div style={{marginTop:4,display:"flex",flexDirection:"column",gap:2}}>
                        {events.slice(0,3).map((e,i)=>(
                          <div key={i} style={{
                            fontSize:10,padding:"1px 5px",borderRadius:4,
                            background:e.type==="pay"?(e.priority==="alta"?"#fee2e2":"#fff0f0"):"#f0fdf4",
                            color:e.type==="pay"?"#991b1b":"#166534",
                            whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"
                          }}>
                            {e.type==="pay"?"↓":"↑"} {fmt(e.amount)}
                          </div>
                        ))}
                        {events.length > 3 && (
                          <span style={{fontSize:10,color:"#9ca3af"}}>+{events.length-3} more</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {selected && selectedEvents.length > 0 && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}
          onClick={e=>{if(e.target===e.currentTarget)setSelected(null)}}>
          <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:520,maxHeight:"80vh",overflowY:"auto"}}>
            <div style={{padding:"20px 24px",borderBottom:"1px solid #f3f4f6",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"#fff"}}>
              <div>
                <h3 style={{fontSize:16,fontWeight:500,margin:0}}>{selected}</h3>
                <p style={{fontSize:12,color:"#6b7280",margin:"4px 0 0"}}>{selectedEvents.length} events</p>
              </div>
              <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#9ca3af"}}>×</button>
            </div>
            <div style={{padding:"16px 24px",display:"flex",gap:12,borderBottom:"1px solid #f3f4f6"}}>
              {totalPay > 0 && (
                <div style={{flex:1,background:"#fee2e2",borderRadius:10,padding:"10px 14px"}}>
                  <p style={{fontSize:11,color:"#991b1b",margin:0}}>To pay</p>
                  <p style={{fontSize:18,fontWeight:500,color:"#991b1b",margin:"4px 0 0"}}>{fmt(totalPay)}</p>
                </div>
              )}
              {totalCollect > 0 && (
                <div style={{flex:1,background:"#dcfce7",borderRadius:10,padding:"10px 14px"}}>
                  <p style={{fontSize:11,color:"#166534",margin:0}}>To collect</p>
                  <p style={{fontSize:18,fontWeight:500,color:"#166534",margin:"4px 0 0"}}>{fmt(totalCollect)}</p>
                </div>
              )}
            </div>
            <div style={{padding:"16px 24px"}}>
              {selectedEvents.map((e,i)=>(
                <div key={i} style={{padding:"12px 0",borderBottom:"1px solid #f9fafb"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
                        <span style={{fontSize:11,padding:"1px 8px",borderRadius:20,fontWeight:500,background:e.type==="pay"?(e.priority==="alta"?"#fee2e2":"#fff0f0"):"#dcfce7",color:e.type==="pay"?"#991b1b":"#166534"}}>{e.type==="pay"?"Payment":"Collection"}</span>
                        {e.priority==="alta" && <span style={{fontSize:11,padding:"1px 8px",borderRadius:20,background:"#fee2e2",color:"#991b1b",fontWeight:500}}>High priority</span>}
                        {e.isOther && <span style={{fontSize:11,padding:"1px 8px",borderRadius:20,background:"#ede9fe",color:"#7c3aed"}}>Others</span>}
                      </div>
                      <p style={{fontSize:14,fontWeight:500,color:"#111827",margin:0}}>{e.label}</p>
                      <p style={{fontSize:12,color:"#6b7280",margin:"2px 0 0"}}>{e.hotel||"--"} · {e.country||"--"}</p>
                    </div>
                    <p style={{fontSize:16,fontWeight:500,color:e.type==="pay"?"#dc2626":"#059669",margin:0,whiteSpace:"nowrap"}}>
                      {e.type==="pay"?"-":"+"}{fmt(e.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}