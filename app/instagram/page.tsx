"use client";

import { useSession } from "next-auth/react";
import UserGuard from "@/components/auth/UserGuard";
import InstagramManager from "@/components/instagram/InstagramManager";
import Navbar from "@/components/ui/Navbar";
import Sidebar from "@/components/ui/Sidebar";
import { useState } from "react";

export default function InstagramPage() {
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
              <InstagramManager />
            </div>
          </main>
        </div>
      </div>
    </UserGuard>
  );
}
