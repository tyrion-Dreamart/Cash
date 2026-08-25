import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import FeedbackButton from "./FeedbackButton"

const navItems = [
  { href:"/", label:"Dashboard" },
  { href:"/agent", label:"CFO Agent" },
  { href:"/reclassify", label:"Reclassify Dates" },
  { href:"/forecast", label:"Forecast 30d" },
  { href:"/calendar", label:"Calendar" },
  { href:"/bank-positions", label:"Daily banks" },
  { href:"/banks", label:"Banks" },
  { href:"/receivables", label:"CXC -- Receivables" },
  { href:"/receipts", label:"Receipts received" },
  { href:"/payables", label:"CXP -- Payables" },
  { href:"/payments", label:"Payments made" },
  { href:"/debt", label:"Debt" },
  { href:"/others", label:"Others" },
  { href:"/contacts", label:"Contacts" },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState("")

  useEffect(() => {
    if (typeof window !== "undefined") setRole(localStorage.getItem("role") || "")
  }, [])

  const allItems = role === "cfo" ? [...navItems, { href:"/feedback-admin", label:"Feedback 💬" }] : navItems

  return (
    <div style={{display:"flex",minHeight:"100vh",fontFamily:"system-ui,sans-serif",background:"#f9fafb"}}>
      {open && <div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:40}}/>}
      <aside style={{width:220,background:"#111827",display:"flex",flexDirection:"column",padding:"24px 0",flexShrink:0,position:"fixed",top:0,left:0,bottom:0,zIndex:50,transform:open?"translateX(0)":"translateX(-100%)",transition:"transform 0.25s ease"}}>
        <div style={{padding:"0 20px 24px",borderBottom:"1px solid #1f2937",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p style={{fontSize:15,fontWeight:500,color:"#f9fafb",margin:0}}>Dreamart</p>
            <p style={{fontSize:11,color:"#6b7280",margin:"4px 0 0",textTransform:"uppercase",letterSpacing:"0.08em"}}>Cash Control</p>
          </div>
          <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:"#9ca3af",fontSize:20,cursor:"pointer",padding:4}}>x</button>
        </div>
        <nav style={{padding:"16px 0",flex:1,overflowY:"auto"}}>
          {allItems.map(item => {
            const active = router.pathname === item.href
            return (
              <Link key={item.href} href={item.href} onClick={()=>setOpen(false)}
                style={{display:"block",padding:"11px 20px",fontSize:14,textDecoration:"none",color:active?"#f9fafb":"#9ca3af",background:active?"#1f2937":"transparent",borderLeft:active?"3px solid #3b82f6":"3px solid transparent"}}>
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div style={{padding:"16px 20px",borderTop:"1px solid #1f2937"}}>
          <p style={{fontSize:11,color:"#4b5563",margin:0}}>v2.0 Fase 3</p>
        </div>
      </aside>
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        <header style={{background:"#111827",padding:"12px 16px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:30}}>
          <button onClick={()=>setOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",flexDirection:"column",gap:4}}>
            <span style={{display:"block",width:22,height:2,background:"#9ca3af",borderRadius:2}}/>
            <span style={{display:"block",width:22,height:2,background:"#9ca3af",borderRadius:2}}/>
            <span style={{display:"block",width:22,height:2,background:"#9ca3af",borderRadius:2}}/>
          </button>
          <span style={{fontSize:14,fontWeight:500,color:"#f9fafb"}}>
            {allItems.find(n=>n.href===router.pathname)?.label||"Dreamart Cash Control"}
          </span>
        </header>
        <main style={{flex:1,overflowY:"auto",overflowX:"hidden"}}>{children}</main>
        <FeedbackButton/>
      </div>
    </div>
  )
}