export default function ManualPayment({order}){
 if(order.payment_method!=='manual')return null;
 return <section className="dk-panel manual-payment"><h3>DuitNow / bank transfer</h3><p>Payment status: <strong>{order.payment_status}</strong>. The owner confirms payment against their bank records.</p>
 {order.payment_status==='unpaid' && order.status!=='cancelled' && <><p>Transfer RM {(Number(order.total_amount)+Number(order.shipping_fee)).toFixed(2)}. Use <strong>Order #{order.id}</strong> as your transfer reference. Do not pay again if you have already transferred.</p><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{order.payment_instructions?.instructions}</p>{order.payment_instructions?.qr_url && <a href={order.payment_instructions.qr_url} target="_blank" rel="noreferrer">Open the kitchen's DuitNow QR image</a>}<p>Confirm the recipient name and amount in your banking app before paying.</p></>}
 </section>
}
