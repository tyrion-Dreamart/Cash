import { api } from "../lib/api"
import { useEffect, useState } from "react"

export const receiptEmpty = {
  bank_id: "",
  bank_name: "",
  account_label: "",
  currency: "",
  receipt_date: new Date().toISOString().split("T")[0],
  reference: ""
}

export default function ReceiptBlock({ receiptForm, setReceiptForm }: { receiptForm: any, setReceiptForm: any }) {
  const [banks, setBanks] = useState<any[]>([])

  useEffect(() => {
    api.banks.list().then(setBanks).catch(console.error)
  }, [])

  return (
    <div style={{background:"#dcfce7",border:"1px solid #86efac",borderRadius:10,padding:"16px",marginTop:8}}>
      <p style={{fontSize:12,fontWeight:500,color:"#166534",margin:"0 0 12px"}}>
        Receipt details — will be recorded automatically in Receipts
      </p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div>
          <label style={{fontSize:12,fontWeight:500,color:"#374151",display:"block",marginBottom:6}}>Receipt date</label>
          <input type="date" value={receiptForm.receipt_date}
            onChange={e=>setReceiptForm({...receiptForm,receipt_date:e.target.value})}
            style={{width:"100%",padding:"8px 12px",border:"1px solid #d1d5db",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
        </div>
        <div>
          <label style={{fontSize:12,fontWeight:500,color:"#374151",display:"block",marginBottom:6}}>Bank account received</label>
          <select
            value={receiptForm.bank_id}
            onChange={e => {
              const selected = banks.find(b => b.id === e.target.value)
              if (selected) {
                setReceiptForm({...receiptForm, bank_id:selected.id, bank_name:selected.bank_name, account_label:selected.account_label, currency:selected.currency})
              } else {
                setReceiptForm({...receiptForm, bank_id:"", bank_name:"", account_label:"", currency:""})
              }
            }}
            style={{width:"100%",padding:"8px 12px",border:"1px solid #d1d5db",borderRadius:8,fontSize:13,boxSizing:"border-box"}}>
            <option value="">Select account...</option>
            {banks.map(b => (
              <option key={b.id} value={b.id}>
                {b.bank_name} — {b.account_label} ({b.currency})
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{marginTop:12}}>
        <label style={{fontSize:12,fontWeight:500,color:"#374151",display:"block",marginBottom:6}}>Reference / Transfer #</label>
        <input value={receiptForm.reference||""} onChange={e=>setReceiptForm({...receiptForm,reference:e.target.value})}
          placeholder="Transfer reference..."
          style={{width:"100%",padding:"8px 12px",border:"1px solid #d1d5db",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
      </div>
    </div>
  )
}