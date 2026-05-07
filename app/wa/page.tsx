"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import UserGuard from "@/components/auth/UserGuard";
import Navbar from "@/components/ui/Navbar";
import Sidebar from "@/components/ui/Sidebar";
import WaGroupSender from "@/components/wa/WaGroupSender";

export default function WaPage() {
  const { data: session } = useSession();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

  return (
    <UserGuard>
      <div className="min-h-screen bg-[#050505] flex">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} isAdmin={isAdmin} />

        <div className="flex-1 flex min-w-0 flex-col">
          <Navbar setSidebarOpen={setIsSidebarOpen} />

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
              <WaGroupSender />
            </div>
          </main>
        </div>
      </div>
    </UserGuard>
  );
}

