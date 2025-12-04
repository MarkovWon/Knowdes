import React, { useState, useEffect } from 'react';
import { KnowledgeGraphData, GraphNode, PlanResponse } from '../types';

interface NotebookLMModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: string;
  status: string;
  graphData: KnowledgeGraphData | null;
  selectedNode: GraphNode | null;
  plan: PlanResponse | null;
}

const NotebookLMModal: React.FC<NotebookLMModalProps> = ({
  isOpen, onClose, topic, status, graphData, selectedNode, plan
}) => {
  const [content, setContent] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!graphData) return;

    let text = `# Knowledge Graph: ${topic}\n`;
    text += `**User Status/Level:** ${status}\n\n`;
    text += `## Concept Overview\n`;
    text += `This document contains the structured learning path generated for ${topic}.\n\n`;

    // Group nodes
    const groups: {[key: string]: GraphNode[]} = {};
    graphData.nodes.forEach(node => {
        if (!groups[node.group]) groups[node.group] = [];
        groups[node.group].push(node);
    });

    Object.keys(groups).forEach(group => {
        text += `### ${group}\n`;
        groups[group].forEach(node => {
            text += `- **${node.label}**: ${node.description}\n`;
        });
        text += '\n';
    });

    if (selectedNode && plan) {
        text += `\n---\n\n`;
        text += `## Deep Dive: ${selectedNode.label}\n`;
        text += `**Context:** Part of ${selectedNode.group}\n\n`;
        text += `### Learning Action Plan\n`;
        text += plan.markdown + '\n\n';
        
        if (plan.sources && plan.sources.length > 0) {
            text += `### Verified Sources\n`;
            plan.sources.forEach(src => {
                text += `- [${src.title}](${src.uri})\n`;
            });
        }
    } else {
        text += `\n---\n`;
        text += `> Note: Select specific nodes in the Knowledge Graph Learner app and generate action plans to append more detailed study materials to this export.\n`;
    }

    setContent(text);
  }, [topic, status, graphData, selectedNode, plan, isOpen]);

  const handleCopy = async () => {
    try {
        await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    } catch (err) {
        console.error('Failed to copy', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${topic.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-notebook-source.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
                <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                    Export to NotebookLM
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                    Direct API integration is currently unavailable. Use this optimized source file to add this knowledge to your Notebook.
                </p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6 flex flex-col gap-4">
            <div className="text-sm text-gray-400 flex justify-between items-center">
                <span>Preview of generated source content:</span>
                <span className="text-xs bg-gray-800 px-2 py-1 rounded border border-gray-700">Markdown Format</span>
            </div>
            <textarea 
                readOnly
                value={content}
                className="w-full flex-1 bg-gray-950 border border-gray-800 rounded-lg p-4 font-mono text-sm text-gray-300 focus:outline-none resize-none shadow-inner custom-scrollbar"
                style={{ minHeight: '300px' }}
            />
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 bg-gray-900/50 flex flex-col md:flex-row gap-4 justify-between items-center rounded-b-xl">
            <a 
                href="https://notebooklm.google.com/" 
                target="_blank" 
                rel="noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors"
            >
                Open NotebookLM
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
            
            <div className="flex gap-3 w-full md:w-auto">
                <button
                    onClick={handleDownload}
                    className="flex-1 md:flex-none px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700 border border-gray-700 font-medium text-sm transition-all"
                >
                    Download .txt Source
                </button>
                <button
                    onClick={handleCopy}
                    className="flex-1 md:flex-none px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-500 hover:to-purple-500 font-medium text-sm shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2 transition-all"
                >
                    {copied ? (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Copied!
                        </>
                    ) : (
                        <>
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                           Copy as Source
                        </>
                    )}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NotebookLMModal;