import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ontology | Curated for the Thoughtful Mind",
  description: "A hand-picked selection of books exploring technology, society, and the human condition.",
};

export default function ReplicaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1a1a1a] font-serif antialiased selection:bg-[#EAE0D5] selection:text-[#1a1a1a]">
      {children}
    </div>
  );
}
