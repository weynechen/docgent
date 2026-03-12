import React from 'react';
import {
  FileEdit,
  Plus,
  Folder,
  FileText,
  History,
  Settings,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  Sparkles,
  X,
  AlignLeft,
  Paperclip,
  AtSign,
  ArrowUp
} from 'lucide-react';

export default function App() {
  return (
    <div className="flex h-screen w-full bg-[#f6f6f8] text-slate-900 font-sans overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-[250px] border-r border-slate-200 flex flex-col bg-slate-50">
        {/* Header */}
        <div className="p-4 flex items-center gap-3 border-b border-slate-200">
          <div className="bg-primary size-8 rounded flex items-center justify-center text-white">
            <FileEdit size={20} />
          </div>
          <h2 className="font-bold text-sm tracking-tight">Lexicon AI</h2>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-6">
          {/* Documents */}
          <section>
            <div className="px-3 mb-2 flex items-center justify-between mt-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Documents</span>
              <button className="text-slate-400 hover:text-primary transition-colors">
                <Plus size={16} />
              </button>
            </div>
            <div className="space-y-0.5">
              <div className="group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-200/50 transition-colors">
                <Folder size={18} className="text-slate-400" />
                <span className="text-sm font-medium">Drafts</span>
              </div>
              <div className="pl-6 space-y-0.5 border-l border-slate-200 ml-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary cursor-pointer border-l-2 border-primary -ml-[1px]">
                  <FileText size={18} />
                  <span className="text-sm font-semibold truncate">Chapter 1: The Silent Echo</span>
                </div>
                <div className="group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-200/50 transition-colors">
                  <FileText size={18} className="text-slate-400" />
                  <span className="text-sm text-slate-600 truncate">Chapter 2: Void Walkers</span>
                </div>
              </div>
              <div className="group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-200/50 transition-colors">
                <Folder size={18} className="text-slate-400" />
                <span className="text-sm font-medium">Research</span>
              </div>
            </div>
          </section>

          {/* Version History */}
          <section>
            <div className="px-3 mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Version History</span>
              <History size={16} className="text-slate-300" />
            </div>
            <div className="space-y-0.5">
              <div className="group flex flex-col px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-200/50 transition-colors">
                <span className="text-xs font-medium">Final Polish</span>
                <span className="text-[10px] text-slate-400">2 hours ago</span>
              </div>
              <div className="group flex flex-col px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-200/50 transition-colors">
                <span className="text-xs font-medium">Structural Edit</span>
                <span className="text-[10px] text-slate-400">Yesterday</span>
              </div>
            </div>
          </section>
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-slate-200 bg-slate-100">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
              JD
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold truncate">John Doe</p>
              <p className="text-[10px] text-slate-400">Pro Plan</p>
            </div>
            <Settings size={16} className="text-slate-400 cursor-pointer hover:text-slate-600" />
          </div>
        </div>
      </aside>

      {/* Center Editor */}
      <main className="flex-1 flex flex-col bg-white relative">
        {/* Floating Toolbar */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-white/80 backdrop-blur-md border border-slate-200 p-1 rounded-xl shadow-sm opacity-40 hover:opacity-100 transition-opacity">
          <button className="p-1.5 rounded hover:bg-slate-100 text-slate-600"><Bold size={16} /></button>
          <button className="p-1.5 rounded hover:bg-slate-100 text-slate-600"><Italic size={16} /></button>
          <button className="p-1.5 rounded hover:bg-slate-100 text-slate-600"><LinkIcon size={16} /></button>
          <div className="w-px h-4 bg-slate-200 mx-1"></div>
          <button className="p-1.5 rounded hover:bg-slate-100 text-slate-600"><List size={16} /></button>
          <button className="p-1.5 rounded hover:bg-primary/10 text-primary"><Sparkles size={16} /></button>
        </div>

        {/* Editor Content */}
        <div className="max-w-[800px] w-full mx-auto px-12 py-24 h-full overflow-y-auto custom-scrollbar">
          <input 
            className="w-full text-4xl font-bold border-none focus:outline-none focus:ring-0 bg-transparent mb-12 placeholder:text-slate-300" 
            type="text" 
            defaultValue="Chapter 1: The Silent Echo" 
          />
          <div className="prose prose-slate max-w-none text-lg leading-relaxed text-slate-700 space-y-6">
            <p>The morning light filtered through the thick canopy of the Elderwood, casting long, wavering shadows across the forest floor. Elara stopped, her hand hovering just inches from the rough bark of the Silver Cedar. She could feel it—a faint, rhythmic hum that seemed to resonate with her very heartbeat.</p>
            <p>She had been warned about the echoes of the deep wood. The elders called them the whispers of the lost, <span className="bg-primary/10 border-b-2 border-primary text-slate-900 font-medium px-0.5">but to Elara, it felt more like a call to return home rather than a warning to stay away.</span> The air grew colder, and the silence became heavy, pressing against her ears until she could hear nothing but the pulse in her own temples.</p>
            <p>Taking a deep breath, she stepped over a twisted root. Every crunch of dry leaves under her boots sounded like a thunderclap in the oppressive quiet. She wasn't alone; the trees themselves seemed to be watching, their gnarled branches reaching down like skeletal fingers in the mist.</p>
            <p>As she reached the clearing, the source of the hum became clear. A monolith of dark obsidian stood at the center, its surface pulsating with a soft, bioluminescent blue light. This was the Echo—the bridge between what was known and the vast, terrifying unknown of the Void.</p>
          </div>
        </div>

        {/* Footer */}
        <footer className="p-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 px-12">
          <div className="flex gap-4">
            <span>342 words</span>
            <span>2,150 characters</span>
          </div>
          <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Synced to Cloud</span>
            <span>UTF-8</span>
          </div>
        </footer>
      </main>

      {/* Right AI Panel */}
      <aside className="w-[320px] border-l border-slate-200 bg-slate-50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white/50">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-tight">AI Chat</h3>
          </div>
          <X size={18} className="text-slate-400 cursor-pointer hover:text-slate-600" />
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
          <div className="space-y-6">
            {/* AI Message */}
            <div className="flex gap-3">
              <div className="size-6 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <Sparkles size={14} />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-xs leading-relaxed text-slate-600">How can I help you with the selected text? I can refine the tone, shorten the passage, or help you expand on the imagery of the "Echo".</p>
              </div>
            </div>

            {/* User Message */}
            <div className="flex gap-3 justify-end">
              <div className="max-w-[85%] bg-white border border-slate-200 shadow-sm p-3 rounded-xl rounded-tr-sm">
                <p className="text-xs text-slate-700 font-medium italic">"...but to Elara, it felt more like a call to return home rather than a warning to stay away."</p>
                <p className="text-xs text-slate-500 mt-2">Make this sound more poetic and visceral.</p>
              </div>
            </div>

            {/* AI Response */}
            <div className="flex gap-3">
              <div className="size-6 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <Sparkles size={14} />
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-xs leading-relaxed text-slate-600">Here is a more evocative version:</p>
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                  <p className="text-xs text-emerald-800 italic">"...yet for Elara, the sensation was less a caution and more a beckoning—a visceral pull toward a home she had never truly left."</p>
                </div>
                <div className="flex gap-3">
                  <button className="text-[11px] font-bold text-primary hover:underline">Apply</button>
                  <button className="text-[11px] font-bold text-slate-400 hover:underline">Discard</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="mb-3 flex items-center">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] text-slate-500 font-medium">
              <AlignLeft size={12} />
              2 lines selected
            </div>
          </div>
          <div className="relative flex items-end gap-2">
            <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
              <textarea 
                className="w-full p-3 text-xs bg-transparent border-none focus:outline-none focus:ring-0 resize-none placeholder:text-slate-400 min-h-[44px] max-h-32" 
                placeholder="Ask or type command..." 
                rows={1}
              ></textarea>
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex gap-1">
                  <button className="p-1.5 rounded hover:bg-slate-100 text-slate-400"><Paperclip size={14} /></button>
                  <button className="p-1.5 rounded hover:bg-slate-100 text-slate-400"><AtSign size={14} /></button>
                </div>
                <button className="bg-primary text-white p-1.5 rounded-lg hover:opacity-90 transition-opacity shadow-sm">
                  <ArrowUp size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
