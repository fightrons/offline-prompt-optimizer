import { useState } from 'react'
import { optimizeLocal, optimizeWithAI, estimateTokens, estimateCost, countAnthropicTokens } from './optimizer/index.js'
import { Settings, Copy, Check, Sparkles, Zap, AlertCircle, Bot, Key, Trash2 } from 'lucide-react'
import './App.css'

function formatCost(cost) {
  if (cost >= 0.01) return `$${cost.toFixed(2)}`
  if (cost >= 0.001) return `$${cost.toFixed(3)}`
  if (cost >= 0.0001) return `$${cost.toFixed(4)}`
  return `<$0.0001`
}

function App() {
  const [input, setInput] = useState('')
  const [localResult, setLocalResult] = useState(null)
  const [aiResult, setAiResult] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_api_key') || '')
  const [anthropicKey, setAnthropicKey] = useState(() => localStorage.getItem('anthropic_api_key') || '')
  const [showApiKey, setShowApiKey] = useState(false)
  const [claudeTokens, setClaudeTokens] = useState(null) // { before, after }

  const [copiedInput, setCopiedInput] = useState(false)
  const [copiedOutput, setCopiedOutput] = useState(false)

  const handleLocalOptimize = () => {
    if (!input.trim()) return
    const result = optimizeLocal(input)
    setLocalResult(result)
    setAiResult(null)
    setError('')
    setClaudeTokens(null)

    // Fire Anthropic token count in background (free API call)
    if (anthropicKey.trim()) {
      Promise.all([
        countAnthropicTokens(input, anthropicKey),
        countAnthropicTokens(result.optimizedPrompt, anthropicKey),
      ]).then(([before, after]) => {
        if (before !== null && after !== null) {
          setClaudeTokens({ before, after })
        }
      })
    }
  }

  const handleAIOptimize = async () => {
    if (!apiKey.trim()) {
      setShowApiKey(true)
      setError('Enter your OpenAI API key to use AI optimization')
      return
    }

    const promptToOptimize = localResult ? localResult.optimizedPrompt : input
    if (!promptToOptimize.trim()) return

    setAiLoading(true)
    setError('')

    try {
      const { optimized, optimizationCost } = await optimizeWithAI(promptToOptimize, apiKey)

      const beforeTokens = estimateTokens(input)
      const afterTokens = estimateTokens(optimized)
      const reduction = beforeTokens > 0
        ? Math.round(((beforeTokens - afterTokens) / beforeTokens) * 100)
        : 0

      // Savings per future use = cost difference of sending original vs optimized
      const savedTokensPerUse = beforeTokens - afterTokens
      const savingsPerUse = estimateCost(savedTokensPerUse, 0)
      const breakEven = savingsPerUse > 0 ? Math.ceil(optimizationCost / savingsPerUse) : Infinity

      setAiResult({
        optimizedPrompt: optimized,
        beforeTokens,
        afterTokens,
        reduction,
        optimizationCost,
        savingsPerUse,
        breakEven,
      })
      setClaudeTokens(null)
      setShowApiKey(false)

      // Fire Anthropic token count in background
      if (anthropicKey.trim()) {
        Promise.all([
          countAnthropicTokens(input, anthropicKey),
          countAnthropicTokens(optimized, anthropicKey),
        ]).then(([before, after]) => {
          if (before !== null && after !== null) {
            setClaudeTokens({ before, after })
          }
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleApiKeyChange = (e) => {
    const key = e.target.value
    setApiKey(key)
    localStorage.setItem('openai_api_key', key)
  }

  const handleAnthropicKeyChange = (e) => {
    const key = e.target.value
    setAnthropicKey(key)
    localStorage.setItem('anthropic_api_key', key)
  }

  const handleClearInput = () => {
    setInput('')
    setLocalResult(null)
    setAiResult(null)
    setError('')
  }

  const handleCopyInput = async () => {
    if (!input) return;
    await navigator.clipboard.writeText(input);
    setCopiedInput(true);
    setTimeout(() => setCopiedInput(false), 2000);
  }

  const handleCopyOutput = async () => {
    const activeResult = aiResult || localResult;
    if (!activeResult || !activeResult.optimizedPrompt) return;
    await navigator.clipboard.writeText(activeResult.optimizedPrompt);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2000);
  }

  const activeResult = aiResult || localResult
  const isAI = !!aiResult

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="title-group">
          <h1>LeanPrompt <span style={{ fontSize: '0.55em', fontWeight: 'normal', color: '#a0aec0', WebkitTextFillColor: '#a0aec0' }}>| Prompt Optimizer</span></h1>
          <p>Local cleanup is free. AI optimization costs ~$0.001 &mdash; saves 10x downstream.</p>
        </div>
      </header>

      <div className="input-section">
        <textarea
          className="prompt-textarea"
          placeholder="Paste your prompt here..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="textarea-actions">
          {input && (
            <button className="icon-btn clear" onClick={handleClearInput} title="Clear Input">
              <Trash2 size={16} />
            </button>
          )}
          <button className="icon-btn copy" onClick={handleCopyInput} title="Copy Input">
            {copiedInput ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      <div className="action-buttons">
        <button
          className="btn-secondary"
          onClick={handleLocalOptimize}
          disabled={!input.trim() || aiLoading}
        >
          <Zap size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
          Local Cleanup (Free)
        </button>
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn-primary"
              onClick={handleAIOptimize}
              disabled={!input.trim() || aiLoading}
              style={{ flex: 1 }}
            >
              <Sparkles size={18} />
              {aiLoading ? 'Optimizing...' : 'Deep optimize with AI'}
            </button>
            <button
              className={`btn-api-key ${showApiKey ? 'active' : ''}`}
              onClick={() => setShowApiKey(!showApiKey)}
              title="API Key Settings"
            >
              <Key size={20} />
            </button>
          </div>

          {showApiKey && (
            <div className="settings-panel">
              <label className="api-key-label">OpenAI API Key (Required for AI)</label>
              <input
                type="password"
                className="api-key-input"
                placeholder="sk-..."
                value={apiKey}
                onChange={handleApiKeyChange}
              />
              <label className="api-key-label" style={{ marginTop: '12px' }}>Anthropic API Key (Optional — real Claude token counts)</label>
              <input
                type="password"
                className="api-key-input"
                placeholder="sk-ant-..."
                value={anthropicKey}
                onChange={handleAnthropicKeyChange}
              />
              {error === 'Enter your OpenAI API key to use AI optimization' && (
                <div style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {error && error !== 'Enter your OpenAI API key to use AI optimization' && (
        <div className="error-message">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {activeResult && (
        <div className="result-section">

          <div className="stats-grid">
            <div className="stat-box">
              <span className="stat-label">Before</span>
              <span className="stat-value">~{activeResult.beforeTokens} <small style={{ fontSize: 14, color: 'var(--text-secondary)' }}>tok</small></span>
              {claudeTokens && (
                <span className="stat-sub">{claudeTokens.before} <small>Claude tok</small></span>
              )}
            </div>
            <div className="stat-box">
              <span className="stat-label">After</span>
              <span className="stat-value highlight">~{activeResult.afterTokens} <small style={{ fontSize: 14, color: 'var(--text-secondary)' }}>tok</small></span>
              {claudeTokens && (
                <span className="stat-sub">{claudeTokens.after} <small>Claude tok</small></span>
              )}
            </div>
            <div className="stat-box">
              <span className="stat-label">Reduction</span>
              <span className="stat-value" style={{ color: 'var(--brand-color)' }}>{activeResult.reduction}%</span>
              {claudeTokens && claudeTokens.before > 0 && (
                <span className="stat-sub" style={{ color: 'var(--brand-color)' }}>
                  {Math.round(((claudeTokens.before - claudeTokens.after) / claudeTokens.before) * 100)}% <small>Claude</small>
                </span>
              )}
            </div>
          </div>

          <div className={`result-card ${isAI ? 'is-ai' : ''}`}>
            <div className="result-header">
              <h3 className="result-title">
                {isAI ? <Bot size={18} /> : <Zap size={18} />}
                {isAI ? 'AI-Optimized Prompt' : 'Optimized Prompt'}
              </h3>
              <button
                onClick={handleCopyOutput}
                style={{
                  background: 'transparent', border: 'none', color: 'inherit',
                  cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center'
                }}
              >
                {copiedOutput ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <pre className="result-content">
              {activeResult.optimizedPrompt}
            </pre>
          </div>

          {activeResult.changes && activeResult.changes.length > 0 && (
            <div className="changes-card">
              <h3>What changed</h3>
              <ul>
                {activeResult.changes.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          {isAI && (
            <div className="cost-card">
              <h3><Sparkles size={18} /> Optimization ROI</h3>
              <div className="cost-details">
                This optimization cost <strong>{formatCost(activeResult.optimizationCost)}</strong> and saves <strong>{activeResult.beforeTokens - activeResult.afterTokens} tokens</strong> ({activeResult.reduction}%) per use.
              </div>

              {activeResult.savingsPerUse > 0 && activeResult.breakEven !== Infinity ? (
                <div className="roi-positive">
                  <Check size={16} />
                  {activeResult.breakEven <= 1
                    ? `Pays for itself on the first reuse.`
                    : activeResult.breakEven <= 10
                      ? `Pays for itself after ${activeResult.breakEven} uses.`
                      : `Takes ${activeResult.breakEven} uses to break even.`}
                </div>
              ) : (
                <div className="roi-negative">
                  <AlertCircle size={16} /> No token savings achieved (output is same length or longer).
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}

export default App
