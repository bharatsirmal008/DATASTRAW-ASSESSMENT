import { useEffect, useState } from 'react';
import { fetchTestOrders } from '../services/orders.api';
import type { MockOrder } from '../types/order';

export function AssessmentOrders() {
  const [orders, setOrders] = useState<MockOrder[]>([]);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [copyStatus, setCopyStatus] = useState('');
  useEffect(() => {
    let active = true;
    void fetchTestOrders().then(data => { if (active) { setOrders(data); setError(false); } }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt]);
  const copy = async (id: string) => {
    try { await navigator.clipboard.writeText(id); setCopyStatus(`${id} copied`); }
    catch { setCopyStatus(`Copy unavailable. Use ${id}.`); }
  };
  return <section className="assessment-orders" aria-labelledby="assessment-orders-heading">
    <div className="assessment-orders-heading"><p className="eyebrow">TRY AN ORDER LOOKUP</p><span className="assessment-label">Sample data</span></div>
    <h2 id="assessment-orders-heading">Meet your test orders</h2>
    <p className="reference-copy">Ask Aria about any order below. These fictional records are provided by the assessment.</p>
    {error ? <p role="alert">Could not load the orders. <button className="text-action" onClick={() => setAttempt(value => value + 1)}>Try again</button></p> : !orders.length ? <p role="status">Loading assessment orders…</p> : <div className="assessment-order-grid">{orders.map(order => <article key={order.orderId} className="assessment-order">
      <div className="assessment-order-top"><h3>{order.orderId}</h3><button className="copy-order" onClick={() => void copy(order.orderId)} aria-label={`Copy ${order.orderId}`} title="Copy order ID"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4" /></svg></button><span className={`order-badge ${order.status === 'Processing' ? 'processing' : order.status === 'Delivered' ? 'delivered' : 'transit'}`}>{order.status}</span></div>
      <div className="order-product-row"><div><p className="assessment-customer">{order.customer}</p><p className="order-product-name">{order.product}</p></div><p className="assessment-value">₹{order.valueInr.toLocaleString('en-IN')}</p></div>
      {order.courier && <p className="order-shipping">{order.courier} · {order.trackingNumber}</p>}
      <p className="assessment-order-note">{(order.estimatedDelivery || order.delivered || order.note || '').replace(' (assessment scenario only)', '')}</p>
    </article>)}</div>}
    <p className="order-disclaimer">Delivery times are fixed assessment scenarios. Aria checks eligibility; it cannot cancel or refund an order.</p>
    <p role="status" className="copy-status">{copyStatus}</p>
  </section>;
}
