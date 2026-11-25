import { useEffect, useState } from 'react'
import './App.css'

const api = async (path, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  const token = sessionStorage.getItem('bizbuddyToken')
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`/api${path}`, { ...options, headers })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.detail ?? 'The request could not be completed.')
    error.status = response.status
    throw error
  }
  return body
}

const emptyProfile = { name: '', email: '', phone: '', business: '', role: '', location: '' }
const initials = (name = '') => name.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'U'

const Icon = ({ name, size = 18 }) => {
  const icons = {
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    cone: <><path d="M4 20l8-16 8 16H4Z"/><path d="M8 20l4-8 4 8"/></>,
    bag: <><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 016 0v2"/></>,
    invoice: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></>,
    stock: <><path d="M4 7h16v12H4z"/><path d="M8 7V4h8v3M8 11h8M8 15h5"/></>,
    sync: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.5 8a7 7 0 0111.8-1L20 12M4 12l1.7 5a7 7 0 0011.8-1"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></>,
    price: <><path d="M20 13l-7 7-10-10V3h7l10 10Z"/><circle cx="7.5" cy="7.5" r="1"/></>,
    sparkle: <><path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/></>,
    search: <><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></>,
    bell: <><path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></>,
    dots: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>
}

const sections = {
  'Atelier Dashboard': {
    eyebrow: 'ATELIER OVERVIEW',
    description: 'A live view of your orders and activity.',
    metrics: [],
    listTitle: 'Recent atelier activity',
    rows: [],
    detailTitle: 'Activity',
    details: [],
  },
  'Unified Concierge': {
    eyebrow: 'ATELIER CONCIERGE',
    description: 'Connect your customer conversations when a channel integration is configured.',
    metrics: [],
    listTitle: 'Recent conversations',
    rows: [],
    detailTitle: 'Conversations',
    details: [],
  },
  'Invoices & Reminders': {
    eyebrow: 'ATELIER LEDGER',
    description: 'Invoices and reminders will appear here when added.',
    metrics: [],
    listTitle: 'Recent invoices',
    rows: [],
    detailTitle: 'Invoices',
    details: [],
  },
  'Fabrics & Stock': {
    eyebrow: 'ATELIER VAULT',
    description: 'Your fabric and stock records will appear here when added.',
    metrics: [],
    listTitle: 'Inventory ledger',
    rows: [],
    detailTitle: 'Inventory',
    details: [],
  },
  'Channels & Sync': {
    eyebrow: 'CHANNEL CONTROL',
    description: 'Channel connections will appear here when configured.',
    metrics: [],
    listTitle: 'Connected channels',
    rows: [],
    detailTitle: 'Channels',
    details: [],
  },
  'AI Atelier Tone': {
    eyebrow: 'CONCIERGE STUDIO',
    description: 'Configure assistant preferences when an AI integration is available.',
    metrics: [],
    listTitle: 'Concierge preferences',
    rows: [],
    detailTitle: 'Preferences',
    details: [],
  },
  'Client Profiles': {
    eyebrow: 'CLIENT RELATIONSHIPS',
    description: 'Client profiles will appear here when added.',
    metrics: [],
    listTitle: 'Client directory',
    rows: [],
    detailTitle: 'Client details',
    details: [],
  },
  Pricing: {
    eyebrow: 'ATELIER TIERS',
    description: 'Transparent plans built for Lagos fabric traders and growing ateliers.',
    action: 'Compare plans',
    metrics: [],
    rows: [],
    detailTitle: 'Plan capabilities at a glance',
    details: [],
  },
  'My Profile': {
    eyebrow: 'ACCOUNT SETTINGS',
    description: 'Manage your personal information, atelier details, and workspace preferences.',
    action: 'Save profile',
    metrics: [],
    rows: [],
    detailTitle: 'Your BizBuddy account',
    details: [],
  },
}

const pricingPlans = [
  { name: 'Starter Hustle', audience: 'SOLE TRADERS & TESTING', badge: 'Free Forever', price: 0, note: 'Ideal for solo fabric traders exploring AI responses on WhatsApp.', features: ['100 AI auto-replies / month', '1 channel (WhatsApp chat only)', 'Standard PDF invoice & receipt maker', 'Manual payment reminder prompts'], action: 'Current plan', current: true },
  { name: 'Market Trader', audience: 'ACTIVE SHOPS', badge: 'Steady Growth', price: 8500, note: 'For growing boutiques dealing with daily Instagram DMs and WhatsApp inquiries.', features: ['1,000 AI auto-replies / month', '3 channels (WhatsApp, IG DM, Messenger)', 'Auto overdue payment reminders (Paystack)', 'Stock inventory sync up to 50 items'], action: 'Upgrade to Market Trader' },
  { name: 'Merchant Pro', audience: 'BEST VALUE FOR LAGOS RETAILERS', badge: 'Recommended', price: 18500, note: 'Automatically closes fabric orders, quotes bundle cuts, and confirms bank alerts.', features: ['5,000 AI auto-replies / month', 'All 6 channels (WhatsApp, IG, FB, TG, Email, Web)', 'Smart AI discount thresholds (8%-15% auto-negotiation)', 'Yoruba & Pidgin voice note transcription', 'Unlimited product & fabric catalog quotations', 'Instant Paystack & NIP bank transfer alert matching'], action: 'Choose Merchant Pro', popular: true },
]

function App() {
  const [active, setActive] = useState('Client Orders')
  const [filter, setFilter] = useState('All Orders')
  const [orders, setOrders] = useState([])
  const [selected, setSelected] = useState(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [selectedModuleRow, setSelectedModuleRow] = useState(0)
  const [notice, setNotice] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [loggedIn, setLoggedIn] = useState(() => Boolean(sessionStorage.getItem('bizbuddyToken')))
  const [authMode, setAuthMode] = useState(() => {
    if (window.location.pathname === '/signin') return 'signin'
    if (window.location.pathname === '/register') return 'register'
    return 'landing'
  })
  const [annualPricing, setAnnualPricing] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profile, setProfile] = useState(emptyProfile)
  const [dashboard, setDashboard] = useState({ ordersCount: 0, pendingCount: 0, readyCount: 0, settledCount: 0 })
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedGroup, setExpandedGroup] = useState('Commerce')
  const [mobileCategoryOpen, setMobileCategoryOpen] = useState('')

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname
      setAuthMode(path === '/signin' ? 'signin' : path === '/register' ? 'register' : 'landing')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigateAuth = (page) => {
    const routes = { landing: '/', signin: '/signin', register: '/register' }
    window.history.pushState({}, '', routes[page])
    setAuthMode(page)
    setAuthMessage('')
  }

  useEffect(() => {
    if (!loggedIn) return
    let activeEffect = true
    Promise.all([api('/profile'), api('/orders'), api('/dashboard')])
      .then(([account, orderList, stats]) => {
        if (!activeEffect) return
        setProfile(account)
        setOrders(orderList)
        setSelected(orderList[0] ?? null)
        setDashboard(stats)
      })
      .catch(error => {
        if (!activeEffect) return
        if (error.status === 401) {
          sessionStorage.removeItem('bizbuddyToken')
          setLoggedIn(false)
          setAuthMode('signin')
          window.history.replaceState({}, '', '/signin')
        }
        setNotice(error.message)
      })
    return () => { activeEffect = false }
  }, [loggedIn])

  const navGroups = [
    { name: 'Overview', icon: 'cone', pages: [['cone', 'Atelier Dashboard']] },
    { name: 'Commerce', icon: 'bag', pages: [['bag', 'Unified Concierge'], ['invoice', 'Client Orders'], ['user', 'Client Profiles']] },
    { name: 'Operations', icon: 'stock', pages: [['invoice', 'Invoices & Reminders'], ['stock', 'Fabrics & Stock'], ['sync', 'Channels & Sync']] },
    { name: 'Workspace', icon: 'sparkle', pages: [['sparkle', 'AI Atelier Tone'], ['price', 'Pricing'], ['user', 'My Profile']] },
  ]
  const visibleOrders = orders.filter(order => {
    const matchesFilter = filter === 'All Orders' ||
      (filter === 'Payment Pending' && order.statusClass === 'pending') ||
      (filter === 'Ready for Dispatch' && ['confirmed', 'in transit', 'ready for dispatch'].includes(order.status.toLowerCase())) ||
      (filter === 'In Transit' && order.status.toLowerCase() === 'in transit') ||
      (filter === 'Delivered / Settled' && ['settled', 'delivered'].includes(order.status.toLowerCase()))
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || [order.id, order.name, order.channel, order.cuts, order.material]
      .some(value => value.toLowerCase().includes(query))
    return matchesFilter && matchesSearch
  })
  const section = sections[active]

  const navigate = (page) => {
    setActive(page)
    setExpandedGroup('')
    setFilter('All Orders')
    setSelectedModuleRow(0)
    setNotice('')
    setShowMenu(false)
    setShowOrderForm(false)
    setProfileSaved(false)
    setMobileCategoryOpen('')
  }

  const updateProfile = async (event) => {
    event.preventDefault()
    try {
      const updatedProfile = Object.fromEntries(new FormData(event.currentTarget).entries())
      const result = await api('/profile', { method: 'PUT', body: JSON.stringify(updatedProfile) })
      setProfile(result)
      setProfileSaved(true)
      setNotice('Your profile changes have been saved.')
    } catch (error) {
      setNotice(error.message)
    }
  }

  const authenticate = async (event) => {
    event.preventDefault()
    setAuthMessage('')
    const values = new FormData(event.currentTarget)
    const isRegistering = authMode === 'register'
    const request = isRegistering
      ? {
          name: values.get('name'),
          business: values.get('business'),
          category: values.get('category'),
          email: values.get('email'),
          password: values.get('password'),
        }
      : { email: values.get('email'), password: values.get('password') }
    try {
      const result = await api(isRegistering ? '/auth/register' : '/auth/signin', {
        method: 'POST',
        body: JSON.stringify(request),
      })
      sessionStorage.setItem('bizbuddyToken', result.token)
      setProfile(result.user)
      setChatMessages([])
      setLoggedIn(true)
      setActive('Atelier Dashboard')
      setAuthMode('dashboard')
      window.history.pushState({}, '', '/dashboard')
      setAuthMessage('')
    } catch (error) {
      setAuthMessage(error.message)
    }
  }

  const logout = async () => {
    try {
      await api('/auth/signout', { method: 'POST' })
    } catch (error) {
      setNotice(error.message)
    } finally {
      sessionStorage.removeItem('bizbuddyToken')
      setLoggedIn(false)
      setProfile(emptyProfile)
      setOrders([])
      setSelected(null)
      setChatMessages([])
      navigateAuth('signin')
    }
  }

  const sendChatMessage = async (event) => {
    event.preventDefault()
    const content = chatInput.trim()
    if (!content || chatLoading) return

    const messages = [...chatMessages, { role: 'user', content }]
    setChatMessages(messages)
    setChatInput('')
    setChatLoading(true)
    try {
      const result = await api('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: messages.slice(-20) }),
      })
      setChatMessages(current => [...current, { role: 'assistant', content: result.reply }])
    } catch (error) {
      setNotice(error.message)
    } finally {
      setChatLoading(false)
    }
  }

  const createOrder = async (event) => {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const orderInput = Object.fromEntries(values.entries())
    try {
      const order = await api('/orders', { method: 'POST', body: JSON.stringify(orderInput) })
      setOrders(current => [order, ...current])
      setSelected(order)
      setShowOrderForm(false)
      setNotice('Order created.')
      const stats = await api('/dashboard')
      setDashboard(stats)
    } catch (error) {
      setNotice(error.message)
    }
  }

  const updateOrderStatus = async (status) => {
    if (!selected) return
    try {
      const updated = await api(`/orders/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setOrders(current => current.map(order => order.id === updated.id ? updated : order))
      setSelected(updated)
      setDashboard(await api('/dashboard'))
    } catch (error) {
      setNotice(error.message)
    }
  }

  const exportOrders = () => {
    const fields = ['id', 'name', 'channel', 'cuts', 'material', 'yards', 'amount', 'status']
    const csv = [fields.join(','), ...orders.map(order =>
      fields.map(field => `"${String(order[field] ?? '').replaceAll('"', '""')}"`).join(',')
    )].join('\r\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = 'bizbuddy-orders.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  if (!loggedIn) {
    if (authMode === 'landing') {
      return (
        <div className="landing-site">
          <section className="landing-hero">
            <header className="public-header">
              <a className="public-brand" href="/" onClick={event => { event.preventDefault(); navigateAuth('landing') }}>
                <img className="public-logo" src="/bizbuddy-logo.png" alt="BizBuddy — Every chat. One inbox. Done for you." />
              </a>
              <nav aria-label="Main navigation">
                <a href="#features">Platform</a><a href="#how-it-works">How it works</a><a href="#about">About</a>
              </nav>
              <div className="public-header-actions">
                <button className="public-signin" onClick={() => navigateAuth('signin')}>Sign in</button>
                <button className="public-start" onClick={() => navigateAuth('register')}>Get started <span>↗</span></button>
              </div>
            </header>

            <main className="landing-hero-main">
              <div className="landing-copy">
                <p className="landing-eyebrow"><span /> THE BUSINESS OS FOR INDEPENDENT RETAILERS</p>
                <h1>Make room for<br /><em>better business.</em></h1>
                <p className="landing-description">Keep orders moving, care for your customers, and let your AI concierge take busywork off your hands.</p>
                <div className="landing-hero-actions">
                  <button className="hero-primary" onClick={() => navigateAuth('register')}>Get started for free <span>↗</span></button>
                  <a className="hero-secondary" href="#features">Explore the platform <span>↓</span></a>
                </div>
              </div>

              <div className="hero-showcase" aria-label="BizBuddy platform features">
                <article className="showcase-card showcase-orders">
                  <div className="showcase-card-heading"><span className="showcase-icon">↗</span><span>ORDER FLOW</span></div>
                  <div className="order-flow"><span>New</span><i /><span>Confirmed</span><i /><span>Complete</span></div>
                  <small>Keep every order moving forward.</small>
                </article>
                <article className="showcase-card showcase-concierge">
                  <div className="showcase-card-heading"><span className="showcase-icon sparkle">✳</span><span>AI CONCIERGE</span></div>
                  <p>Thoughtful customer replies, right when you need them.</p>
                  <span className="showcase-link">A little more time for you <b>↗</b></span>
                </article>
                <article className="showcase-card showcase-workspace">
                  <span className="workspace-label">YOUR WORKSPACE</span>
                  <strong>Everything in<br />its right place.</strong>
                  <div className="workspace-pills"><span>Orders</span><span>Profiles</span><span>AI</span></div>
                </article>
              </div>
              <div className="landing-hero-footer"><span>Thoughtful tools for the way you work.</span><a href="#features">SCROLL TO EXPLORE ↓</a></div>
            </main>
          </section>

          <div className="landing-trust-strip" aria-label="BizBuddy tools">
            <span>One workspace for</span><b>ORDERS</b><i /><b>CLIENTS</b><i /><b>AI CONCIERGE</b><i /><b>YOUR BUSINESS</b>
          </div>

          <section className="landing-features" id="features">
            <div className="landing-section-heading" id="about">
              <p className="section-eyebrow">A CALMER WAY TO RUN YOUR BUSINESS</p>
              <h2>Less juggling.<br /><span>More of what matters.</span></h2>
              <p>BizBuddy brings the everyday work of your business into one clear, connected workspace.</p>
            </div>
            <div className="landing-feature-cards" id="how-it-works">
              <article className="landing-feature-card feature-orders">
                <span className="feature-number">01 / ORDERS</span>
                <div className="feature-visual order-visual"><span>Order received</span><i>→</i><b>Keep it moving</b></div>
                <h3>Stay on top of every order.</h3>
                <p>Create orders, update their status, and see what needs your attention.</p>
              </article>
              <article className="landing-feature-card feature-profiles">
                <span className="feature-number">02 / WORKSPACE</span>
                <div className="feature-visual profile-visual"><img className="profile-dot" src="/bizbuddy-icon.png" alt="" /><span>Your details, your business,<br />all in one place.</span></div>
                <h3>Your business, your way.</h3>
                <p>Keep your account and business details connected to your workspace.</p>
              </article>
              <article className="landing-feature-card feature-ai">
                <span className="feature-number">03 / AI CONCIERGE</span>
                <div className="feature-visual ai-visual"><span>✳</span><b>A helpful hand, on demand.</b></div>
                <h3>Meet your AI concierge.</h3>
                <p>Get help drafting customer replies and handling everyday questions.</p>
              </article>
            </div>
          </section>

          <footer className="landing-footer"><a className="public-brand" href="/" onClick={event => { event.preventDefault(); navigateAuth('landing') }}><img className="public-logo" src="/bizbuddy-logo.png" alt="BizBuddy — Every chat. One inbox. Done for you." /></a><button onClick={() => navigateAuth('signin')}>Sign in <span>↗</span></button></footer>
        </div>
      )
    }

    return (
      <div className="auth-page">
        <header className="auth-page-header">
          <a className="public-brand" href="/" onClick={event => { event.preventDefault(); navigateAuth('landing') }}>
            <img className="public-logo" src="/bizbuddy-logo.png" alt="BizBuddy — Every chat. One inbox. Done for you." />
          </a>
          <button onClick={() => navigateAuth('landing')}>← Back to home</button>
        </header>
        <main className="auth-page-main">
          <div className="auth-page-message">
            <p className="landing-eyebrow">YOUR BUSINESS, IN BETTER ORDER</p>
            <h1>{authMode === 'signin' ? <>Welcome<br /><em>back.</em></> : <>Start with a<br /><em>clearer day.</em></>}</h1>
            <p>{authMode === 'signin' ? 'Sign in to pick up right where you left off.' : 'Create your BizBuddy account and set up your workspace.'}</p>
          </div>
          <section className="auth-card">
            <div className="auth-brand"><img className="auth-logo-icon" src="/bizbuddy-icon.png" alt="" /><div><strong>{authMode === 'signin' ? 'Welcome back' : 'Create your account'}</strong><small>{authMode === 'signin' ? 'SIGN IN TO YOUR WORKSPACE' : 'GET YOUR WORKSPACE STARTED'}</small></div></div>
            <form onSubmit={authenticate}>
              {authMode === 'register' && <>
                <label>Full name<input name="name" required autoComplete="name" /></label>
                <label>Business name<input name="business" required autoComplete="organization" /></label>
              </>}
              <label>Email address<input name="email" type="email" required autoComplete="username" /></label>
              {authMode === 'register' && <label>Business category<select name="category" required defaultValue=""><option value="" disabled>Select a category</option><option>Fashion & textiles</option><option>Retail & boutique</option><option>Other</option></select></label>}
              <label>Password<input name="password" required autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} type="password" minLength={authMode === 'register' ? 8 : undefined} /></label>
              <button className="auth-submit" type="submit">{authMode === 'signin' ? 'Sign in' : 'Create account'} <span>→</span></button>
            </form>
            {authMessage && <p className="auth-error" role="alert">{authMessage}</p>}
            <p className="auth-switch">{authMode === 'signin' ? 'New to BizBuddy?' : 'Already have an account?'} <button onClick={() => navigateAuth(authMode === 'signin' ? 'register' : 'signin')}>{authMode === 'signin' ? 'Create an account' : 'Sign in'}</button></p>
            <p className="auth-footnote">Your workspace is private to your account.</p>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="biz-app">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src="/bizbuddy-logo.png" alt="BizBuddy — Every chat. One inbox. Done for you." />
        </div>
        <div className="trade"><span>{profile.business || 'WORKSPACE'}</span><i /></div>
        <nav className="nav" aria-label="Workspace navigation">
          {navGroups.map(group => <section className="nav-group" key={group.name}>
            <button className={`nav-group-heading ${expandedGroup === group.name ? 'expanded' : ''}`} aria-expanded={expandedGroup === group.name} onClick={() => setExpandedGroup(expandedGroup === group.name ? '' : group.name)}>
              <span>{group.name}</span><span className="nav-chevron">{expandedGroup === group.name ? '−' : '+'}</span>
            </button>
            {expandedGroup === group.name && <div className="nav-group-pages">{group.pages.map(([icon, label]) => (
              <button key={label} className={active === label ? 'active' : ''} aria-current={active === label ? 'page' : undefined} onClick={() => navigate(label)}>
                <Icon name={icon} size={16}/><span>{label}</span>
              </button>
            ))}</div>}
          </section>)}
        </nav>
        {active === 'Client Orders' && <div className="search orders-search"><Icon name="search" size={16}/><input aria-label="Search orders" placeholder="Search your orders…" value={search} onChange={event => setSearch(event.target.value)} /></div>}
        <button className="profile" onClick={() => navigate('My Profile')} aria-label="Open my profile">
          <span className="profile-badge">{initials(profile.name)}</span>
          <span><strong>{profile.name}</strong><small>{profile.role}</small></span>
          <span>•••</span>
        </button>
        <button className="logout-button" onClick={logout}>↪ <span>Log out</span></button>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <img className="breadcrumb-logo" src="/bizbuddy-logo.png" alt="BizBuddy" />
          </div>
          <div className="top-actions">
            <button className="quick" onClick={() => setShowMenu(!showMenu)}>+ Quick Actions</button>
            <button className="top-avatar" onClick={() => navigate('My Profile')} aria-label="Open my profile">{initials(profile.name)}</button>
          </div>
        </header>

        {showMenu && <div className="quick-menu"><button onClick={() => { navigate('Client Orders'); setShowOrderForm(true) }}>+ New Order</button></div>}

        <section className="workspace">
          <div className="title-row">
            <div>
              <p>{section?.eyebrow ?? 'ATELIER COMMERCE'} <span>›</span> {profile.business || 'WORKSPACE'}</p>
              <h1>{active}</h1>
              <span className="subtitle">{section?.description ?? 'Manage bespoke textile commissions, verify NIP settlements, and orchestrate an atelier-to-door delivery.'}</span>
            </div>
            <div className="title-actions">
              {active === 'Client Orders' && <>
                <button className="export" onClick={exportOrders}>⇧ Export CSV</button>
                <button className="new-order" onClick={() => setShowOrderForm(open => !open)}>+ New Order</button>
              </>}
            </div>
          </div>

          {notice && <div className="page-notice" role="status">{notice}<button onClick={() => setNotice('')}>Dismiss</button></div>}

          {active === 'Client Orders' ? <div className="metrics">
            <article><div className="metric-top"><span>Your orders</span><span>▤</span></div><strong>{dashboard.ordersCount}</strong><p>In this workspace</p></article>
            <article><div className="metric-top"><span>Pending</span><i /></div><strong>{dashboard.pendingCount}</strong><p>Awaiting an update</p></article>
            <article><div className="metric-top"><span>In progress</span><Icon name="bag" size={15}/></div><strong>{dashboard.readyCount}</strong><p>Confirmed or dispatching</p></article>
            <article><div className="metric-top"><span>Settled</span><span>✓</span></div><strong>{dashboard.settledCount}</strong><p>Completed orders</p></article>
          </div> : active === 'Pricing' ? null : <div className="metrics">
            {section.metrics.map(([label, value, note]) => <article key={label}><div className="metric-top"><span>{label}</span><Icon name={active === 'Fabrics & Stock' ? 'stock' : 'sparkle'} size={15}/></div><strong>{value}</strong><p>{note}</p></article>)}
          </div>}

          {active === 'Client Orders' ? <>
          {showOrderForm && <form className="new-order-form" onSubmit={createOrder}>
            <label>Client name<input name="name" required maxLength="255" /></label>
            <label>Channel<select name="channel" defaultValue="Walk-in"><option>Walk-in</option><option>WhatsApp</option><option>Instagram</option><option>Other</option></select></label>
            <label>Fabric or item<input name="cuts" required maxLength="255" /></label>
            <label>Material<input name="material" required maxLength="255" /></label>
            <label>Quantity<input name="yards" required maxLength="64" /></label>
            <label>Amount<input name="amount" required maxLength="64" /></label>
            <label>Client type<input name="vip" defaultValue="Customer" maxLength="128" /></label>
            <div className="new-order-actions"><button type="button" onClick={() => setShowOrderForm(false)}>Cancel</button><button type="submit">Create order</button></div>
          </form>}
          <div className="filters">
            {['All Orders','Payment Pending','Ready for Dispatch','In Transit','Delivered / Settled'].map(name =>
              <button key={name} className={filter === name ? 'active' : ''} onClick={() => setFilter(name)}>{name}</button>
            )}
          </div>

          <div className="orders-layout">
            <div className="order-table">
              <div className="table-head"><span>Order / origin</span><span>Client profile</span><span>Fabric & cut</span><span>Amount</span></div>
              {visibleOrders.length === 0 && <p className="empty-state">{search || filter !== 'All Orders' ? 'No orders match your search or filter.' : 'No orders yet. Create an order to get started.'}</p>}
              {visibleOrders.map(order => (
                <button className={`order-row ${selected?.id === order.id ? 'selected' : ''}`} key={order.id} onClick={() => setSelected(order)}>
                  <span className="order-origin"><strong>{order.id}</strong><small>{order.channel}</small></span>
                  <span className="client"><b>{initials(order.name)}</b><span><strong>{order.name}</strong><small>{order.vip}</small></span></span>
                  <span className="fabric"><strong>{order.cuts}</strong><small>{order.material} · {order.yards}</small></span>
                  <span className="amount"><strong>{order.amount}</strong><small className={order.statusClass}>{order.status}</small></span>
                </button>
              ))}
              {visibleOrders.length > 0 && <div className="pagination"><span>Showing {visibleOrders.length} order{visibleOrders.length === 1 ? '' : 's'}</span></div>}
            </div>

            {selected && <aside className="details">
              <div className="details-head"><div><strong>{selected.id}</strong><span>{selected.status.toUpperCase()}</span></div></div>
              <div className="customer"><b>{initials(selected.name)}</b><div><strong>{selected.name}</strong><small>{selected.vip}</small></div><span>{selected.channel}</span></div>
              <div className="detail-section"><label>Fabric & cut</label><strong>{selected.cuts}</strong><div className="cut-grid"><span>{selected.material}</span><span>{selected.yards}</span></div></div>
              <div className="detail-section"><label>Amount</label><strong>{selected.amount}</strong></div>
              <div className="detail-section"><label>Created</label><strong>{selected.time}</strong></div>
              <label className="order-status">Update status<select value={selected.status} onChange={event => updateOrderStatus(event.target.value)}><option>Pending</option><option>Confirmed</option><option>In Transit</option><option>Delivered</option><option>Settled</option></select></label>
            </aside>}
          </div>
          </> : active === 'Unified Concierge' ? <section className="chat-page">
            <div className="chat-heading"><p>{section.eyebrow}</p><h2>Atelier concierge</h2><span>Ask for help drafting a reply or managing your atelier. The assistant uses your workspace name and recent order details without sharing client names or payment amounts.</span></div>
            <div className="chat-panel" aria-live="polite">
              {chatMessages.length === 0 && <p className="chat-empty">Start a conversation. For example: “Help me write a warm reply to a customer asking about fabric availability.”</p>}
              {chatMessages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${index}-${message.role}`}><span>{message.role === 'user' ? 'You' : 'BizBuddy'}</span><p>{message.content}</p></div>)}
              {chatLoading && <div className="chat-message assistant"><span>BizBuddy</span><p>Thinking…</p></div>}
            </div>
            <form className="chat-form" onSubmit={sendChatMessage}>
              <textarea aria-label="Message the AI concierge" value={chatInput} onChange={event => setChatInput(event.target.value)} placeholder="Write your message…" maxLength={2000} rows={3} />
              <button type="submit" disabled={chatLoading || !chatInput.trim()}>{chatLoading ? 'Sending…' : 'Send message'}</button>
            </form>
          </section> : active === 'My Profile' ? <section className="profile-page">
            <div className="profile-page-heading">
              <div><p>{section.eyebrow}</p><h2>Personal information</h2><span>Update how you and your atelier appear across BizBuddy.</span></div>
              <div className="profile-avatar-large">{initials(profile.name)}</div>
            </div>
            <form className="profile-form" onSubmit={updateProfile}>
              <div className="profile-fields">
                <label>Full name<input name="name" value={profile.name} onChange={event => setProfile({ ...profile, name: event.target.value })} required /></label>
                <label>Role or job title<input name="role" value={profile.role} onChange={event => setProfile({ ...profile, role: event.target.value })} /></label>
                <label>Email address<input name="email" type="email" value={profile.email} onChange={event => setProfile({ ...profile, email: event.target.value })} required /></label>
                <label>Phone number<input name="phone" type="tel" value={profile.phone} onChange={event => setProfile({ ...profile, phone: event.target.value })} /></label>
                <label>Business name<input name="business" value={profile.business} onChange={event => setProfile({ ...profile, business: event.target.value })} required /></label>
                <label>Business location<input name="location" value={profile.location} onChange={event => setProfile({ ...profile, location: event.target.value })} /></label>
              </div>
              <div className="profile-save-row">
                <span>{profileSaved ? 'Saved just now' : 'Your information is only visible to your workspace.'}</span>
                <button type="submit">Save changes</button>
              </div>
            </form>
          </section> : active === 'Pricing' ? <section className="pricing-page">
            <div className="pricing-heading">
              <div><p>{section.eyebrow}</p><h2>Plans</h2><span>Simple, transparent billing for your atelier.</span></div>
              <div className="pricing-tools">
                <div className="pricing-help"><span>Choose a plan that’s right for you.</span><small>Pause or cancel anytime.</small></div>
                <div className="pricing-switch" role="group" aria-label="Billing period">
                  <button className={!annualPricing ? 'active' : ''} onClick={() => setAnnualPricing(false)}>Pay monthly</button>
                  <button className={annualPricing ? 'active' : ''} onClick={() => setAnnualPricing(true)}>Pay annually <small>Save 15%</small></button>
                </div>
              </div>
            </div>
            <div className="plan-grid">
              {pricingPlans.map(plan => {
                const price = annualPricing && plan.price > 0 ? Math.round(plan.price * 0.85) : plan.price
                return <article className={`plan-card ${plan.popular ? 'recommended' : ''}`} key={plan.name}>
                  <div className="plan-meta"><span>{plan.audience}</span><b>{plan.badge}</b></div>
                  <h3>{plan.name}</h3>
                  <p className="plan-description">{plan.note}</p>
                  <div className="plan-price"><strong>{price === 0 ? '₦0' : `₦${price.toLocaleString('en-NG')}`}</strong><span>/ month</span></div>
                  {annualPricing && plan.price > 0 && <p className="annual-caption">Billed annually · save 15%</p>}
                  <ul>{plan.features.map(feature => <li key={feature}><span>✓</span>{feature}</li>)}</ul>
                  <button className={plan.current ? 'current-plan-button' : ''} onClick={() => setNotice(plan.current ? 'Starter Hustle is your current plan.' : `${plan.name} selected. Plan setup is ready to continue.`)}>{plan.action}{plan.popular ? ' ⚡' : ''}</button>
                </article>
              })}
            </div>
            <section className="ledger-addon enterprise-plan">
              <div><strong>Wholesale Empire</strong><p>Designed for large-scale fabric importers, multiple branches, and wholesale dispatchers.</p><div className="ledger-features"><span>✓ Unlimited AI & priority triage</span><span>✓ Up to 5 staff</span><span>✓ Dedicated Nigerian account & WhatsApp manager</span><span>✓ Aso-Ebi bundle & yardage calculator</span><span>✓ ERP & bespoke bank API integrations</span></div></div>
              <div className="ledger-price"><strong>{annualPricing ? '₦38,250' : '₦45,000'}</strong><span>/ month</span><button onClick={() => setNotice('Wholesale Empire setup request is ready.')}>Contact for Empire Setup</button></div>
            </section>
            <p className="payment-rails">🔒 Instant &amp; secure local billing · Paystack · Flutterwave · USSD · Bank transfer · Debit cards</p>
          </section> : <section className="module-layout">
            <div className="module-list">
              <div className="module-list-head"><div><p>{section.eyebrow}</p><h2>{section.listTitle}</h2></div><span>{section.rows.length} items</span></div>
              <div className="module-table-head"><span>REFERENCE</span><span>DETAILS</span><span>STATUS</span></div>
              {section.rows.map((row, index) => <button key={`${row[0]}-${row[1]}`} className={`module-row ${selectedModuleRow === index ? 'selected' : ''}`} onClick={() => setSelectedModuleRow(index)}>
                <span><strong>{row[0]}</strong><small>{row[1]}</small></span><span><strong>{row[2]}</strong></span><span className="module-status">{row[3]}</span>
              </button>)}
              {section.rows.length === 0 && <p className="empty-state">No records yet.</p>}
            </div>
            <aside className="module-detail">
              <p className="module-detail-label">{active.toUpperCase()}</p>
              <h2>{section.detailTitle}</h2>
              <p className="empty-state">This section has no connected records yet.</p>
            </aside>
          </section>}
        </section>
      </main>
      <nav className="mobile-nav" aria-label="Workspace categories">
        <button className={active === 'Atelier Dashboard' ? 'active' : ''} onClick={() => navigate('Atelier Dashboard')}><Icon name="cone" size={17}/><span>Overview</span></button>
        {navGroups.slice(1).map(group => <button key={group.name} className={group.pages.some(([, label]) => label === active) ? 'active' : ''} aria-expanded={mobileCategoryOpen === group.name} onClick={() => setMobileCategoryOpen(mobileCategoryOpen === group.name ? '' : group.name)}><Icon name={group.icon} size={17}/><span>{group.name}</span></button>)}
        <button onClick={() => { setMobileCategoryOpen(''); logout() }}><Icon name="user" size={17}/><span>Log out</span></button>
      </nav>
      {mobileCategoryOpen && <div className="mobile-category-menu">
        <div><strong>{mobileCategoryOpen}</strong><button onClick={() => setMobileCategoryOpen('')}>×</button></div>
        {navGroups.find(group => group.name === mobileCategoryOpen)?.pages.map(([icon, label]) => <button key={label} className={active === label ? 'active' : ''} onClick={() => navigate(label)}><Icon name={icon} size={16}/>{label}</button>)}
      </div>}
    </div>
  )
}

export default App
