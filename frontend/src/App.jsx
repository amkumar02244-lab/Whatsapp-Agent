import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  // ---- STATE ----
  const [provider, setProvider] = useState(localStorage.getItem('flowdesk_api_provider') || 'openrouter');
  const [openRouterKey, setOpenRouterKey] = useState(localStorage.getItem('flowdesk_openrouter_key') || localStorage.getItem('flowdesk_api_key') || '');
  const [grokKey, setGrokKey] = useState(localStorage.getItem('flowdesk_grok_key') || '');
  const [groqKey, setGroqKey] = useState(localStorage.getItem('flowdesk_groq_key') || '');
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' | 'chat' (sandbox)
  const [activeTab, setActiveTab] = useState('models'); // 'models' | 'clients' | 'recommend'
  
  // Models list, initialized with Groq and Grok
  const [allModels, setAllModels] = useState([
    {
      id: 'groq',
      name: 'Groq (Llama-3.3)',
      description: 'Ultra-fast inference using Llama 3.3 70B model.',
      context: 131072,
      score: 95,
    },
    {
      id: 'grok',
      name: 'Grok-2 (xAI)',
      description: 'Direct Grok-2 API integration for sweet, intelligent chats.',
      context: 131072,
      score: 90,
    }
  ]);
  const [filteredModels, setFilteredModels] = useState([
    {
      id: 'groq',
      name: 'Groq (Llama-3.3)',
      description: 'Ultra-fast inference using Llama 3.3 70B model.',
      context: 131072,
      score: 95,
    },
    {
      id: 'grok',
      name: 'Grok-2 (xAI)',
      description: 'Direct Grok-2 API integration for sweet, intelligent chats.',
      context: 131072,
      score: 90,
    }
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [selectedModel, setSelectedModel] = useState({
    id: 'groq',
    name: 'Groq (Llama-3.3)',
    description: 'Ultra-fast inference using Llama 3.3 70B model.',
    context: 131072,
    score: 95,
  });

  // Brands/Clients from Backend
  const [brands, setBrands] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  
  // New Brand Form State
  const [brandForm, setBrandForm] = useState({
    name: '',
    category: '',
    orders: '',
    status: 'warm',
    language: 'hinglish',
    notes: '',
  });

  // Assign Model Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningBrandId, setAssigningBrandId] = useState(null);
  const [pendingAssignModel, setPendingAssignModel] = useState(null);

  // Smart Recommender State
  const [recInputs, setRecInputs] = useState({
    status: 'hot',
    lang: 'hinglish',
    category: 'fashion',
  });
  const [recommendationResult, setRecommendationResult] = useState(null);

  // --- SANDBOX CHAT STATE ---
  const [activeChatBrandId, setActiveChatBrandId] = useState('demo');
  const [chatConversations, setChatConversations] = useState({});
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const chatBottomRef = useRef(null);

  // ---- EFFECTS ----
  useEffect(() => {
    fetchBrands();
    loadModels(openRouterKey || localStorage.getItem('flowdesk_api_key') || '');
  }, []);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatConversations, activeChatBrandId, isTyping]);

  // ---- BACKEND API CALLS ----
  const fetchBrands = async () => {
    setLoadingBrands(true);
    try {
      const res = await fetch('/api/brands');
      const data = await res.json();
      if (data.success) {
        setBrands(data.brands);
        if (data.brands.length > 0 && !activeChatBrandId) {
          setActiveChatBrandId(data.brands[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching brands:', err);
    } finally {
      setLoadingBrands(false);
    }
  };

  const addBrand = async (e) => {
    e.preventDefault();
    if (!brandForm.name) return;

    const brandId = brandForm.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const autoModel = getAutoRecommendedModel(brandForm.status);

    const payload = {
      id: brandId,
      name: brandForm.name,
      category: brandForm.category || 'general',
      orders: brandForm.orders || '?',
      status: brandForm.status,
      language: brandForm.language,
      notes: brandForm.notes,
      model: autoModel,
      modelName: allModels.find(m => m.id === autoModel)?.name || autoModel,
      greeting: `Hii! 💕 Welcome to ${brandForm.name} D2C Support. Main Priya baat kar rahi hoon. Kaise help kar sakti hoon aapki? 😊\n\n1️⃣ Order status check karein 📦\n2️⃣ Returns and Refunds policy 🔄\n3️⃣ Product features and details 👗\n4️⃣ Human support agent se baat karein 👩‍💼`,
      escalationMessage: `Aapki request log kar di gayi hai. ${brandForm.name} support agent aapse 2 minutes mein connect karega. 🙏`,
    };

    try {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        fetchBrands();
        setBrandForm({
          name: '',
          category: '',
          orders: '',
          status: 'warm',
          language: 'hinglish',
          notes: '',
        });
      }
    } catch (err) {
      console.error('Error creating brand:', err);
    }
  };

  const deleteBrand = async (id) => {
    if (id === 'demo') {
      alert('Cannot delete default demo brand.');
      return;
    }
    if (!confirm('Are you sure you want to remove this client?')) return;

    try {
      const res = await fetch(`/api/brands/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchBrands();
        if (activeChatBrandId === id) {
          setActiveChatBrandId('demo');
        }
      }
    } catch (err) {
      console.error('Error deleting brand:', err);
    }
  };

  const updateBrandModel = async (brandId, modelId, modelName) => {
    const brand = brands.find(b => b.id === brandId);
    if (!brand) return;

    const payload = {
      ...brand,
      model: modelId,
      modelName: modelName
    };

    try {
      const res = await fetch(`/api/brands/${brandId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        fetchBrands();
      }
    } catch (err) {
      console.error('Error updating model:', err);
    }
  };

  // ---- FETCH MODELS FROM BACKEND ----
  const loadModels = async (keyToUse = '') => {
    setLoadingModels(true);
    try {
      const headers = {};
      if (keyToUse) {
        headers['x-openrouter-api-key'] = keyToUse;
      }
      const res = await fetch('/api/models', { headers });
      const data = await res.json();
      
      const standard = [
        {
          id: 'groq',
          name: 'Groq (Llama-3.3)',
          description: 'Ultra-fast inference using Llama 3.3 70B model.',
          context: 131072,
          score: 95,
        },
        {
          id: 'grok',
          name: 'Grok-2 (xAI)',
          description: 'Direct Grok-2 API integration for sweet, intelligent chats.',
          context: 131072,
          score: 90,
        }
      ];

      if (data.success && data.models) {
        const free = data.models.map(m => ({
          id: m.id,
          name: m.name || m.id,
          description: m.description || '',
          context: m.context_length || 0,
          created: m.created,
          score: scoreModel(m),
        })).sort((a, b) => b.score - a.score);

        const combined = [...standard, ...free];
        setAllModels(combined);
        setFilteredModels(combined);
        if (combined.length > 0) {
          setSelectedModel(combined[0]);
        }
        if (keyToUse) {
          localStorage.setItem('flowdesk_api_key', keyToUse);
        }
      } else {
        setAllModels(standard);
        setFilteredModels(standard);
        setSelectedModel(standard[0]);
      }
    } catch (err) {
      console.error('Error loading models:', err);
      const standard = [
        {
          id: 'groq',
          name: 'Groq (Llama-3.3)',
          description: 'Ultra-fast inference using Llama 3.3 70B model.',
          context: 131072,
          score: 95,
        },
        {
          id: 'grok',
          name: 'Grok-2 (xAI)',
          description: 'Direct Grok-2 API integration for sweet, intelligent chats.',
          context: 131072,
          score: 90,
        }
      ];
      setAllModels(standard);
      setFilteredModels(standard);
      setSelectedModel(standard[0]);
    } finally {
      setLoadingModels(false);
    }
  };

  const scoreModel = (m) => {
    const id = (m.id || '').toLowerCase();
    const desc = (m.description || '').toLowerCase();
    let score = 50;

    if (id.includes('gemma-4')) score += 40;
    else if (id.includes('gemma-3')) score += 30;
    else if (id.includes('llama-3.3') || id.includes('llama-3.1')) score += 35;
    else if (id.includes('qwen')) score += 32;
    else if (id.includes('deepseek')) score += 25;
    else if (id.includes('mistral') && id.includes('7b')) score += 20;

    if (desc.includes('140') || desc.includes('multilingual') || desc.includes('hindi')) score += 15;
    if (desc.includes('hinglish') || desc.includes('indic')) score += 25;

    const ctx = m.context_length || 0;
    if (ctx >= 100000) score += 10;

    if (id.includes('rerank') || id.includes('embed') || id.includes('vision-only')) score -= 60;

    return Math.max(0, score);
  };

  const getAutoRecommendedModel = (status) => {
    if (!allModels.length) return 'google/gemma-4-31b-it:free';
    const sorted = [...allModels].sort((a, b) => b.score - a.score);
    if (status === 'hot') return sorted[0]?.id || 'google/gemma-4-31b-it:free';
    if (status === 'warm') return sorted[1]?.id || sorted[0]?.id || 'google/gemma-4-31b-it:free';
    return sorted[sorted.length - 1]?.id || sorted[0]?.id || 'google/gemma-4-31b-it:free';
  };

  const filterModels = (query) => {
    setSearchQuery(query);
    const filtered = allModels.filter(m =>
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.id.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredModels(filtered);
  };

  // ---- SMART RECOMMENDATIONS ----
  const getRecommendation = () => {
    if (!allModels.length) return;
    const { status, lang } = recInputs;
    
    let scored = allModels.map(m => {
      let s = m.score;
      if (lang === 'hinglish' || lang === 'regional') s += 20;
      if (lang === 'english') s -= 10;
      if (status === 'cold') s = 100 - s;
      return { ...m, finalScore: s };
    }).sort((a, b) => b.finalScore - a.finalScore);

    setRecommendationResult({
      top: scored[0],
      fallback: scored[1],
      status,
      lang
    });
  };

  // ---- ASSIGN MODAL CONTROLS ----
  const openAssignModal = (brandId) => {
    setAssigningBrandId(brandId);
    const brand = brands.find(b => b.id === brandId);
    setPendingAssignModel(brand?.model || null);
    setIsAssignModalOpen(true);
  };

  const confirmAssign = () => {
    const modelObj = allModels.find(m => m.id === pendingAssignModel);
    if (modelObj && assigningBrandId) {
      updateBrandModel(assigningBrandId, modelObj.id, modelObj.name);
    }
    setIsAssignModalOpen(false);
  };

  const handleCopyEnv = (modelId) => {
    navigator.clipboard.writeText(`OPENROUTER_MODEL=${modelId}`);
    alert(`Copied: OPENROUTER_MODEL=${modelId}`);
  };

  // ---- DASHBOARD HELPERS ----
  const renderPriorityGuide = () => {
    return (
      <div className="priority-guide-table" style={{ marginTop: '15px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px', fontWeight: '700' }}>Lead Status</th>
              <th style={{ padding: '10px 12px', fontWeight: '700' }}>Target Language</th>
              <th style={{ padding: '10px 12px', fontWeight: '700' }}>Recommended Model</th>
              <th style={{ padding: '10px 12px', fontWeight: '700' }}>Allocation Priority</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '10px 12px' }}>🔴 Hot Lead</td>
              <td style={{ padding: '10px 12px' }}>Hinglish / Regional Native</td>
              <td style={{ padding: '10px 12px' }}><code>google/gemma-4-31b-it:free</code></td>
              <td style={{ padding: '10px 12px' }}><span className="pill pill-best">High Quality</span></td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '10px 12px' }}>🟠 Warm Lead</td>
              <td style={{ padding: '10px 12px' }}>Mixed / English Primary</td>
              <td style={{ padding: '10px 12px' }}><code>meta-llama/llama-3.3-70b-instruct:free</code></td>
              <td style={{ padding: '10px 12px' }}><span className="pill pill-ctx">Balanced</span></td>
            </tr>
            <tr>
              <td style={{ padding: '10px 12px' }}>⚫ Cold Lead</td>
              <td style={{ padding: '10px 12px' }}>Pure English</td>
              <td style={{ padding: '10px 12px' }}><code>mistralai/mistral-7b-instruct:free</code></td>
              <td style={{ padding: '10px 12px' }}><span className="pill pill-free">Quota Saver</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // ---- SANDBOX CHAT PANEL AGENT CALLS ----
  const sendSandboxMessage = async (textToSend) => {
    if (!textToSend.trim() || !activeChatBrandId) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'read'
    };

    setChatConversations(prev => ({
      ...prev,
      [activeChatBrandId]: [...(prev[activeChatBrandId] || []), userMsg]
    }));

    setInputText('');
    setIsTyping(true);

    try {
      const activeBrand = brands.find(b => b.id === activeChatBrandId);
      const activeBrandModel = activeBrand?.model;
      const effectiveProvider = (provider === 'groq' || provider === 'grok') ? provider : (activeBrandModel === 'groq' ? 'groq' : (activeBrandModel === 'grok' ? 'grok' : 'openrouter'));
      const activeApiKey = effectiveProvider === 'openrouter' ? openRouterKey : (effectiveProvider === 'groq' ? groqKey : grokKey);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brandId: activeChatBrandId,
          text: textToSend,
          customerPhone: '9876543210',
          customerName: 'Priya Sharma',
          provider: effectiveProvider,
          apiKey: activeApiKey
        })
      });

      const data = await res.json();
      if (data.success && data.data) {
        const aiMsg = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: data.data.reply,
          imageUrl: data.data.imageUrl || null,
          buttons: data.data.buttons || [],
          modelUsed: data.data.modelUsed || 'AI Model',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatConversations(prev => ({
          ...prev,
          [activeChatBrandId]: [...(prev[activeChatBrandId] || []), aiMsg]
        }));
      }
    } catch (err) {
      console.error('Sandbox error:', err);
    } finally {
      setIsTyping(false);
    }
  };

  const initializeChat = (brandId) => {
    setActiveChatBrandId(brandId);
    if (!chatConversations[brandId]) {
      const brand = brands.find(b => b.id === brandId);
      const welcomeMsg = {
        id: 'welcome-' + brandId,
        sender: 'bot',
        text: brand?.greeting || "Namaste! How can I help you today?",
        buttons: [
          { id: 'track_order', title: '📦 Track Order' },
          { id: 'return_exchange', title: '🔄 Return/Exchange' },
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatConversations(prev => ({
        ...prev,
        [brandId]: [welcomeMsg]
      }));
    }
  };

  return (
    <div className="app-container">
      {/* GLOBAL APPNHEADER */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-logo">Flow<span>Desk</span></div>
          <div className="brand-subtitle">WhatsApp AI D2C Studio</div>
        </div>
        <div className="header-controls">
          <select 
            className="api-provider-select"
            style={{ 
              marginRight: '10px', 
              padding: '8px 12px', 
              borderRadius: '6px', 
              background: 'var(--bg-secondary)', 
              border: '1px solid var(--border-color)', 
              color: 'var(--text-primary)', 
              outline: 'none', 
              cursor: 'pointer',
              fontSize: '13px'
            }}
            value={provider}
            onChange={(e) => {
              const val = e.target.value;
              setProvider(val);
              localStorage.setItem('flowdesk_api_provider', val);
            }}
          >
            <option value="openrouter">OpenRouter API</option>
            <option value="grok">Grok (xAI) API</option>
            <option value="groq">Groq API</option>
          </select>

          {provider === 'openrouter' && (
            <input 
              className="api-key-input" 
              type="password" 
              placeholder="Paste OpenRouter API Key"
              value={openRouterKey}
              onChange={(e) => {
                const val = e.target.value;
                setOpenRouterKey(val);
                localStorage.setItem('flowdesk_openrouter_key', val);
                localStorage.setItem('flowdesk_api_key', val);
              }}
            />
          )}
          {provider === 'grok' && (
            <input 
              className="api-key-input" 
              type="password" 
              placeholder="Grok Key configured in .env"
              value={grokKey}
              onChange={(e) => {
                const val = e.target.value;
                setGrokKey(val);
                localStorage.setItem('flowdesk_grok_key', val);
              }}
            />
          )}
          {provider === 'groq' && (
            <input 
              className="api-key-input" 
              type="password" 
              placeholder="Groq Key (starts with gsk_)"
              value={groqKey}
              onChange={(e) => {
                const val = e.target.value;
                setGroqKey(val);
                localStorage.setItem('flowdesk_groq_key', val);
              }}
            />
          )}

          {provider === 'openrouter' && (
            <button className="btn btn-primary" onClick={() => loadModels(openRouterKey)}>Load Models</button>
          )}
          
          <div className="nav-toggle-buttons">
            <button 
              className={`toggle-btn ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
            >
              📊 Studio
            </button>
            <button 
              className={`toggle-btn ${activeView === 'chat' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('chat');
                initializeChat(activeChatBrandId);
              }}
            >
              💬 WhatsApp Sandbox
            </button>
          </div>
        </div>
      </header>



      {/* VIEW 2: FLOWDESK STUDIO DASHBOARD */}
      {activeView === 'dashboard' && (
        <div className="studio-layout">
          {/* SIDEBAR */}
          <aside className="studio-sidebar">
            <div className="sidebar-meta">
              <h3>Free Models {allModels.length > 0 && <span className="highlight-text">({allModels.length})</span>}</h3>
              <p>All OpenRouter free tier models ranked by D2C Hinglish score</p>
            </div>
            
            <div className="search-bar">
              <input 
                type="text" 
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => filterModels(e.target.value)}
              />
            </div>

            <div className="models-list">
              {loadingModels ? (
                <div className="loading-state">
                  <div className="loader"></div>
                  <p>Fetching models...</p>
                </div>
              ) : filteredModels.length === 0 ? (
                <div className="empty-state">
                  <p>No free models loaded.<br />Insert API key above to load models.</p>
                </div>
              ) : (
                filteredModels.map(m => (
                  <div 
                    key={m.id} 
                    className={`model-item ${selectedModel?.id === m.id ? 'active' : ''}`}
                    onClick={() => setSelectedModel(m)}
                  >
                    <div className="model-item-title">{m.name}</div>
                    <div className="model-item-pills">
                      <span className="pill pill-free">FREE</span>
                      {m.context >= 100000 && <span className="pill pill-ctx">{Math.round(m.context / 1000)}k ctx</span>}
                      {m.score >= 80 && <span className="pill pill-best">⭐ Best</span>}
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${Math.min(100, m.score)}%` }}></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>

          {/* MAIN CONTENT VIEW */}
          <main className="studio-content">
            <div className="content-tabs">
              <button className={`tab-link ${activeTab === 'models' ? 'active' : ''}`} onClick={() => setActiveTab('models')}>
                🤖 Model Details
              </button>
              <button className={`tab-link ${activeTab === 'clients' ? 'active' : ''}`} onClick={() => setActiveTab('clients')}>
                👥 My Prospects
              </button>
              <button className={`tab-link ${activeTab === 'recommend' ? 'active' : ''}`} onClick={() => setActiveTab('recommend')}>
                ⚡ Smart Assign
              </button>
            </div>

            {/* TAB VIEW: MODEL DETAILS */}
            {activeTab === 'models' && (
              <div className="tab-pane">
                {!selectedModel ? (
                  <div className="empty-details">
                    <span className="big-icon">🤖</span>
                    <h3>Select a model to view parameters</h3>
                    <p>Load the free model list and click one on the sidebar.</p>
                  </div>
                ) : (
                  <div className="model-details">
                    <div className="detail-hero-box">
                      <div className="details-header">
                        <h2>{selectedModel.name}</h2>
                        <code className="model-code-id">{selectedModel.id}</code>
                      </div>
                      <p className="model-description">{selectedModel.description || 'No description available for this model.'}</p>

                      <div className="metrics-grid">
                        <div className="metric-box">
                          <span className="label">COST</span>
                          <span className="val text-green">₹0 (Free)</span>
                        </div>
                        <div className="metric-box">
                          <span className="label">CONTEXT SIZE</span>
                          <span className="val text-purple">{selectedModel.context >= 1000 ? `${Math.round(selectedModel.context / 1000)}K` : selectedModel.context || 'N/A'} tokens</span>
                        </div>
                        <div className="metric-box">
                          <span className="label">D2C QUALITY SCORE</span>
                          <span className={`val ${selectedModel.score >= 80 ? 'text-green' : selectedModel.score >= 60 ? 'text-orange' : 'text-gray'}`}>
                            {selectedModel.score}/100
                          </span>
                        </div>
                        <div className="metric-box">
                          <span className="label">DAILY LIMIT</span>
                          <span className="val text-orange">50 reqs</span>
                        </div>
                      </div>

                      <div className="quality-bar-container">
                        <div className="quality-bar-header">
                          <span>D2C Customer Support Suitability</span>
                          <span>{selectedModel.score}%</span>
                        </div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${selectedModel.score}%` }}></div>
                        </div>
                      </div>

                      <div className="suitability-pills-row">
                        {selectedModel.score >= 80 ? (
                          <>
                            <span className="pill-status pill-hot">🔥 Highly Recommended for Hot Leads</span>
                            <span className="pill-status pill-multilingual">✅ Multilingual / Hinglish Native</span>
                            <span className="pill-status pill-production">🏢 Demo Summit Ready</span>
                          </>
                        ) : selectedModel.score >= 60 ? (
                          <>
                            <span className="pill-status pill-warm">⚡ Good for Warm Prospects</span>
                            <span className="pill-status pill-english">🇬🇧 English-first preference</span>
                          </>
                        ) : (
                          <span className="pill-status pill-cold">💤 Casual / Cold Leads Only</span>
                        )}
                      </div>
                    </div>

                    <div className="env-generator-card">
                      <h4>Integration Settings</h4>
                      <p>Copy this variable block directly into your `.env` file to use this model.</p>
                      <div className="code-display-block">
                        <code>OPENROUTER_MODEL={selectedModel.id}</code>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleCopyEnv(selectedModel.id)}>Copy</button>
                      </div>
                    </div>

                    {brands.length > 0 && (
                      <div className="quick-assign-panel">
                        <h4>Assign to active prospects:</h4>
                        <div className="assign-buttons-list">
                          {brands.map(b => (
                            <button 
                              key={b.id} 
                              className="btn btn-ghost" 
                              onClick={() => {
                                updateBrandModel(b.id, selectedModel.id, selectedModel.name);
                                alert(`Assigned ${selectedModel.name} to ${b.name}`);
                              }}
                            >
                              {b.name} {b.status === 'hot' ? '🔴' : b.status === 'warm' ? '🟠' : '⚫'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB VIEW: CLIENTS / PROSPECTS */}
            {activeTab === 'clients' && (
              <div className="tab-pane">
                <div className="split-view-panel">
                  {/* LEFT: ADD CLIENT FORM */}
                  <div className="add-client-panel">
                    <h3>➕ Add Prospect Brand</h3>
                    <form onSubmit={addBrand} className="dashboard-form">
                      <div className="form-group">
                        <label>Brand Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Komplyte" 
                          value={brandForm.name}
                          onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Category</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Fashion" 
                            value={brandForm.category}
                            onChange={(e) => setBrandForm({ ...brandForm, category: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Orders/day</label>
                          <input 
                            type="text" 
                            placeholder="e.g. 150" 
                            value={brandForm.orders}
                            onChange={(e) => setBrandForm({ ...brandForm, orders: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Status / Temperature</label>
                          <select 
                            value={brandForm.status}
                            onChange={(e) => setBrandForm({ ...brandForm, status: e.target.value })}
                          >
                            <option value="hot">🔴 Hot Lead</option>
                            <option value="warm">🟠 Warm Lead</option>
                            <option value="cold">⚫ Cold Lead</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Primary Language</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Hinglish" 
                            value={brandForm.language}
                            onChange={(e) => setBrandForm({ ...brandForm, language: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Notes / Context</label>
                        <textarea 
                          placeholder="Enter requirements..."
                          value={brandForm.notes}
                          onChange={(e) => setBrandForm({ ...brandForm, notes: e.target.value })}
                        />
                      </div>
                      <button type="submit" className="btn btn-primary btn-block">Add Client Brand ✓</button>
                    </form>
                  </div>

                  {/* RIGHT: LIST OF PROSPECTS */}
                  <div className="clients-list-panel">
                    <h3>👥 Configured Brands {loadingBrands && <span className="subtext">(loading...)</span>}</h3>
                    <div className="clients-grid">
                      {brands.map(c => (
                        <div key={c.id} className="client-card">
                          <div className="client-card-header">
                            <div>
                              <h4>{c.name}</h4>
                              <span className="category-tag">🏷️ {c.category}</span>
                            </div>
                            <span className={`temp-badge ${
                              c.status === 'hot' ? 'badge-hot' : c.status === 'warm' ? 'badge-warm' : 'badge-cold'
                            }`}>
                              {c.status?.toUpperCase() || 'WARM'}
                            </span>
                          </div>
                          <div className="client-card-meta">
                            <div>📦 {c.orders || '0'} orders/day</div>
                            <div>🗣️ {c.language || 'Hinglish'}</div>
                            {c.notes && <div className="client-notes-preview">📝 {c.notes}</div>}
                          </div>
                          
                          <div className="assigned-model-bar">
                            <div className="model-label">ACTIVE MODEL:</div>
                            <div className="model-value">{c.modelName || c.model}</div>
                            <button className="btn btn-sm btn-ghost" onClick={() => openAssignModal(c.id)}>
                              Change
                            </button>
                          </div>

                          <div className="client-card-actions">
                            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => handleCopyEnv(c.model)}>
                              Copy .env
                            </button>
                            <button 
                              className="btn btn-sm btn-danger-outline" 
                              onClick={() => deleteBrand(c.id)}
                              disabled={c.id === 'demo'}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB VIEW: SMART ASSIGN RECOMMENDATIONS */}
            {activeTab === 'recommend' && (
              <div className="tab-pane">
                <div className="recommendation-wizard">
                  <h3>⚡ Smart Model Assignment Wizard</h3>
                  
                  <div className="wizard-form">
                    <div className="form-group">
                      <label>Prospect Status</label>
                      <select 
                        value={recInputs.status}
                        onChange={(e) => setRecInputs({ ...recInputs, status: e.target.value })}
                      >
                        <option value="hot">🔴 Hot Lead (impress demo)</option>
                        <option value="warm">🟠 Warm Lead (balanced trial)</option>
                        <option value="cold">⚫ Cold Lead (save top quota)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Target Languages</label>
                      <select 
                        value={recInputs.lang}
                        onChange={(e) => setRecInputs({ ...recInputs, lang: e.target.value })}
                      >
                        <option value="hinglish">Hinglish / Mixed (Indian Native)</option>
                        <option value="english">Pure English only</option>
                      </select>
                    </div>
                    <button className="btn btn-primary" onClick={getRecommendation}>
                      Calculate Recommended Model
                    </button>
                  </div>

                  {recommendationResult && (
                    <div className="wizard-result-box">
                      <div className="result-header">
                        <span>RECOMMENDED MODEL:</span>
                        <h3>{recommendationResult.top.name}</h3>
                        <code className="model-code-id">{recommendationResult.top.id}</code>
                      </div>
                      <div className="result-body">
                        <button className="btn btn-primary btn-sm" onClick={() => handleCopyEnv(recommendationResult.top.id)}>
                          Copy Model Env Variable✓
                        </button>
                      </div>
                    </div>
                  )}

                  <hr className="divider" />
                  <h4>📋 Dynamic Suite Allocation Table</h4>
                  {renderPriorityGuide()}
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* VIEW 3: FULL SCREEN WHATSAPP SANDBOX CHAT */}
      {activeView === 'chat' && (
        <div className="chat-layout">
          {/* LEFT SIDEBAR: THREADS */}
          <aside className="chat-sidebar">
            <div className="chat-sidebar-header">
              <div className="sidebar-profile">
                <div className="avatar avatar-header">FD</div>
                <span>Developer Sandbox</span>
              </div>
            </div>
            
            <div className="chat-search">
              <div className="search-input-container">
                <span className="search-icon">🔍</span>
                <input type="text" placeholder="Search or start chat" />
              </div>
            </div>

            <div className="chat-threads-list">
              {brands.map(b => (
                <div 
                  key={b.id} 
                  className={`thread-item ${activeChatBrandId === b.id ? 'active' : ''}`}
                  onClick={() => initializeChat(b.id)}
                >
                  <div className="avatar avatar-brand">
                    {b.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="thread-details">
                    <span className="thread-name">{b.name}</span>
                    <span className="thread-preview">AI Chat Sandbox Channel</span>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* RIGHT VIEW: LIVE WINDOW */}
          <main className="chat-window">
            {activeChatBrandId ? (
              <>
                <header className="chat-window-header">
                  <div className="chat-brand-info">
                    <div className="avatar avatar-chat">
                      {brands.find(b => b.id === activeChatBrandId)?.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="chat-header-name">
                        {brands.find(b => b.id === activeChatBrandId)?.name} 
                        <span className="verified-badge">✓</span>
                      </span>
                      <span className="chat-header-status">
                        online · Model: <span className="highlight-model">
                          {(() => {
                            const b = brands.find(brand => brand.id === activeChatBrandId);
                            if (provider === 'groq' || b?.model === 'groq') return 'Groq (Llama-3.3)';
                            if (provider === 'grok' || b?.model === 'grok') return 'Grok-2 (xAI)';
                            return b?.modelName || b?.model || 'Default';
                          })()}
                        </span>
                      </span>
                    </div>
                  </div>
                </header>

                <div className="chat-messages-container">
                  <div className="chat-wallpaper"></div>
                  
                  <div className="chat-scroll-area">
                    <div className="info-notice-bubble">
                      🔒 Sandbox developer console messages. Connects directly to backend API.
                    </div>

                    {(chatConversations[activeChatBrandId] || []).map(msg => (
                      <div key={msg.id} className={`message-bubble-wrapper ${msg.sender === 'user' ? 'msg-sent' : 'msg-received'}`}>
                        <div className="message-bubble">
                          {msg.imageUrl && (
                            <img src={msg.imageUrl} alt="Product" className="msg-image" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', marginBottom: '8px', display: 'block' }} />
                          )}
                          <p className="msg-text">{msg.text}</p>
                          <span className="msg-timestamp">
                            {msg.timestamp}
                            {msg.sender === 'user' && <span className="blue-ticks"> ✓✓</span>}
                          </span>
                        </div>

                        {msg.buttons && msg.buttons.length > 0 && (
                          <div className="msg-interactive-buttons">
                            {msg.buttons.map(btn => (
                              <button 
                                key={btn.id} 
                                className="chat-action-btn"
                                onClick={() => sendSandboxMessage(btn.title)}
                              >
                                {btn.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {isTyping && (
                      <div className="message-bubble-wrapper msg-received">
                        <div className="message-bubble typing-indicator-bubble">
                          <span className="typing-dots">
                            <span>.</span><span>.</span><span>.</span>
                          </span>
                        </div>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>
                </div>

                <footer className="chat-input-footer">
                  <span className="chat-icon-btn">😊</span>
                  <input 
                    type="text" 
                    placeholder="Type message..." 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') sendSandboxMessage(inputText);
                    }}
                  />
                  <button className="chat-send-btn" onClick={() => sendSandboxMessage(inputText)}>➡️</button>
                </footer>
              </>
            ) : (
              <div className="no-chat-selected">
                <div className="no-chat-box">
                  <h3>Select a Chat Thread</h3>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* ASSIGN MODEL MODAL */}
      {isAssignModalOpen && (
        <div className="modal-overlay">
          <div className="modal-container animate-fade-in">
            <div className="modal-header">
              <h3>Assign Model</h3>
              <button className="close-btn" onClick={() => setIsAssignModalOpen(false)}>×</button>
            </div>
            
            <div className="modal-body scroll-vertical">
              <div className="modal-models-list">
                {allModels.map(m => (
                  <div 
                    key={m.id} 
                    className={`modal-model-row ${pendingAssignModel === m.id ? 'active' : ''}`}
                    onClick={() => setPendingAssignModel(m.id)}
                  >
                    <div>
                      <div className="modal-row-title">{m.name}</div>
                      <code className="modal-row-code">{m.id}</code>
                    </div>
                    <div className="modal-row-score">Score: {m.score}/100</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsAssignModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmAssign} disabled={!pendingAssignModel}>
                Assign Model
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
