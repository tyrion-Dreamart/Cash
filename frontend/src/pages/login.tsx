import { useState } from "react"
import { useRouter } from "next/router"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8889"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    setLoading(true); setError("")
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      })
      if (!res.ok) { setError("Invalid username or password"); setLoading(false); return }
      const data = await res.json()
      localStorage.setItem("token", data.token)
      localStorage.setItem("role", data.role)
      localStorage.setItem("username", data.username)
      router.push("/")
    } catch(e) { setError("Connection error — please try again") }
    finally { setLoading(false) }
  }

  return (
    <div style={{minHeight:"100vh",background:"#111827",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{marginBottom:32,textAlign:"center"}}>
        <p style={{fontSize:28,fontWeight:500,color:"#f9fafb",margin:0}}>Dreamart</p>
        <p style={{fontSize:13,color:"#6b7280",marginTop:4,textTransform:"uppercase",letterSpacing:"0.1em"}}>Cash Control</p>
      </div>
      <div style={{background:"#1f2937",borderRadius:16,padding:"28px 24px",width:"100%",maxWidth:380}}>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:12,fontWeight:500,color:"#9ca3af",display:"block",marginBottom:8}}>Username</label>
          <input value={username} onChange={e=>setUsername(e.target.value)}
            placeholder="email@dreamartphotography.com"
            autoCapitalize="none" autoCorrect="off"
            style={{width:"100%",padding:"12px 14px",border:"1px solid #374151",borderRadius:10,fontSize:14,boxSizing:"border-box",background:"#111827",color:"#f9fafb"}}/>
        </div>
        <div style={{marginBottom:24}}>
          <label style={{fontSize:12,fontWeight:500,color:"#9ca3af",display:"block",marginBottom:8}}>Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleLogin()}
            style={{width:"100%",padding:"12px 14px",border:"1px solid #374151",borderRadius:10,fontSize:14,boxSizing:"border-box",background:"#111827",color:"#f9fafb"}}/>
        </div>
        {error && <p style={{fontSize:13,color:"#ef4444",marginBottom:16,textAlign:"center"}}>{error}</p>}
        <button onClick={handleLogin} disabled={loading}
          style={{width:"100%",padding:"13px",background:"#3b82f6",color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:500,cursor:"pointer",opacity:loading?0.7:1}}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </div>
  )
}