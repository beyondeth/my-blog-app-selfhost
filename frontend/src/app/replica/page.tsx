"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

// Mock Data
const BOOKS = [
  {
    id: 1,
    title: "Ontology Master",
    author: "H. Gildong",
    price: "16,000원",
    coverStyle: "blue-geometric",
  },
  {
    id: 2,
    title: "The Future of AI",
    author: "C. Soo",
    price: "14,400원",
    coverStyle: "organic-map",
  },
  {
    id: 3,
    title: "Humanities in Digital Age",
    author: "Y. Hee",
    price: "17,600원",
    coverStyle: "column",
  },
  {
    id: 4,
    title: "Visualizing Data",
    author: "T. Joon",
    price: "25,600원",
    coverStyle: "circles",
  },
];

const TABS = ["All", "Technology", "Society", "Humanities"];

export default function ReplicaPage() {
  const [activeTab, setActiveTab] = useState("All");

  return (
    <div className="min-h-screen bg-[#F4F1EA] text-[#2C2A29] selection:bg-[#D6Cfc7] selection:text-[#2C2A29]">
       {/* Background Paper Texture Effect */}
       <div className="fixed inset-0 opacity-[0.04] pointer-events-none z-0 mix-blend-multiply" 
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
       </div>

      <div className="max-w-[1600px] mx-auto px-6 py-12 md:px-12 md:py-16 lg:px-24 lg:py-20 relative z-10">
      
      {/* Header */}
      <header className="flex justify-between items-start mb-32 md:mb-40">
        <h1 className="text-3xl font-bold tracking-tight italic font-serif">Ontology.</h1>
        <div className="flex items-center gap-8 text-[11px] tracking-[0.2em] font-sans uppercase text-[#5C5A57]">
            <span className="cursor-pointer hover:text-black transition-colors border-b border-transparent hover:border-black/50 pb-0.5">Selection (4)</span>
            <span className="font-bold text-[#2C2A29] cursor-pointer">Bronze Reader</span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-32 items-end">
        <div className="lg:col-span-7">
            <h2 className="text-6xl md:text-8xl lg:text-[7rem] leading-[1.05] mb-10 font-normal text-[#2C2A29] font-serif tracking-tight">
                Curated for the <br />
                <span className="italic font-light text-[#3C3A38]">Thoughtful</span> Mind.
            </h2>
            <p className="text-[#5C5A57] italic text-lg md:text-xl max-w-lg leading-relaxed font-serif pl-1">
                A hand-picked selection of books exploring technology, society, and the human condition.
            </p>
        </div>
        
        <div className="lg:col-span-5 w-full flex flex-col justify-end pb-3">
             {/* Search Input */}
             <div className="relative w-full ml-auto group">
                <input 
                    type="text" 
                    placeholder="Search our collection..." 
                    className="w-full bg-transparent border-b border-[#8C8A87] py-4 text-lg font-serif placeholder:text-[#8C8A87]/70 text-[#2C2A29] focus:outline-none focus:border-[#2C2A29] transition-all duration-300"
                />
             </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-10 mb-24 border-b border-transparent pl-1">
        {TABS.map((tab) => (
            <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-xs tracking-[0.15em] transition-all duration-500 pb-2 border-b uppercase font-sans ${
                    activeTab === tab 
                    ? "font-bold text-[#2C2A29] border-[#2C2A29]" 
                    : "text-[#8C8A87] border-transparent hover:text-[#5C5A57]"
                }`}
            >
                {tab}
            </button>
        ))}
      </div>

      {/* Grid - Staggered Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-20">
        {BOOKS.map((book, index) => (
            <div 
                key={book.id} 
                className={`group cursor-pointer transition-transform duration-700 ease-out ${index % 2 === 1 ? "lg:translate-y-24" : ""}`}
            >
                {/* Book Cover Frame */}
                <div className="bg-[#D1D0CD] aspect-[4/5] mb-8 relative transition-all duration-500 group-hover:bg-[#C8C7C4] shadow-sm group-hover:shadow-md flex items-center justify-center p-8">
                   {/* Book Object */}
                   <div className="w-full h-full bg-[#EAE8E2] shadow-[5px_0_15px_-5px_rgba(0,0,0,0.1),-2px_0_5px_rgba(0,0,0,0.05)] relative overflow-hidden transition-transform duration-500 group-hover:scale-[1.02] group-hover:-translate-y-1">
                        {/* Spine Hint */}
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-r from-black/10 to-transparent z-10"></div>
                        <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-black/5 z-10"></div>
                        
                         {book.coverStyle === 'blue-geometric' && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-40 h-40 border border-[#2B3A4F] rounded-full relative">
                                    <div className="absolute inset-4 border border-[#9CA3AF] rounded-full"></div>
                                    <div className="absolute top-0 right-0 w-1/2 h-full bg-[#2B3A4F] mix-blend-multiply opacity-90"></div>
                                    <div className="absolute bottom-10 left-[-20px] w-12 h-12 bg-[#2B3A4F] rounded-full"></div>
                                </div>
                            </div>
                         )}
                         {book.coverStyle === 'organic-map' && (
                             <div className="absolute inset-0 opacity-70">
                                 <svg viewBox="0 0 100 100" className="w-full h-full fill-[#9C9480] opacity-50">
                                     <path d="M0 100 C 20 0 50 0 100 100 Z" />
                                     <path d="M0 0 C 50 100 80 100 100 0 Z" fill="#D4D4CE" opacity="0.5"/>
                                 </svg>
                                 <div className="absolute top-10 left-10 w-20 h-[1px] bg-black/20"></div>
                             </div>
                         )}
                         {book.coverStyle === 'column' && (
                             <div className="absolute inset-0 flex items-center justify-center p-8">
                                 <div className="text-center">
                                     <h3 className="text-[9px] uppercase tracking-[0.2em] mb-4 text-[#2C2A29]">Humanitas</h3>
                                     <div className="w-12 h-20 mx-auto bg-gradient-to-br from-[#1E3A8A] to-[#60A5FA] opacity-80" style={{clipPath: 'polygon(0% 0%, 100% 0%, 100% 85%, 50% 100%, 0% 85%)'}}></div>
                                 </div>
                             </div>
                         )}
                         {book.coverStyle === 'circles' && (
                             <div className="absolute inset-0 flex items-center justify-center">
                                 <div className="w-28 h-28 border-[1px] border-[#2B3A4F] rounded-full flex items-center justify-center">
                                     <div className="w-16 h-16 bg-[#2B3A4F] rounded-full"></div>
                                 </div>
                                 <div className="absolute top-10 right-10 w-16 h-40 border-l border-[#2B3A4F]"></div>
                             </div>
                         )}
                   </div>
                </div>

                {/* Info */}
                <h3 className="text-xl font-normal mb-2 line-clamp-1 font-serif text-[#2C2A29] group-hover:text-black transition-colors">{book.title}</h3>
                <p className="text-[11px] text-[#5C5A57] mb-4 font-sans tracking-wide uppercase">by {book.author}</p>
                <p className="text-[#8C5E45] mb-6 font-serif tracking-widest text-sm">{book.price}</p>

                {/* Button */}
                <button className="w-full py-4 border border-[#2C2A29]/30 font-sans text-[10px] font-bold tracking-[0.25em] text-[#2C2A29] hover:bg-[#2C2A29] hover:text-[#F4F1EA] hover:border-[#2C2A29] transition-all duration-300 uppercase">
                    Add to selection
                </button>
            </div>
        ))}
      </div>
     </div>
    </div>
  );
}
