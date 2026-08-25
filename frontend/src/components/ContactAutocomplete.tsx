import { useState, useEffect, useRef } from "react"
import { authHeaders } from "../lib/auth"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8889"

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect?: (contact: any) => void
  placeholder?: string
  type?: string
}

export default function ContactAutocomplete({ value, onChange, onSelect, placeholder, type }: Props) {
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const search = async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return }
    try {
      const url = `${API}/contacts?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ""}`
      const res = await fetch(url, { headers: authHeaders() })
      const data = await res.json()
      setSuggestions(data)
      setOpen(data.length > 0)
    } catch(e) { setSuggestions([]); setOpen(false) }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
    search(e.target.value)
  }

  const handleSelect = (contact: any) => {
    onChange(contact.legal_name)
    setOpen(false)
    if (onSelect) onSelect(contact)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false)
  }

  return (
    <div ref={ref} style={{position:"relative"}}>
      <input
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => value.length >= 2 && suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder || "Search or type new..."}
        style={{width:"100%",padding:"8px 12px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,boxSizing:"border-box",outline:"none"}}
      />
      {open && suggestions.length > 0 && (
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:200,background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,boxShadow:"0 4px 12px rgba(0,0,0,0.1)",maxHeight:220,overflowY:"auto",marginTop:2}}>
          {suggestions.map((c, i) => (
            <div key={c.id} onClick={() => handleSelect(c)}
              style={{padding:"9px 14px",cursor:"pointer",borderBottom:"1px solid #f3f4f6",background:"#fff"}}
              onMouseEnter={e => (e.currentTarget.style.background="#f3f4f6")}
              onMouseLeave={e => (e.currentTarget.style.background="#fff")}>
              <p style={{fontSize:13,fontWeight:500,color:"#111827",margin:0}}>{c.legal_name}</p>
              {c.commercial_name && <p style={{fontSize:11,color:"#6b7280",margin:"2px 0 0"}}>{c.commercial_name}</p>}
              {c.country && <p style={{fontSize:11,color:"#9ca3af",margin:"1px 0 0"}}>{c.country}</p>}
            </div>
          ))}
          <div onClick={() => { setOpen(false) }}
            style={{padding:"8px 14px",cursor:"pointer",background:"#f9fafb",borderTop:"1px solid #e5e7eb"}}>
            <p style={{fontSize:12,color:"#6b7280",margin:0}}>+ Use "{value}" as new name</p>
          </div>
        </div>
      )}
    </div>
  )
}