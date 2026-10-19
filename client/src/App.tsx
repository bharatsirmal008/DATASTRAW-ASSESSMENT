import { useState, useEffect, useCallback } from 'react';
import { checkBackendHealth, checkCatalogConnection } from './services/api';
import type { CatalogConnection } from './services/api';
import { fetchPolicies } from './services/policies.api';
import type { BrandPolicies as BrandPoliciesType } from './types/policy';
import { VoiceAgent } from './components/VoiceAgent';
import { AriaChat } from './components/AriaChat';
import { BrandPolicies } from './components/BrandPolicies';
import { AssessmentOrders } from './components/AssessmentOrders';

function App() {
  const [connection, setConnection] = useState<'checking' | 'connected' | 'setup' | 'error'>('checking');
  const [activeMode, setActiveMode] = useState<'voice' | 'chat'>('voice');
  const [callActive, setCallActive] = useState(false);
  const [policies, setPolicies] = useState<BrandPoliciesType | null>(null);
  const [available, setAvailable] = useState(false);
  const [orderConnected, setOrderConnected] = useState(false);
  const [brandName, setBrandName] = useState('Customer care');
  const [catalogMode, setCatalogMode] = useState(false);
  const [assessmentMode, setAssessmentMode] = useState(false);
  const [catalog, setCatalog] = useState<CatalogConnection | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const connect = useCallback(async () => {
    setConnection('checking');
    try {
      const health = await checkBackendHealth();
      const ready = health.readiness?.ready === true;
      setAvailable(ready);
      setOrderConnected(health.readiness?.orderConnected === true);
      setAssessmentMode(health.readiness?.applicationMode === 'assessment');
      setConnection(ready ? 'connected' : 'setup');
      setBrandName(health.readiness?.brandName || 'Customer care');
      const hasCatalog = health.readiness?.catalogConfigured === true;
      setCatalogMode(hasCatalog);
      if (hasCatalog) {
        setCatalogError(null);
        try { setCatalog(await checkCatalogConnection()); }
        catch (error) { setCatalog(null); setCatalogError(error instanceof Error ? error.message : 'The catalog is unavailable.'); }
      } else setPolicies(await fetchPolicies().catch(() => null));
    } catch { setAvailable(false); setConnection('error'); }
  }, []);
  useEffect(() => { void connect(); }, [connect]);
  return (
    <div className={`app-shell${assessmentMode ? ' assessment-mode' : ''}`}>
      <header className="site-header">
        <a href="#main" className="brand-lockup"><span className="brand-mark">a.</span><span>{brandName}<span className="brand-subtitle">CUSTOMER CARE</span></span></a>
        <span className={`service-status ${connection}`} role="status"><i />{connection === 'connected' ? 'Ready to help' : connection === 'checking' ? 'Connecting…' : 'Support unavailable'}</span>
      </header>
      <main id="main" className="page-content">
        <section className="welcome-section">
          <div><p className="eyebrow">AURA CUSTOMER EXPERIENCE</p><h1>A little care. <span>A clear answer.</span></h1><p className="welcome-copy">{catalogMode ? 'Discover products, prices and published availability with Aria.' : 'Talk to Aria about your order, delivery or our skincare policies.'}</p></div>
          <a className="policy-shortcut" href={catalogMode ? '#main' : '#store-policies'} onClick={() => { const details = document.getElementById('store-policies'); if (details instanceof HTMLDetailsElement) details.open = true; }}>{catalogMode ? 'Customer support' : 'Explore our policies'} <span aria-hidden="true">↗</span></a>
        </section>
        {(connection === 'setup' || connection === 'error') && <div className="connection-alert" role="alert"><span>{connection === 'setup' ? 'Live support is not available yet. Conversations will open when the AI service is connected.' : 'We couldn’t connect to support. Please try again shortly.'}</span><button onClick={connect}>Check again</button></div>}
        <div className="workspace-grid">
          <section className="conversation-column" aria-label="Customer support">
            <div className="conversation-toolbar"><div className="mode-switch" role="group" aria-label="Choose support mode">
              <button aria-pressed={activeMode === 'voice'} onClick={() => setActiveMode('voice')}>Voice call</button>
              <button aria-pressed={activeMode === 'chat'} disabled={callActive} title={callActive ? 'End your voice call before switching to chat' : 'Type to Aria'} onClick={() => setActiveMode('chat')}>Text chat</button>
            </div><span className="toolbar-note">{callActive ? 'Your call is in progress' : 'Your conversation, your way'}</span></div>
            <div hidden={activeMode !== 'voice'}><VoiceAgent available={available} catalogMode={catalogMode} onSwitchToChat={() => setActiveMode('chat')} onActiveChange={setCallActive} /></div>
            <div hidden={activeMode !== 'chat'}><AriaChat available={available} catalogMode={catalogMode} autoInit={activeMode === 'chat'} /></div>
            <p className="privacy-note">Microphone access is requested when you start a call. Your messages are processed by our AI provider to respond and prepare your conversation summary.</p>
          </section>
          <aside className="reference-column">
            {assessmentMode && <AssessmentOrders />}
            {!assessmentMode && <section className="reference-card"><p className="eyebrow">YOUR CONVERSATION</p><h2>How can we help?</h2>{catalogMode ? <ul className="conversation-ideas"><li>Find a product or category</li><li>Compare listed prices</li><li>Check published availability</li><li>Explore product details and variants</li></ul> : <ul className="conversation-ideas"><li>Returns and replacement policies</li><li>Shipping fees and delivery times</li><li>Cancellation conditions</li><li>Cash on delivery and payments</li></ul>}<p className="reference-copy">Describe what you need. Aria will ask for details when it needs them.</p></section>}
            {catalogMode && <section className="reference-card compact"><p className="eyebrow">CATALOG CONNECTION</p><h2>{catalog ? catalog.businessName : 'Connecting to your catalog'}</h2><p className="reference-copy" role="status">{catalog ? `${catalog.totalProducts} published products · Connected` : catalogError || 'Checking the live product service…'}</p>{catalog && <><p className="reference-copy">Prices and availability are checked against the published catalog when you ask. Availability is not a stock reservation.</p><a href={catalog.catalogUrl} target="_blank" rel="noopener noreferrer" className="text-action text-xs inline-block mt-3">Browse the catalog ↗</a></>}{catalogError && <button onClick={connect} className="text-action text-xs mt-3">Retry connection</button>}</section>}
            {!assessmentMode && <section className="reference-card compact"><h2>Order tracking</h2><p className="reference-copy">{orderConnected ? 'Have your order confirmation handy so Aria can look up your order.' : 'Customer orders are not connected. Aria can help with published products but cannot verify order status or delivery dates.'}</p></section>}
            <section className="reference-card compact call-guide"><p className="eyebrow">A GOOD CONVERSATION STARTS HERE</p><h2>Make yourself comfortable</h2><p className="reference-copy">Allow your microphone and use a quiet space. Wait for Aria to finish, then ask a follow-up. Your transcript and summary will be ready when you end the call.</p></section>
          </aside>
        </div>
        {!catalogMode && <details id="store-policies" className="support-details"><summary>Read our policies<span>Shipping, returns &amp; payments</span></summary><div className="support-details-body"><BrandPolicies policies={policies} isLoading={connection === 'checking'} /></div></details>}
        <footer className="site-footer"><span>{brandName}</span><span>{assessmentMode ? 'Assessment experience · Live AI, supplied sample orders' : 'A little care goes a long way.'}</span></footer>
      </main>
    </div>
  );
}
export default App;
