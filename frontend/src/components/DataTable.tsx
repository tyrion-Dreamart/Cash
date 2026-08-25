import { useState, useEffect } from "react"

interface Column {
  key: string
  label: string
  render?: (val: any, row: any) => React.ReactNode
  width?: number
  filterable?: boolean
}

interface Props {
  columns: Column[]
  data: any[]
  onEdit: (row: any) => void
  onDelete: (id: string) => void
  onAdd: () => void
  addLabel?: string
  emptyMsg?: string
}

const statusColors: Record<string, { bg: string; color: string }> = {
  pendiente:    { bg: "#f3f4f6", color: "#374151" },
  parcial:      { bg: "#fef3c7", color: "#92400e" },
  cobrado:      { bg: "#dcfce7", color: "#166534" },
  vencido:      { bg: "#fee2e2", color: "#991b1b" },
  programado:   { bg: "#dbeafe", color: "#1e40af" },
  pagado:       { bg: "#dcfce7", color: "#166534" },
  al_corriente: { bg: "#dcfce7", color: "#166534" },
  por_vencer:   { bg: "#fef3c7", color: "#92400e" },
  liquidado:    { bg: "#dcfce7", color: "#166534" },
  cancelado:    { bg: "#f3f4f6", color: "#6b7280" },
}

const priorityColors: Record<string, { bg: string; color: string }> = {
  alta:  { bg: "#fee2e2", color: "#991b1b" },
  media: { bg: "#fef3c7", color: "#92400e" },
  baja:  { bg: "#f3f4f6", color: "#6b7280" },
}

export function StatusBadge({ value }: { value: string }) {
  const c = statusColors[value] || { bg: "#f3f4f6", color: "#374151" }
  return <span style={{ ...c, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500 }}>{value.replace("_", " ")}</span>
}

export function PriorityBadge({ value }: { value: string }) {
  const c = priorityColors[value] || { bg: "#f3f4f6", color: "#374151" }
  return <span style={{ ...c, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500 }}>{value}</span>
}

export default function DataTable({ columns, data, onEdit, onDelete, onAdd, addLabel = "+ Nuevo", emptyMsg = "Sin registros" }: Props) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [role, setRole] = useState<string>("")
  const [colFilters, setColFilters] = useState<Record<string, string>>({})
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  useEffect(() => {
    setRole(localStorage.getItem("role") || "")
  }, [])

  const isViewer = role === "viewer"

  const filtered = data.filter(row => {
    return Object.entries(colFilters).every(([key, val]) => {
      if (!val) return true
      const cellVal = String(row[key] || "").toLowerCase()
      return cellVal.includes(val.toLowerCase())
    })
  })

  const th: React.CSSProperties = {
    padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 500,
    color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em",
    borderBottom: "1px solid #e5e7eb", background: "#f9fafb",
  }
  const td: React.CSSProperties = {
    padding: "11px 14px", fontSize: 13, color: "#111827",
    borderBottom: "1px solid #f3f4f6", verticalAlign: "middle",
  }

  const activeFiltersCount = Object.values(colFilters).filter(Boolean).length

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        {activeFiltersCount > 0 && (
          <button onClick={() => setColFilters({})}
            style={{ fontSize: 12, padding: "4px 12px", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 6, cursor: "pointer" }}>
            Clear {activeFiltersCount} filter{activeFiltersCount > 1 ? "s" : ""}
          </button>
        )}
        {!activeFiltersCount && <div/>}
        {!isViewer && (
          <button onClick={onAdd} style={{ padding: "8px 18px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            {addLabel}
          </button>
        )}
      </div>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {columns.map(c => (
                <th key={c.key} style={{ ...th, width: c.width, position: "relative", cursor: "pointer" }}
                  onClick={() => setActiveFilter(activeFilter === c.key ? null : c.key)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {c.label}
                    {colFilters[c.key] && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", display: "inline-block" }}/>}
                    <span style={{ fontSize: 9, color: "#9ca3af", marginLeft: "auto" }}>▼</span>
                  </div>
                  {activeFilter === c.key && (
                    <div onClick={e => e.stopPropagation()}
                      style={{ position: "absolute", top: "100%", left: 0, zIndex: 100, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, minWidth: 180, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                      <input
                        autoFocus
                        value={colFilters[c.key] || ""}
                        onChange={e => setColFilters({ ...colFilters, [c.key]: e.target.value })}
                        placeholder={`Filter ${c.label}...`}
                        style={{ width: "100%", padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, boxSizing: "border-box" }}
                      />
                      {colFilters[c.key] && (
                        <button onClick={() => { setColFilters({ ...colFilters, [c.key]: "" }); setActiveFilter(null) }}
                          style={{ marginTop: 6, width: "100%", padding: "4px", background: "#f3f4f6", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", color: "#6b7280" }}>
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </th>
              ))}
              {!isViewer && <th style={{ ...th, width: 100 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={columns.length + (isViewer ? 0 : 1)} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: "28px 14px" }}>
                {activeFiltersCount > 0 ? `No results for current filters` : emptyMsg}
              </td></tr>
            ) : (
              filtered.map(row => (
                <tr key={row.id} style={{ background: "#fff" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                  {columns.map(c => <td key={c.key} style={td}>{c.render ? c.render(row[c.key], row) : row[c.key] ?? "--"}</td>)}
                  {!isViewer && (
                    <td style={td}>
                      {confirmDelete === row.id ? (
                        <span style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => { onDelete(row.id); setConfirmDelete(null) }} style={{ fontSize: 12, padding: "3px 8px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>Confirm</button>
                          <button onClick={() => setConfirmDelete(null)} style={{ fontSize: 12, padding: "3px 8px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
                        </span>
                      ) : (
                        <span style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => onEdit(row)} style={{ fontSize: 12, padding: "3px 10px", background: "#dbeafe", color: "#1e40af", border: "none", borderRadius: 6, cursor: "pointer" }}>Edit</button>
                          <button onClick={() => setConfirmDelete(row.id)} style={{ fontSize: 12, padding: "3px 10px", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 6, cursor: "pointer" }}>x</button>
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {filtered.length > 0 && data.length > 0 && (
        <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 8, textAlign: "right" }}>
          {filtered.length} of {data.length} records
        </p>
      )}
    </div>
  )
}