import { useState } from 'react'
import { optimizeLocal, optimizeWithAI, estimateTokens, estimateCost } from './optimizer'
import './App.css'

function App() {
  const [input, setInput] = useState('')
  const [localResult, setLocalResult] = useState(null)
  const [aiResult, setAiResult] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_api_key') || '')
  const [showApiKey, setShowApiKey] = useState(false)

  const handleLocalOptimize = () => {
    if (!input.trim()) return
    setLocalResult(optimizeLocal(input))
    setAiResult(null)
    setError('')
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

  const activeResult = aiResult || localResult
  const isAI = !!aiResult

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ marginBottom: 4 }}>Prompt Optimizer</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Local cleanup is free. AI optimization costs ~$0.001 — saves 10x downstream.
      </p>

      <textarea
        rows={6}
        placeholder="Paste your prompt here..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        style={{ width: '100%', padding: 12, fontSize: 15, boxSizing: 'border-box', borderRadius: 6, border: '1px solid #ccc', resize: 'vertical' }}
      />

      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <button
          onClick={handleLocalOptimize}
          disabled={!input.trim()}
          style={{ padding: '10px 20px', fontSize: 15, cursor: 'pointer', background: '#222', color: '#fff', border: 'none', borderRadius: 6 }}
        >
          Quick Optimize (Free)
        </button>
        <button
          onClick={handleAIOptimize}
          disabled={!input.trim() || aiLoading}
          style={{ padding: '10px 20px', fontSize: 15, cursor: aiLoading ? 'wait' : 'pointer', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6 }}
        >
          {aiLoading ? 'Optimizing...' : 'Deep Optimize with AI'}
        </button>
      </div>

      {(showApiKey || apiKey) && (
        <div style={{ marginTop: 12 }}>
          <input
            type="password"
            placeholder="OpenAI API Key (for AI optimization)"
            value={apiKey}
            onChange={handleApiKeyChange}
            style={{ width: '100%', padding: 8, fontSize: 13, boxSizing: 'border-box', borderRadius: 4, border: '1px solid #ddd' }}
          />
        </div>
      )}

      {error && <p style={{ color: '#dc2626', marginTop: 12 }}>{error}</p>}

      {activeResult && (
        <div style={{ marginTop: 24, textAlign: 'left' }}>
          {/* Optimized prompt */}
          <div style={{ background: isAI ? '#eff6ff' : '#f0fff0', padding: 16, borderRadius: 8, marginBottom: 14, border: `1px solid ${isAI ? '#bfdbfe' : '#bbf7d0'}` }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>
              {isAI ? '🤖 AI-Optimized Prompt' : 'Optimized Prompt'}
            </h3>
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5 }}>
              {activeResult.optimizedPrompt}
            </pre>
          </div>

          {/* What changed */}
          {activeResult.changes && activeResult.changes.length > 0 && (
            <div style={{ background: '#f9fafb', padding: 16, borderRadius: 8, marginBottom: 14, border: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>What changed</h3>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
                {activeResult.changes.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          {/* Token stats */}
          <div style={{ background: '#f0f0ff', padding: 16, borderRadius: 8, border: '1px solid #c7d2fe', display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 14 }}>
            <div><strong>Before:</strong> ~{activeResult.beforeTokens} tokens</div>
            <div><strong>After:</strong> ~{activeResult.afterTokens} tokens</div>
            <div><strong>Saved:</strong> {activeResult.reduction}%</div>
          </div>

          {/* Cost tradeoff (AI only) */}
          {isAI && aiResult && (
            <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 8, marginTop: 14, border: '1px solid #bbf7d0' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Cost tradeoff</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, fontSize: 14 }}>
                <div>
                  <div style={{ color: '#666' }}>Optimization cost</div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>${aiResult.optimizationCost.toFixed(4)}</div>
                </div>
                <div>
                  <div style={{ color: '#666' }}>Saved per future use</div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>${aiResult.savingsPerUse.toFixed(4)}</div>
                </div>
                <div>
                  <div style={{ color: '#666' }}>Break-even</div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>
                    {aiResult.breakEven === Infinity ? '—' : `${aiResult.breakEven} use${aiResult.breakEven !== 1 ? 's' : ''}`}
                  </div>
                </div>
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 13, color: '#166534' }}>
                Spend ${aiResult.optimizationCost.toFixed(4)} once → save ${aiResult.savingsPerUse.toFixed(4)} every time you use this prompt.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
