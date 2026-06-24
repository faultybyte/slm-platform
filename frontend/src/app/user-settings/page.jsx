"use client";

import React, { useState } from 'react';
import { User, Settings, Database, HardDrive, Bell } from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('models');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/30 p-6 flex flex-col gap-2">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Settings</h2>
        
        <button onClick={() => setActiveTab('profile')} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'profile' ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
          <User size={18} /> Account Profile
        </button>
        <button onClick={() => setActiveTab('models')} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'models' ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
          <Database size={18} /> Model Preferences
        </button>
        <button onClick={() => setActiveTab('storage')} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'storage' ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
          <HardDrive size={18} /> Storage & Paths
        </button>
        <button onClick={() => setActiveTab('general')} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'general' ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
          <Settings size={18} /> General
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-10 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Model Preferences</h1>
          <p className="text-slate-400">Configure your default Small Language Models and execution parameters.</p>
        </div>

        {/* Form Sections */}
        <div className="space-y-8">
          
          {/* Section 1 */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 border-b border-slate-800 pb-2">Default Base Model</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Model Selection</label>
                <select className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500">
                  <option>TinyLlama 1.1B Chat (GGUF)</option>
                  <option>Phi-2 2.7B (GGUF)</option>
                  <option>Mistral 7B Instruct (GGUF)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">System Prompt</label>
                <textarea 
                  rows={4} 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
                  defaultValue="You are a helpful, respectful, and honest local AI assistant. Always answer as helpfully as possible."
                ></textarea>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 border-b border-slate-800 pb-2">Execution Parameters</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Temperature (0.0 - 2.0)</label>
                <input type="number" step="0.1" defaultValue="0.7" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-cyan-500" />
                <p className="text-xs text-slate-500 mt-1">Higher values make output more random.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Max Tokens</label>
                <input type="number" defaultValue="2048" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-cyan-500" />
                <p className="text-xs text-slate-500 mt-1">Maximum length of the generated response.</p>
              </div>
            </div>
          </section>

          {/* Save Action */}
          <div className="flex justify-end pt-4">
            <button className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg transition shadow-[0_0_10px_rgba(34,211,238,0.3)]">
              Save Preferences
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}