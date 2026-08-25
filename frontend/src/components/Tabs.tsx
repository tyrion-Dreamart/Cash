interface TabsProps {
  tabs: { key: string; label: string; count?: number }[]
  active: string
  onChange: (key: string) => void
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div style={{display:"flex",gap:2,background:"#f3f4f6",borderRadius:10,padding:4,marginBottom:16,flexWrap:"wrap"}}>
      {tabs.map(t => (
        <button key={t.key} onClick={()=>onChange(t.key)}
          style={{padding:"7px 16px",borderRadius:8,fontSize:13,cursor:"pointer",border:"none",
            background:active===t.key?"#fff":"transparent",
            color:active===t.key?"#111827":"#6b7280",
            fontWeight:active===t.key?500:400,
            boxShadow:active===t.key?"0 1px 3px rgba(0,0,0,0.1)":"none",
            transition:"all 0.15s",
            display:"flex",alignItems:"center",gap:6}}>
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span style={{background:active===t.key?"#fee2e2":"#e5e7eb",color:active===t.key?"#991b1b":"#6b7280",borderRadius:20,padding:"1px 7px",fontSize:11,fontWeight:500}}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}