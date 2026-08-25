import { useEffect, useState } from "react"
import { api } from "../lib/api"

const fmt = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n)
const RatioBadge = ({ val, good, warn }: { val:number, good:number, warn:number }) => {
  const c = val>=good?{bg:"#dcfce7",color:"#166534"}:val>=warn?{bg:"#fef3c7",color:"#92400e"}:{bg:"#fee2e2",color:"#991b1b"}
  return <span style={{...c,padding:"2px 10px",borderRadius:20,fontSize:13,fontWeight:500}}>{val.toFixed(2)}</span>
}

export default function Dashboard() {
  const [data, setData] = useState<any>(null)
  const [fx, setFx] = useState(17.5)
  const [loading, setLoading] = useState(true)
  const [selectedCountry, setSelectedCountry] = useState<any>(null)

  const load = async () => { setLoading(true); try { setData(await api.dashboard(fx)) } catch(e){} finally { setLoading(false) } }
  useEffect(() => { load() }, [fx])

  if (loading) return <div style={{padding:40,color:"#6b7280"}}>Calculating...</div>
  if (!data) return <div style={{padding:40,color:"#ef4444"}}>Connection error</div>

  const kpis = [
    { label:"Total banks", value:fmt(data.total_banks_usd_equiv), sub:`MXN ${new Intl.NumberFormat("es-MX").format(data.total_banks_mxn)} + USD ${new Intl.NumberFormat("es-MX").format(data.total_banks_usd)}`, color:"#1e40af" },
    { label:"CXC active", value:fmt(data.total_cxc_active), sub:`Overdue: ${fmt(data.total_cxc_overdue)}`, color:"#065f46" },
    { label:"CXP pending", value:fmt(data.total_cxp_pending), sub:`High priority: ${fmt(data.cxp_alta_prioridad)}`, color:"#92400e" },
    { label:"Debt next 30d", value:fmt(data.debt_due_next_30d), sub:`Total: ${fmt(data.total_debt_balance)}`, color:"#7c2d12" },
    { label:"Net flow 30d", value:fmt(data.estimated_net_flow_30d), sub:"CXC - CXP - debt", color:data.estimated_net_flow_30d>=0?"#065f46":"#991b1b" },
    { label:"Others to collect", value:fmt(data.others_to_collect), sub:`To pay: ${fmt(data.others_to_pay)}`, color:"#4c1d95" },
  ]

  const sev = (s: string): React.CSSProperties => ({
    background:s==="red"?"#fef2f2":"#fffbeb",
    borderLeft:`4px solid ${s==="red"?"#ef4444":"#f59e0b"}`,
    color:s==="red"?"#991b1b":"#92400e",
    padding:"10px 14px", borderRadius:"0 8px 8px 0", fontSize:12, marginBottom:6
  })

  return (
    <div style={{padding:"16px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:18,fontWeight:500,margin:0}}>Dreamart Cash Control</h1>
          <p style={{fontSize:12,color:"#6b7280",marginTop:2}}>{new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <label style={{fontSize:12,color:"#6b7280"}}>FX</label>
          <input type="number" value={fx} onChange={e=>setFx(Number(e.target.value))} onBlur={load}
            style={{width:70,padding:"6px 8px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13}}/>
          <button onClick={load} style={{padding:"6px 12px",background:"#1d4ed8",color:"#fff",border:"none",borderRadius:8,fontSize:12,cursor:"pointer"}}>Update</button>
        </div>
      </div>

      <div style={{background:"#111827",borderRadius:12,padding:"16px",marginBottom:16}}>
        <p style={{fontSize:11,fontWeight:500,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Liquidity position today</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12}}>
          <div>
            <p style={{fontSize:11,color:"#9ca3af",marginBottom:4}}>Banks</p>
            <p style={{fontSize:18,fontWeight:500,color:"#60a5fa",margin:0}}>{fmt(data.total_banks_usd_equiv)}</p>
          </div>
          <div>
            <p style={{fontSize:11,color:"#9ca3af",marginBottom:4}}>Received today</p>
            <p style={{fontSize:18,fontWeight:500,color:data.receipts_today>0?"#34d399":"#9ca3af",margin:0}}>+{fmt(data.receipts_today||0)}</p>
          </div>
          <div>
            <p style={{fontSize:11,color:"#9ca3af",marginBottom:4}}>Paid today</p>
            <p style={{fontSize:18,fontWeight:500,color:data.payments_today>0?"#f87171":"#9ca3af",margin:0}}>-{fmt(data.payments_today||0)}</p>
          </div>
          <div>
            <p style={{fontSize:11,color:"#9ca3af",marginBottom:4}}>Estimated</p>
            <p style={{fontSize:18,fontWeight:500,color:(data.estimated_balance||data.total_banks_usd_equiv)>=0?"#34d399":"#f87171",margin:0}}>{fmt(data.estimated_balance||data.total_banks_usd_equiv)}</p>
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
        {kpis.map((k,i)=>(
          <div key={i} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"14px 16px"}}>
            <p style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{k.label}</p>
            <p style={{fontSize:20,fontWeight:500,color:k.color,margin:0}}>{k.value}</p>
            <p style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{k.sub}</p>
          </div>
        ))}
      </div>

      <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"14px 16px",marginBottom:16}}>
        <p style={{fontSize:11,fontWeight:500,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Working capital ratios</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <div>
            <p style={{fontSize:11,color:"#6b7280",marginBottom:4}}>Net capital</p>
            <p style={{fontSize:16,fontWeight:500,color:data.working_capital_net>=0?"#166534":"#991b1b",margin:0}}>{fmt(data.working_capital_net)}</p>
          </div>
          <div>
            <p style={{fontSize:11,color:"#6b7280",marginBottom:4}}>CXC/CXP</p>
            <RatioBadge val={data.cxc_cxp_ratio} good={1.2} warn={0.9}/>
          </div>
          <div>
            <p style={{fontSize:11,color:"#6b7280",marginBottom:4}}>Debt cover</p>
            <RatioBadge val={data.debt_coverage_ratio} good={2} warn={1}/>
          </div>
        </div>
      </div>

      {data.by_country?.length > 0 && (
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"14px 16px",marginBottom:16}}>
          <p style={{fontSize:11,fontWeight:500,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Position by country</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
            {data.by_country.map((c: any)=>(
              <div key={c.country} onClick={()=>setSelectedCountry(c)}
                style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:10,padding:"10px 12px",cursor:"pointer"}}>
                <p style={{fontSize:12,fontWeight:500,color:"#374151",marginBottom:6}}>{c.country}</p>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                  <span style={{color:"#6b7280"}}>CXC</span><span style={{color:"#065f46",fontWeight:500}}>{fmt(c.total_cxc)}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                  <span style={{color:"#6b7280"}}>CXP</span><span style={{color:"#92400e",fontWeight:500}}>{fmt(c.total_cxp)}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,borderTop:"1px solid #e5e7eb",paddingTop:3}}>
                  <span style={{color:"#6b7280"}}>Net</span><span style={{color:c.net>=0?"#065f46":"#991b1b",fontWeight:500}}>{fmt(c.net)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"14px 16px"}}>
          <p style={{fontSize:11,fontWeight:500,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Inflows 30d</p>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,color:"#374151"}}>CXC</span><span style={{fontSize:12,fontWeight:500,color:"#065f46"}}>{fmt(data.cxc_due_this_month)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:"#374151"}}>Others</span><span style={{fontSize:12,fontWeight:500,color:"#065f46"}}>{fmt(data.others_to_collect)}</span></div>
        </div>
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"14px 16px"}}>
          <p style={{fontSize:11,fontWeight:500,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Outflows 30d</p>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,color:"#374151"}}>CXP</span><span style={{fontSize:12,fontWeight:500,color:"#92400e"}}>{fmt(data.cxp_due_this_month)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,color:"#374151"}}>Debt</span><span style={{fontSize:12,fontWeight:500,color:"#92400e"}}>{fmt(data.debt_due_next_30d)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:"#374151"}}>Others</span><span style={{fontSize:12,fontWeight:500,color:"#92400e"}}>{fmt(data.others_to_pay)}</span></div>
        </div>
      </div>

      {data.alerts.length > 0 && (
        <div style={{marginBottom:16}}>
          <p style={{fontSize:11,fontWeight:500,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Alerts — {data.alerts.length}</p>
          {data.alerts.slice(0,10).map((a: any,i: number)=>(
            <div key={i} style={sev(a.severity)}>{a.message}</div>
          ))}
          {data.alerts.length > 10 && <p style={{fontSize:11,color:"#9ca3af",marginTop:6}}>...and {data.alerts.length-10} more</p>}
        </div>
      )}

      {selectedCountry && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}
          onClick={e=>{if(e.target===e.currentTarget)setSelectedCountry(null)}}>
          <div style={{background:"#fff",borderRadius:16,padding:"24px",width:"100%",maxWidth:380}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 style={{fontSize:16,fontWeight:500,margin:0}}>{selectedCountry.country}</h2>
              <button onClick={()=>setSelectedCountry(null)} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#9ca3af"}}>×</button>
            </div>
            <div style={{background:"#f9fafb",borderRadius:10,padding:"14px",marginBottom:12}}>
              <p style={{fontSize:11,color:"#6b7280",textTransform:"uppercase",marginBottom:8}}>CXC — Receivables</p>
              <p style={{fontSize:20,fontWeight:500,color:"#065f46",margin:0}}>{fmt(selectedCountry.total_cxc)}</p>
            </div>
            <div style={{background:"#f9fafb",borderRadius:10,padding:"14px",marginBottom:12}}>
              <p style={{fontSize:11,color:"#6b7280",textTransform:"uppercase",marginBottom:8}}>CXP — Payables</p>
              <p style={{fontSize:20,fontWeight:500,color:"#92400e",margin:0}}>{fmt(selectedCountry.total_cxp)}</p>
            </div>
            <div style={{background:selectedCountry.net>=0?"#dcfce7":"#fee2e2",borderRadius:10,padding:"14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:500,color:selectedCountry.net>=0?"#166534":"#991b1b"}}>Net position</span>
                <span style={{fontSize:22,fontWeight:500,color:selectedCountry.net>=0?"#166534":"#991b1b"}}>{fmt(selectedCountry.net)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}