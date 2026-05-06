"use client";

import XPromptGenerator from "@/components/x/XPromptGenerator";

export default function ContentPage() {
  return (
    <main className="min-h-screen bg-[#050505] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <XPromptGenerator />
      </div>
    </main>
  );
}

