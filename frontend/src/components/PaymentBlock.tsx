import { api } from "../lib/api"
import { useEffect, useState } from "react"

export const paymentEmpty = {
  bank_id: "",
  bank_name: "",
  account_label: "",
  currency: "",
  payment_date: new Date().toISOString().split("T")[0],
  reference: "",
  amount_paid: ""
}

export default function PaymentBlock({ payForm, setPayForm, totalAmount, currency }: { payForm: any, setPayForm: any, totalAmount?: number, currency?: string }) {
  const [banks, setBanks] = useState<any[]>([])

  useEffect(() => {
    api.banks.list().then(setBanks).catch(console.error)
  }, [])

  const balance = totalAmount && payForm.amount_paid ? totalAmount - parseFloat(payForm.amount_paid || "0") : null

  return (
    <div style={{background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:10,padding:"16px",marginTop:8}}>
      <p style={{fontSize:12,fontWeight:500,color:"#92400e",margin:"0 0 12px"}}>
        Payment details — will be recorded automatically
      </p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div>
          <label style={{fontSize:12,fontWeight:500,color:"#374151",display:"block",marginBottom:6}}>Amount to pay now</label>
          <input type="number" value={payForm.amount_paid||""} onChange={e=>setPayForm({...payForm,amount_paid:e.target.value})}
            placeholder={totalAmount ? `Max: ${totalAmount}` : "0.00"}
            style={{width:"100%",padding:"8px 12px",border:"1px solid #d1d5db",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
          {balance !== null && balance > 0 && (
            <p style={{fontSize:11,color:"#92400e",marginTop:4}}>Remaining balance: {new Intl.NumberFormat("en-US",{style:"currency",currency:currency==="MXN"?"MXN":"USD",maximumFractionDigits:0}).format(balance)}</p>
          )}
        </div>
        <div>
          <label style={{fontSize:12,fontWeight:500,color:"#374151",display:"block",marginBottom:6}}>Payment date</label>
          <input type="date" value={payForm.payment_date}
            onChange={e=>setPayForm({...payForm,payment_date:e.target.value})}
            style={{width:"100%",padding:"8px 12px",border:"1px solid #d1d5db",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
        </div>
      </div>
      <div style={{marginBottom:12}}>
        <label style={{fontSize:12,fontWeight:500,color:"#374151",display:"block",marginBottom:6}}>Bank account</label>
        <select value={payForm.bank_id}
          onChange={e => {
            const selected = banks.find(b => b.id === e.target.value)
            if (selected) {
              setPayForm({...payForm, bank_id:selected.id, bank_name:selected.bank_name, account_label:selected.account_label, currency:selected.currency})
            } else {
              setPayForm({...payForm, bank_id:"", bank_name:"", account_label:"", currency:""})
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
      <div>
        <label style={{fontSize:12,fontWeight:500,color:"#374151",display:"block",marginBottom:6}}>Reference / Transfer #</label>
        <input value={payForm.reference||""} onChange={e=>setPayForm({...payForm,reference:e.target.value})}
          placeholder="Transfer reference..."
          style={{width:"100%",padding:"8px 12px",border:"1px solid #d1d5db",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
      </div>
    </div>
  )
}