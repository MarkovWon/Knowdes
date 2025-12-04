import React, { useState, useEffect, useRef } from 'react';
import { generateKnowledgeGraph, expandGraph, generateActionPlan, generateConceptImage, hasApiKey, selectApiKey } from './services/geminiService';
import GraphVisualizer from './components/GraphVisualizer';
import NotebookLMModal from './components/NotebookLMModal';
import { KnowledgeGraphData, GraphNode, PlanResponse, GraphLink } from './types';

const App: React.FC = () => {
  // Config State
  const [apiKeyReady, setApiKeyReady] = useState(false);
  
  // Input State
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState('Beginner');
  
  // Graph State
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [graphError, setGraphError] = useState('');
  const [isExpanding, setIsExpanding] = useState(false);

  // Selection & Subgraph State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());

  // Details State
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  // NotebookLM Integration
  const [showNotebookModal, setShowNotebookModal] = useState(false);

  // File Import Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check API Key on mount
  useEffect(() => {
    const checkKey = async () => {
      const ready = await hasApiKey();
      setApiKeyReady(ready);
    };
    checkKey();
  }, []);

  const handleApiKeySelect = async () => {
    await selectApiKey();
    setApiKeyReady(await hasApiKey());
  };

  // Helper to ensure links only point to existing nodes
  const sanitizeGraphData = (nodes: GraphNode[], links: GraphLink[]): KnowledgeGraphData => {
    const nodeIds = new Set(nodes.map(n => n.id));
    const validLinks = links.filter(l => {
      const sourceId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
      const targetId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
      return nodeIds.has(sourceId as string) && nodeIds.has(targetId as string);
    });
    return { nodes, links: validLinks };
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic) return;

    setLoadingGraph(true);
    setGraphError('');
    setGraphData(null);
    setSelectedNode(null);
    setPlan(null);
    setImageUrl(null);
    setShowPanel(false);
    setSelectedNodeIds(new Set()); 

    try {
      if (!await hasApiKey()) {
        await handleApiKeySelect();
      }
      
      const data = await generateKnowledgeGraph(topic, status);
      const sanitized = sanitizeGraphData(data.nodes, data.links);
      setGraphData(sanitized);
    } catch (err: any) {
      setGraphError(err.message || "Failed to generate graph");
    } finally {
      setLoadingGraph(false);
    }
  };

  const handleExport = () => {
    if (!graphData) return;
    
    const exportData = {
      version: 1,
      topic,
      status,
      graphData
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${topic.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'knowledge-graph'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // Basic validation
        if (parsed.graphData && Array.isArray(parsed.graphData.nodes) && Array.isArray(parsed.graphData.links)) {
          const sanitized = sanitizeGraphData(parsed.graphData.nodes, parsed.graphData.links);
          setGraphData(sanitized);
          if (parsed.topic) setTopic(parsed.topic);
          if (parsed.status) setStatus(parsed.status);
          
          // Reset interaction states
          setSelectedNode(null);
          setPlan(null);
          setImageUrl(null);
          setShowPanel(false);
          setSelectedNodeIds(new Set());
          setGraphError('');
        } else {
          // Fallback for raw graph data without metadata
          if (Array.isArray(parsed.nodes) && Array.isArray(parsed.links)) {
             const sanitized = sanitizeGraphData(parsed.nodes, parsed.links);
             setGraphData(sanitized);
             setGraphError('');
          } else {
             throw new Error("Invalid file format");
          }
        }
      } catch (err) {
        console.error(err);
        setGraphError("Failed to import graph: Invalid JSON format.");
      }
    };
    reader.readAsText(file);
    
    // Reset input
    e.target.value = '';
  };

  const handleExpandSelection = async () => {
    if (!graphData || !graphData.nodes || selectedNodeIds.size === 0) return;

    setIsExpanding(true);
    setGraphError('');

    try {
      // Prepare data for API
      const selectedNodes = graphData.nodes
        .filter(n => selectedNodeIds.has(n.id))
        .map(n => ({ id: n.id, label: n.label }));

      const newData = await expandGraph(selectedNodes, topic);

      // Merge Data
      setGraphData(prevData => {
        if (!prevData) return newData;
        
        const newNodesRaw = newData?.nodes || [];
        const newLinksRaw = newData?.links || [];

        // Prevent duplicate nodes by ID
        const existingIds = new Set(prevData.nodes.map(n => n.id));
        const uniqueNewNodes = newNodesRaw.filter(n => !existingIds.has(n.id));

        // Nodes to be in the new graph
        const mergedNodes = [...prevData.nodes, ...uniqueNewNodes];
        const allNodeIds = new Set(mergedNodes.map(n => n.id));

        // Merge links and filter duplicates
        const existingLinks = new Set(prevData.links.map(l => {
            const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
            const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
            return `${s}-${t}`;
        }));
        
        const uniqueNewLinks = newLinksRaw.filter(l => {
           const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
           const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
           return !existingLinks.has(`${s}-${t}`);
        });

        const mergedLinks = [...prevData.links, ...uniqueNewLinks];

        // Critical: Filter out links that point to missing nodes
        const validLinks = mergedLinks.filter(l => {
            const s = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
            const t = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
            return allNodeIds.has(s as string) && allNodeIds.has(t as string);
        });

        return {
          nodes: mergedNodes,
          links: validLinks
        };
      });

    } catch (err: any) {
      console.error(err);
      // Optional: Show a toast or small error, but keeping UI clean
    } finally {
      setIsExpanding(false);
    }
  };

  const handleNodeClick = async (node: GraphNode) => {
    if (isSelectionMode) {
      // Toggle selection
      const newSet = new Set(selectedNodeIds);
      if (newSet.has(node.id)) {
        newSet.delete(node.id);
      } else {
        newSet.add(node.id);
      }
      setSelectedNodeIds(newSet);
      return;
    }

    // Normal Details Mode
    setSelectedNode(node);
    setShowPanel(true);
    setLoadingDetails(true);
    setPlan(null);
    setImageUrl(null);

    try {
      const planPromise = generateActionPlan(node.label, status, topic);
      const imagePromise = generateConceptImage(
        `A clear, educational, digital art illustration representing the concept: ${node.label} in the context of ${topic}.`, 
        "1:1"
      );

      const [planResult, imageResult] = await Promise.allSettled([planPromise, imagePromise]);

      if (planResult.status === 'fulfilled') {
        setPlan(planResult.value);
      }
      if (imageResult.status === 'fulfilled') {
        setImageUrl(imageResult.value);
      }
    } catch (e) {
      console.error("Error fetching details", e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const getSelectedNodesList = () => {
    if (!graphData || !graphData.nodes) return [];
    return graphData.nodes.filter(n => selectedNodeIds.has(n.id));
  };

  if (!apiKeyReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
        <div className="max-w-md text-center space-y-6 p-8 bg-gray-900 rounded-xl border border-gray-800 shadow-2xl">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            Knowledge Graph Learner
          </h1>
          <p className="text-gray-400">
            Please select a paid API key (Gemini 2.5 Flash & 3 Pro) to continue.
          </p>
          <button 
            onClick={handleApiKeySelect}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-all shadow-lg shadow-blue-900/50"
          >
            Select API Key
          </button>
          <div className="text-xs text-gray-500">
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-blue-400">
              Billing Information
            </a>
          </div>
        </div>
      </div>
    );
  }

  const selectedNodesList = getSelectedNodesList();

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept=".json" 
      />
      
      {/* Header */}
      <header className="flex-none p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm z-10">
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row items-center gap-4 justify-between">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Knowledge Graph Learner
          </h1>
          
          <div className="flex flex-1 w-full gap-4 items-center justify-end">
            <form onSubmit={handleGenerate} className="flex flex-1 max-w-2xl gap-2">
              <input
                type="text"
                placeholder="Topic (e.g. Machine Learning)"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500 text-sm"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
              <input
                type="text"
                placeholder="Status"
                className="w-24 md:w-32 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-500 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              />
              <button
                type="submit"
                disabled={loadingGraph || !topic}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 rounded-lg font-medium text-white shadow-lg shadow-blue-900/20 text-sm whitespace-nowrap"
              >
                {loadingGraph ? 'Map It' : 'Map It'}
              </button>
            </form>

            <div className="h-8 w-px bg-gray-700 mx-2 hidden md:block"></div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowNotebookModal(true)}
                disabled={!graphData}
                className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-blue-400 hover:text-white hover:bg-gray-700 hover:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Connect/Export to NotebookLM"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </button>
              
              <div className="h-8 w-px bg-gray-700 mx-1 hidden md:block"></div>

               <button
                onClick={handleImportClick}
                className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
                title="Import Graph"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </button>
               <button
                onClick={handleExport}
                disabled={!graphData}
                className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Export Graph"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            </div>

            <button
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                isSelectionMode 
                  ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              {isSelectionMode ? 'Selection ON' : 'Selection OFF'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative flex">
        
        {/* Graph Area */}
        <div className="flex-1 h-full relative p-4">
          {loadingGraph ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
              <p className="text-blue-200 animate-pulse">Consulting the oracle...</p>
            </div>
          ) : graphError ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-red-900/20 border border-red-800 p-6 rounded-xl max-w-md text-center">
                <h3 className="text-red-400 font-bold mb-2">Error</h3>
                <p className="text-gray-300">{graphError}</p>
              </div>
            </div>
          ) : graphData ? (
            <GraphVisualizer 
              data={graphData} 
              onNodeClick={handleNodeClick} 
              selectedNodeIds={selectedNodeIds}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 space-y-4">
              <svg className="w-24 h-24 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-lg">Enter a topic above to generate your learning path.</p>
              <div className="flex gap-2">
                 <button onClick={handleImportClick} className="text-sm text-blue-400 hover:underline">
                   Or import an existing graph
                 </button>
              </div>
            </div>
          )}

          {/* Subgraph / Focus Area Panel */}
          {selectedNodesList.length > 0 && (
            <div className="absolute left-4 bottom-4 z-20 w-72 md:w-96 bg-gray-900/90 backdrop-blur border border-emerald-500/30 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[50%] transition-all">
              <div className="p-3 bg-emerald-900/20 border-b border-emerald-500/20 flex justify-between items-center">
                <h3 className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Focus Group ({selectedNodesList.length})
                </h3>
                <button 
                  onClick={() => setSelectedNodeIds(new Set())} 
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Clear
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {selectedNodesList.map(node => (
                  <div key={node.id} className="p-2 bg-gray-800/50 rounded border border-gray-700/50 flex justify-between items-center group">
                    <span className="text-sm text-gray-200 truncate">{node.label}</span>
                    <button 
                      onClick={() => handleNodeClick(node)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-emerald-400"
                      title="View Details"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-gray-800/50 border-t border-gray-700/50">
                 <button
                   onClick={handleExpandSelection}
                   disabled={isExpanding}
                   className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-md text-sm font-semibold shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all"
                 >
                   {isExpanding ? (
                     <>
                       <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                       Expanding...
                     </>
                   ) : (
                     <>
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                       </svg>
                       Expand / Subdivide
                     </>
                   )}
                 </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Side Panel */}
        {showPanel && (
          <div className="w-full md:w-[450px] bg-gray-900/95 backdrop-blur border-l border-gray-800 absolute right-0 top-0 bottom-0 z-30 shadow-2xl flex flex-col transition-all transform duration-300">
            <div className="flex justify-between items-center p-4 border-b border-gray-800">
              <h2 className="font-bold text-lg text-white truncate pr-4">
                {selectedNode?.label || 'Concept Details'}
              </h2>
              <button 
                onClick={() => setShowPanel(false)}
                className="p-1 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetails ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-48 bg-gray-800 rounded-lg w-full"></div>
                  <div className="h-4 bg-gray-800 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-800 rounded w-1/2"></div>
                  <div className="h-32 bg-gray-800 rounded w-full"></div>
                </div>
              ) : selectedNode ? (
                <>
                  {imageUrl && (
                    <div className="rounded-xl overflow-hidden shadow-lg border border-gray-700 relative group">
                       <img src={imageUrl} alt={selectedNode.label} className="w-full h-auto object-cover" />
                       <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-xs text-center text-gray-300 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                         Generated by Gemini 3 Pro
                       </div>
                    </div>
                  )}

                  <div className="prose prose-invert prose-sm max-w-none">
                    <h3 className="text-blue-400 text-sm font-semibold uppercase tracking-wider mb-2">
                      Description
                    </h3>
                    <p className="text-gray-300 mb-6 leading-relaxed">
                      {selectedNode.description}
                    </p>

                    {plan ? (
                      <>
                         <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
                           {plan.markdown.split('\n').map((line, i) => {
                             if (line.startsWith('###')) return <h3 key={i} className="text-lg font-bold text-white mt-4 mb-2">{line.replace('###', '')}</h3>;
                             if (line.startsWith('##')) return <h2 key={i} className="text-xl font-bold text-white mt-4 mb-2">{line.replace('##', '')}</h2>;
                             if (line.startsWith('1.') || line.startsWith('-')) return <div key={i} className="ml-4 text-gray-300 mb-1">{line}</div>;
                             if (line.trim() === '') return <br key={i}/>;
                             return <p key={i} className="mb-2 text-gray-300">{line}</p>;
                           })}
                         </div>

                         {plan.sources.length > 0 && (
                           <div className="mt-6 pt-4 border-t border-gray-800">
                             <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                               Grounded Sources
                             </h4>
                             <ul className="space-y-2">
                               {plan.sources.map((source, idx) => (
                                 <li key={idx}>
                                   <a 
                                     href={source.uri} 
                                     target="_blank" 
                                     rel="noopener noreferrer"
                                     className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors truncate"
                                   >
                                     <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                     </svg>
                                     <span className="truncate">{source.title}</span>
                                   </a>
                                 </li>
                               ))}
                             </ul>
                           </div>
                         )}
                      </>
                    ) : (
                      <div className="text-yellow-500 text-sm">Failed to generate action plan.</div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        <NotebookLMModal 
          isOpen={showNotebookModal}
          onClose={() => setShowNotebookModal(false)}
          topic={topic}
          status={status}
          graphData={graphData}
          selectedNode={selectedNode}
          plan={plan}
        />
      </main>
    </div>
  );
};

export default App;