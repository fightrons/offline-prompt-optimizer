import { useState } from 'react'
import { optimizePrompt } from './optimizer'
import './App.css'

function App() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)

  const handleOptimize = () => {
    if (!input.trim()) return
    setResult(optimizePrompt(input))
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ marginBottom: 8 }}>Prompt Optimizer</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>Paste a prompt, get a shorter one. 100% local — no API calls.</p>

      <textarea
        rows={6}
        placeholder="Enter your prompt..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        style={{ width: '100%', padding: 12, fontSize: 16, boxSizing: 'border-box', borderRadius: 4, border: '1px solid #ccc', resize: 'vertical' }}
      />

      <button
        onClick={handleOptimize}
        disabled={!input.trim()}
        style={{
          marginTop: 12,
          padding: '10px 24px',
          fontSize: 16,
          cursor: 'pointer',
          background: '#222',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
        }}
      >
        Optimize
      </button>

      {result && (
        <div style={{ marginTop: 24, textAlign: 'left' }}>
          <div style={{ background: '#f0fff0', padding: 16, borderRadius: 6, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 8px' }}>Optimized Prompt</h3>
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>{result.optimizedPrompt}</pre>
          </div>

          <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 6, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 8px' }}>What changed</h3>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {result.changes.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>

          <div style={{ background: '#f0f0ff', padding: 16, borderRadius: 6, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div><strong>Before:</strong> ~{result.beforeTokens} tokens</div>
            <div><strong>After:</strong> ~{result.afterTokens} tokens</div>
            <div><strong>Reduction:</strong> {result.reduction}%</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
