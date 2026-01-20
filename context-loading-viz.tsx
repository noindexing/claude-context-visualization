import React, { useState, useEffect, useRef } from 'react';

export default function ContextLoadingViz() {
  const [messages, setMessages] = useState([]);
  const [autocompactEnabled, setAutocompactEnabled] = useState(true);
  const [compactionState, setCompactionState] = useState('idle');
  const [compactionProgress, setCompactionProgress] = useState(0);
  const [isManualCompact, setIsManualCompact] = useState(false);
  const [compactionCount, setCompactionCount] = useState(0);
  const [showApiError, setShowApiError] = useState(false);
  const [subagent, setSubagent] = useState(null);
  const [claudeMdSize, setClaudeMdSize] = useState(1500); // Default memory file size
  const conversationRef = useRef(null); // { name, messages, tokens, progress }
  
  const maxTokens = 200000;
  const autocompactBuffer = 45000;
  const autocompactTrigger = 155000;
  
  const systemPromptLayers = [
    { name: 'System Prompt', tokens: 2400, color: 'bg-slate-600' },
    { name: 'System Tools', tokens: 16600, color: 'bg-slate-700' },
    { name: 'MCP Tools', tokens: 10700, color: 'bg-cyan-700' },
    { name: 'Custom Agents', tokens: 3100, color: 'bg-indigo-700' },
    { name: 'Memory Files (CLAUDE.md)', tokens: claudeMdSize, color: 'bg-purple-700' },
  ];
  
  // Message templates that cycle
  const messageTemplates = [
    { role: 'user', content: 'Add authentication to /users endpoint', tokens: 25 },
    { role: 'assistant', content: '[Read src/api/routes.ts] Adding JWT middleware...', tokens: 2800 },
    { role: 'user', content: 'Use validateToken helper instead', tokens: 18 },
    { role: 'assistant', content: '[Read src/utils/auth.ts] Updated implementation...', tokens: 3200 },
    { role: 'user', content: 'Now add rate limiting', tokens: 12 },
    { role: 'assistant', content: '[Search for rate limiting] Adding middleware...', tokens: 4500 },
    { role: 'user', content: 'Add tests for the new endpoints', tokens: 15 },
    { role: 'assistant', content: '[Read test patterns] Creating test suite...', tokens: 8200 },
    { role: 'user', content: 'Fix the failing test for edge cases', tokens: 20 },
    { role: 'assistant', content: '[Analyze failures] Fixed edge cases...', tokens: 6800 },
    { role: 'user', content: 'Add API documentation', tokens: 14 },
    { role: 'assistant', content: '[Generate OpenAPI spec] Documentation added...', tokens: 12000 },
    { role: 'user', content: 'Review all changes and create PR', tokens: 22 },
    { role: 'assistant', content: '[Git diff analysis] Creating pull request...', tokens: 18000 },
    { role: 'user', content: 'Add more comprehensive error handling', tokens: 19 },
    { role: 'assistant', content: '[Refactoring error handlers] Added try-catch...', tokens: 22000 },
    { role: 'user', content: 'Update the README with new endpoints', tokens: 16 },
    { role: 'assistant', content: '[Reading current README] Updating docs...', tokens: 25000 },
    { role: 'user', content: 'Final review before merge', tokens: 14 },
    { role: 'assistant', content: '[Complete codebase scan] Final checks...', tokens: 35000 },
  ];
  
  const systemTokens = systemPromptLayers.reduce((sum, l) => sum + l.tokens, 0);
  const convoTokens = messages.reduce((sum, m) => sum + m.tokens, 0);
  const usedTokens = systemTokens + convoTokens;
  const hitLimit = !autocompactEnabled && usedTokens >= maxTokens;
  const shouldTriggerCompact = autocompactEnabled && convoTokens > 0 && usedTokens >= autocompactTrigger && compactionState === 'idle';
  
  // Detect hitting limit when autocompact disabled
  useEffect(() => {
    if (hitLimit && !showApiError) {
      setShowApiError(true);
    }
  }, [hitLimit]);
  
  // Add next message
  const addMessage = () => {
    if (compactionState === 'compacting' || hitLimit) return;
    const templateIndex = messages.filter(m => !m.isCompacted).length % messageTemplates.length;
    const template = messageTemplates[templateIndex];
    setMessages(prev => [...prev, { ...template, id: Date.now() }]);
  };
  
  // Add multiple messages
  const addMultipleMessages = (count) => {
    if (compactionState === 'compacting' || hitLimit) return;
    const newMessages = [];
    let currentLength = messages.filter(m => !m.isCompacted).length;
    for (let i = 0; i < count; i++) {
      const templateIndex = (currentLength + i) % messageTemplates.length;
      const template = messageTemplates[templateIndex];
      newMessages.push({ ...template, id: Date.now() + i });
    }
    setMessages(prev => [...prev, ...newMessages]);
  };
  
  // Remove last message
  const removeMessage = () => {
    if (compactionState === 'compacting') return;
    setMessages(prev => {
      if (prev.length === 0) return prev;
      // Don't remove compacted summaries
      if (prev[prev.length - 1].isCompacted) return prev;
      return prev.slice(0, -1);
    });
  };
  
  // Trigger manual compact
  const triggerManualCompact = () => {
    if (messages.length > 0 && compactionState === 'idle' && !hitLimit) {
      setIsManualCompact(true);
      setCompactionState('compacting');
      setCompactionProgress(0);
    }
  };
  
  // Reset all
  const resetAll = () => {
    setMessages([]);
    setCompactionState('idle');
    setCompactionProgress(0);
    setIsManualCompact(false);
    setCompactionCount(0);
    setShowApiError(false);
    setSubagent(null);
  };

  // Spawn subagent
  const spawnSubagent = (type) => {
    if (subagent || compactionState === 'compacting' || hitLimit) return;
    
    const subagentTypes = {
      explore: { name: 'Explore', color: 'cyan', task: 'Searching codebase for auth patterns...', resultTokens: 800 },
      task: { name: 'Task', color: 'amber', task: 'Implementing feature in isolated context...', resultTokens: 1200 },
      plan: { name: 'Plan', color: 'emerald', task: 'Analyzing requirements and creating plan...', resultTokens: 600 },
    };
    
    const config = subagentTypes[type];
    setSubagent({
      ...config,
      type,
      progress: 0,
      internalTokens: 0,
      maxInternalTokens: 45000,
      status: 'running',
      internalMessages: []
    });
  };

  // Subagent progress
  useEffect(() => {
    if (!subagent || subagent.status !== 'running') return;
    
    const interval = setInterval(() => {
      setSubagent(prev => {
        if (!prev) return null;
        
        const newProgress = prev.progress + 3;
        const newInternalTokens = Math.min(prev.maxInternalTokens, prev.internalTokens + 1500);
        
        // Add internal messages at certain progress points
        let newMessages = [...prev.internalMessages];
        if (newProgress === 15) newMessages.push({ text: '[Reading files...]', tokens: 8000 });
        if (newProgress === 30) newMessages.push({ text: '[Analyzing patterns...]', tokens: 12000 });
        if (newProgress === 50) newMessages.push({ text: '[Processing results...]', tokens: 15000 });
        if (newProgress === 75) newMessages.push({ text: '[Preparing summary...]', tokens: 8000 });
        
        if (newProgress >= 100) {
          clearInterval(interval);
          return { ...prev, progress: 100, status: 'complete', internalTokens: prev.maxInternalTokens, internalMessages: newMessages };
        }
        
        return { ...prev, progress: newProgress, internalTokens: newInternalTokens, internalMessages: newMessages };
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [subagent?.status]);

  // Complete subagent - return result to main context
  const completeSubagent = () => {
    if (!subagent || subagent.status !== 'complete') return;
    
    // Add only the summary result to main conversation (not all internal tokens!)
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `[${subagent.name} subagent] Result: Found 3 relevant patterns. Summary returned.`,
      tokens: subagent.resultTokens,
      isSubagentResult: true,
      id: Date.now()
    }]);
    
    setSubagent(null);
  };

  // Auto-scroll conversation to bottom
  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-compact trigger
  useEffect(() => {
    if (shouldTriggerCompact) {
      setIsManualCompact(false);
      setCompactionState('compacting');
      setCompactionProgress(0);
    }
  }, [shouldTriggerCompact]);

  // Compaction progress
  useEffect(() => {
    if (compactionState !== 'compacting') return;
    
    const interval = setInterval(() => {
      setCompactionProgress(p => {
        if (p >= 100) return 100;
        return p + 5;
      });
    }, 80);
    
    return () => clearInterval(interval);
  }, [compactionState]);

  // Compaction complete
  useEffect(() => {
    if (compactionProgress >= 100 && compactionState === 'compacting') {
      setCompactionState('done');
      setCompactionCount(c => c + 1);
      // Replace all messages with a compacted summary
      const summaryTokens = 8500;
      setMessages([{
        role: 'system',
        content: `📋 [Compacted Summary #${compactionCount + 1}] Previous ${messages.length} messages summarized.`,
        tokens: summaryTokens,
        isCompacted: true,
        id: Date.now()
      }]);
      // Reset for next cycle
      setTimeout(() => {
        setCompactionState('idle');
        setCompactionProgress(0);
      }, 1500);
    }
  }, [compactionProgress, compactionState]);

  const displayUsed = compactionState === 'compacting' 
    ? systemTokens + convoTokens - (convoTokens * compactionProgress / 100 * 0.9)
    : usedTokens;
  const freeSpace = Math.max(0, maxTokens - displayUsed - (autocompactEnabled ? autocompactBuffer : 0));
  
  // Context quality calculation (degrades as context fills)
  const contextUtilization = usedTokens / maxTokens;
  const qualityScore = Math.max(0, Math.min(100, 
    contextUtilization < 0.3 ? 100 :
    contextUtilization < 0.5 ? 100 - (contextUtilization - 0.3) * 50 :
    contextUtilization < 0.7 ? 90 - (contextUtilization - 0.5) * 100 :
    contextUtilization < 0.85 ? 70 - (contextUtilization - 0.7) * 150 :
    48 - (contextUtilization - 0.85) * 200
  ));
  
  const getQualityColor = (score) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };
  
  const getQualityLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Degraded';
    return 'Poor';
  };
  
  const pct = (v) => ((v / maxTokens) * 100).toFixed(1);

  // Compact grid rendering
  const cells = 100;
  const renderGrid = () => {
    const sysPrompt = systemPromptLayers[0].tokens;
    const sysTools = sysPrompt + systemPromptLayers[1].tokens;
    const mcpTools = sysTools + systemPromptLayers[2].tokens;
    const customAgents = mcpTools + systemPromptLayers[3].tokens;
    const memoryFiles = customAgents + systemPromptLayers[4].tokens;
    
    return Array.from({ length: cells }).map((_, i) => {
      const tokenPerCell = maxTokens / cells;
      const cellStart = i * tokenPerCell;
      
      let color = 'text-gray-700';
      let symbol = '⛶';
      
      if (cellStart < sysPrompt) {
        color = 'text-slate-400';
        symbol = '⛁';
      } else if (cellStart < sysTools) {
        color = 'text-slate-500';
        symbol = '⛁';
      } else if (cellStart < mcpTools) {
        color = 'text-cyan-500';
        symbol = '⛁';
      } else if (cellStart < customAgents) {
        color = 'text-indigo-400';
        symbol = '⛁';
      } else if (cellStart < memoryFiles) {
        color = 'text-purple-500';
        symbol = '⛁';
      } else if (cellStart < displayUsed) {
        const hasCompactedSummary = messages.some(m => m.isCompacted);
        if (hasCompactedSummary && cellStart < systemTokens + 8500) {
          color = 'text-violet-400';
        } else {
          color = compactionState === 'compacting' ? 'text-amber-400 animate-pulse' : 'text-emerald-400';
        }
        symbol = '⛁';
      } else if (autocompactEnabled && cellStart >= autocompactTrigger) {
        color = 'text-gray-500';
        symbol = '⛝';
      }
      
      return <span key={i} className={`${color} transition-all duration-150`}>{symbol}</span>;
    });
  };

  const turnCount = Math.ceil(messages.filter(m => !m.isCompacted).length / 2);
  
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 font-mono text-xs">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-xl font-bold mb-1 text-white">Context Window & Auto-Compact Visualization</h1>
        <p className="text-gray-400 mb-4">Watch how Claude Code manages context and triggers auto-compaction (endless simulation)</p>
        
        {/* Controls */}
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <button
            onClick={removeMessage}
            disabled={compactionState === 'compacting' || messages.length === 0 || messages[messages.length-1]?.isCompacted}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-xs disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-gray-400">
            Turn {turnCount} {compactionCount > 0 && `(Compacted ${compactionCount}x)`} {hitLimit && <span className="text-red-400">— LIMIT HIT</span>}
          </span>
          <button
            onClick={addMessage}
            disabled={compactionState === 'compacting' || hitLimit}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-xs disabled:opacity-40"
          >
            Next →
          </button>
          <button
            onClick={() => addMultipleMessages(6)}
            disabled={compactionState === 'compacting' || hitLimit}
            className="px-3 py-1.5 bg-amber-800 hover:bg-amber-700 rounded border border-amber-600 text-xs disabled:opacity-40"
          >
            +6 msgs ⚡
          </button>
          <button
            onClick={triggerManualCompact}
            disabled={messages.filter(m => !m.isCompacted).length < 2 || compactionState === 'compacting' || hitLimit}
            className="px-3 py-1.5 bg-violet-800 hover:bg-violet-700 rounded border border-violet-600 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            /compact
          </button>
          <button
            onClick={resetAll}
            className={`px-3 py-1.5 rounded border text-xs ${
              hitLimit
                ? 'bg-red-800 hover:bg-red-700 border-red-500 animate-pulse'
                : 'bg-gray-800 hover:bg-gray-700 border-gray-700'
            }`}
          >
            /clear {hitLimit && '(only option)'}
          </button>
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-1 text-gray-500">
              <span className="text-xs">Subagent:</span>
              <button
                onClick={() => spawnSubagent('explore')}
                disabled={!!subagent || compactionState === 'compacting' || hitLimit}
                className="px-2 py-1 bg-cyan-900 hover:bg-cyan-800 rounded border border-cyan-700 text-xs text-cyan-300 disabled:opacity-40"
              >
                Explore
              </button>
              <button
                onClick={() => spawnSubagent('task')}
                disabled={!!subagent || compactionState === 'compacting' || hitLimit}
                className="px-2 py-1 bg-amber-900 hover:bg-amber-800 rounded border border-amber-700 text-xs text-amber-300 disabled:opacity-40"
              >
                Task
              </button>
            </div>
            <label className="flex items-center gap-2 text-gray-400">
              <input
                type="checkbox"
                checked={autocompactEnabled}
                onChange={(e) => { setAutocompactEnabled(e.target.checked); resetAll(); }}
                className="rounded"
              />
              Autocompact
            </label>
          </div>
        </div>

        {/* Compaction Inline Banner */}
        {compactionState === 'compacting' && (
          <div className={`mb-4 ${isManualCompact ? 'bg-violet-900/40 border-violet-500' : 'bg-amber-900/40 border-amber-500'} border-2 rounded-lg p-4 shadow-lg`}>
            <div className="flex items-start gap-4">
              <div className="text-2xl animate-spin">⚙️</div>
              <div className="flex-1">
                <div className={`${isManualCompact ? 'text-violet-400' : 'text-amber-400'} font-bold mb-2`}>
                  {isManualCompact ? 'Manual Compact (/compact)' : 'Auto-Compact Triggered'}
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                  <div 
                    className={`h-full ${isManualCompact ? 'bg-gradient-to-r from-violet-500 to-purple-400' : 'bg-gradient-to-r from-amber-500 to-yellow-400'} transition-all duration-100`}
                    style={{ width: `${compactionProgress}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="text-red-400">🗑️ Removing: file contents, code snippets, verbose outputs</div>
                  <div className="text-green-400">✅ Keeping: CLAUDE.md, key decisions, recent messages</div>
                </div>
              </div>
              <div className={`${isManualCompact ? 'text-violet-300' : 'text-amber-300'} text-lg font-mono`}>{compactionProgress}%</div>
            </div>
          </div>
        )}

        {/* Compaction Success Banner */}
        {compactionState === 'done' && (
          <div className={`mb-4 ${isManualCompact ? 'bg-violet-900/30 border-violet-600/50' : 'bg-green-900/30 border-green-600/50'} border rounded-lg p-3`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <div className={`${isManualCompact ? 'text-violet-400' : 'text-green-400'} font-bold`}>
                  {isManualCompact ? 'Manual Compact Complete!' : 'Auto-Compact Complete!'} (#{compactionCount})
                </div>
                <div className={`${isManualCompact ? 'text-violet-300/70' : 'text-green-300/70'} text-xs mt-1`}>
                  Context compressed to {(usedTokens/1000).toFixed(0)}k tokens. You can continue adding messages.
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Warning before compact */}
        {!shouldTriggerCompact && autocompactEnabled && usedTokens > 120000 && usedTokens < autocompactTrigger && compactionState === 'idle' && (
          <div className="mb-4 bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-3 text-yellow-300 text-xs">
            ⚠️ Context at {((usedTokens/autocompactTrigger)*100).toFixed(0)}% of auto-compact threshold. 
            Consider running <code className="bg-black/30 px-1 rounded">/compact</code> manually at a logical breakpoint.
          </div>
        )}
        
        {/* Warning when approaching hard limit without autocompact */}
        {!autocompactEnabled && usedTokens > 160000 && usedTokens < maxTokens && (
          <div className="mb-4 bg-red-900/30 border border-red-600/50 rounded-lg p-3 text-red-300 text-xs">
            🚨 Context at {((usedTokens/maxTokens)*100).toFixed(0)}% of hard limit! Autocompact is disabled. 
            Use <code className="bg-black/30 px-1 rounded">/compact</code> NOW — once you hit the limit, only <code className="bg-black/30 px-1 rounded">/clear</code> will work!
          </div>
        )}

        {/* API Error Toast */}
        {showApiError && (
          <div className="mb-4 bg-red-900/50 border-2 border-red-500 rounded-lg p-4 shadow-lg shadow-red-500/20">
            <div className="flex items-start gap-3">
              <div className="text-2xl">❌</div>
              <div className="flex-1">
                <div className="text-red-400 font-bold">API Error: Context Limit Exceeded</div>
                <div className="text-red-300/80 text-xs mt-1 font-mono bg-black/30 p-2 rounded mt-2">
                  Error: 400 Bad Request<br/>
                  "prompt is too long: 203847 tokens &gt; 200000 maximum"
                </div>
                <div className="text-red-300/70 text-xs mt-2">
                  Your conversation has exceeded the maximum context window. All API calls will fail, including <code className="bg-black/30 px-1 rounded">/compact</code>. 
                  Use <code className="bg-black/30 px-1 rounded">/clear</code> to start fresh.
                </div>
              </div>
              <button 
                onClick={() => setShowApiError(false)}
                className="text-red-400 hover:text-red-300 text-lg"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Subagent Panel */}
        {subagent && (
          <div className={`mb-4 border-2 rounded-lg p-4 ${
            subagent.type === 'explore' ? 'bg-cyan-900/20 border-cyan-600' :
            subagent.type === 'task' ? 'bg-amber-900/20 border-amber-600' :
            'bg-emerald-900/20 border-emerald-600'
          }`}>
            <div className="flex items-start gap-4">
              <div className="text-2xl">{subagent.status === 'running' ? '🔄' : '✅'}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className={`font-bold ${
                    subagent.type === 'explore' ? 'text-cyan-400' :
                    subagent.type === 'task' ? 'text-amber-400' :
                    'text-emerald-400'
                  }`}>
                    {subagent.name} Subagent — ISOLATED CONTEXT
                  </div>
                  <div className="text-xs text-gray-400">
                    Internal: {(subagent.internalTokens/1000).toFixed(1)}k / {(subagent.maxInternalTokens/1000)}k tokens
                  </div>
                </div>
                
                {/* Subagent's own context bar */}
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                  <div 
                    className={`h-full transition-all duration-100 ${
                      subagent.type === 'explore' ? 'bg-cyan-500' :
                      subagent.type === 'task' ? 'bg-amber-500' :
                      'bg-emerald-500'
                    }`}
                    style={{ width: `${(subagent.internalTokens / subagent.maxInternalTokens) * 100}%` }}
                  />
                </div>
                
                {/* Internal messages */}
                <div className="text-xs space-y-1 mb-3 max-h-20 overflow-y-auto">
                  {subagent.internalMessages.map((msg, i) => (
                    <div key={i} className="text-gray-400 flex justify-between">
                      <span>{msg.text}</span>
                      <span className="text-gray-600">{(msg.tokens/1000).toFixed(0)}k</span>
                    </div>
                  ))}
                  {subagent.status === 'running' && (
                    <div className="text-gray-500 animate-pulse">{subagent.task}</div>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {subagent.status === 'complete' 
                      ? `✓ Done! Only ${subagent.resultTokens} tokens will return to main context (not ${(subagent.internalTokens/1000).toFixed(0)}k!)`
                      : 'Running in isolation — main context unaffected'
                    }
                  </div>
                  {subagent.status === 'complete' && (
                    <button
                      onClick={completeSubagent}
                      className={`px-3 py-1 rounded text-xs ${
                        subagent.type === 'explore' ? 'bg-cyan-700 hover:bg-cyan-600 text-cyan-100' :
                        subagent.type === 'task' ? 'bg-amber-700 hover:bg-amber-600 text-amber-100' :
                        'bg-emerald-700 hover:bg-emerald-600 text-emerald-100'
                      }`}
                    >
                      Return result to main →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Main Content - Two Column Layout */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Left Column: Context Usage + System */}
          <div className="space-y-4">
            {/* Compact Context Usage Box */}
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <div className="text-gray-400 italic">Context Usage</div>
                <div className={`text-xs font-medium ${getQualityColor(qualityScore)}`}>
                  {getQualityLabel(qualityScore)} ({qualityScore.toFixed(0)}%)
                </div>
              </div>
              
              {/* Quality indicator bar */}
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-2">
                <div 
                  className={`h-full transition-all duration-300 ${
                    qualityScore >= 80 ? 'bg-emerald-500' :
                    qualityScore >= 60 ? 'bg-yellow-500' :
                    qualityScore >= 40 ? 'bg-orange-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${qualityScore}%` }}
                />
              </div>
              
              <div className="grid grid-cols-10 gap-0.5 leading-tight text-sm mb-3">
                {renderGrid()}
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                <div><span className="text-slate-400">⛁</span> System prompt: {(systemPromptLayers[0].tokens/1000).toFixed(1)}k ({pct(systemPromptLayers[0].tokens)}%)</div>
                <div><span className="text-slate-500">⛁</span> System tools: {(systemPromptLayers[1].tokens/1000).toFixed(1)}k ({pct(systemPromptLayers[1].tokens)}%)</div>
                <div><span className="text-cyan-500">⛁</span> MCP tools: {(systemPromptLayers[2].tokens/1000).toFixed(1)}k ({pct(systemPromptLayers[2].tokens)}%)</div>
                <div><span className="text-indigo-400">⛁</span> Custom agents: {(systemPromptLayers[3].tokens/1000).toFixed(1)}k ({pct(systemPromptLayers[3].tokens)}%)</div>
                <div><span className="text-purple-500">⛁</span> Memory files: {(systemPromptLayers[4].tokens/1000).toFixed(1)}k ({pct(systemPromptLayers[4].tokens)}%)</div>
                <div><span className="text-emerald-400">⛁</span> Messages: {(convoTokens/1000).toFixed(1)}k ({pct(convoTokens)}%)</div>
                <div><span className="text-gray-700">⛶</span> Free: {(freeSpace/1000).toFixed(1)}k ({pct(freeSpace)}%)</div>
                {autocompactEnabled && <div><span className="text-gray-500">⛝</span> Autocompact buffer: {(autocompactBuffer/1000)}k ({pct(autocompactBuffer)}%)</div>}
              </div>
            </div>
            
            {/* System Prompt */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
              <div className="px-3 py-2 bg-blue-900/30 text-xs text-blue-300 uppercase tracking-wider border-b border-gray-800">
                System (Always Preserved)
              </div>
              <div className="p-2 space-y-1">
                {systemPromptLayers.map((layer, i) => (
                  <div key={i} className={`${layer.color} rounded p-2 border border-white/10 text-xs`}>
                    <div className="flex justify-between">
                      <span className="text-white">{layer.name}</span>
                      <span className="text-white/50">{(layer.tokens/1000).toFixed(1)}k</span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* CLAUDE.md Size Slider */}
              <div className="p-2 border-t border-gray-800">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>CLAUDE.md Size</span>
                  <span className="text-purple-400">{(claudeMdSize/1000).toFixed(1)}k tokens</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="15000"
                  step="500"
                  value={claudeMdSize}
                  onChange={(e) => setClaudeMdSize(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>0.5k (minimal)</span>
                  <span>15k (extensive)</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column: Conversation History (full height) */}
          <div className="col-span-2 bg-gray-900 rounded-lg border border-gray-800 overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-emerald-900/30 text-xs text-emerald-300 uppercase tracking-wider border-b border-gray-800 flex justify-between">
              <span>Conversation History</span>
              <span>{(convoTokens/1000).toFixed(1)}k tokens</span>
            </div>
            <div className="p-2 flex-1 overflow-y-auto space-y-1 min-h-48">
              {messages.length === 0 ? (
                <div className="text-gray-500 text-center py-8 border border-dashed border-gray-700 rounded h-full flex items-center justify-center">
                  Click "Next →" or "+6 msgs ⚡" to see context grow
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={msg.id}
                    className={`rounded p-2 border text-xs ${
                      msg.isCompacted
                        ? 'bg-violet-900/30 border-violet-600/50'
                        : msg.role === 'user'
                        ? 'bg-green-900/20 border-green-800/50'
                        : 'bg-orange-900/20 border-orange-800/50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className={
                        msg.isCompacted ? 'text-violet-400' :
                        msg.role === 'user' ? 'text-green-400' : 'text-orange-400'
                      }>
                        {msg.isCompacted ? '📋' : msg.role === 'user' ? '👤' : '🤖'} {msg.content}
                      </span>
                      <span className="text-gray-500 ml-2 whitespace-nowrap">{(msg.tokens/1000).toFixed(1)}k</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* Tips */}
        <div className="mt-4 grid grid-cols-4 gap-3 text-xs">
          <div className="bg-gray-900 rounded p-3 border border-gray-800">
            <div className="text-blue-400 font-medium mb-1">💡 Manual Compact</div>
            <div className="text-gray-400">
              <code className="bg-black/50 px-1 rounded">/compact</code> lets you control when summarization happens.
            </div>
          </div>
          <div className="bg-gray-900 rounded p-3 border border-gray-800">
            <div className="text-cyan-400 font-medium mb-1">🔗 Subagents</div>
            <div className="text-gray-400">
              Run in isolated context. Only results return to main — internal work discarded.
            </div>
          </div>
          <div className="bg-gray-900 rounded p-3 border border-gray-800">
            <div className="text-purple-400 font-medium mb-1">📄 CLAUDE.md Trade-off</div>
            <div className="text-gray-400">
              Larger = more context for Claude, but less room for conversation.
            </div>
          </div>
          <div className="bg-gray-900 rounded p-3 border border-gray-800">
            <div className="text-amber-400 font-medium mb-1">⚠️ What's Lost</div>
            <div className="text-gray-400">
              Exact code snippets, file contents, verbose outputs → high-level summaries.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
