"use client";

import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Video,
  Briefcase,
  Instagram,
  Sparkles,
  LogOut,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  isAdmin: boolean;
}

export default function Sidebar({ isOpen, setIsOpen, isAdmin }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const youtubeAccess = (session?.user as { youtubeAccess?: boolean } | undefined)?.youtubeAccess;
  const linkedinAccess = (session?.user as { linkedinAccess?: boolean } | undefined)?.linkedinAccess;
  const instagramAccess = (session?.user as { instagramAccess?: boolean } | undefined)?.instagramAccess;
  const xAccess = (session?.user as { xAccess?: boolean } | undefined)?.xAccess;
  
  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    ...((isAdmin || youtubeAccess) ? [{ icon: Video, label: "YouTube", href: "/youtube" }] : []),
    ...((isAdmin || linkedinAccess) ? [{ icon: Briefcase, label: "LinkedIn", href: "/linkedin" }] : []),
    ...((isAdmin || instagramAccess) ? [{ icon: Instagram, label: "Instagram", href: "/instagram" }] : []),
    ...((isAdmin || xAccess) ? [{ icon: Sparkles, label: "X", href: "/x" }] : []),
    ...(isAdmin ? [{ icon: Users, label: "Team", href: "/team" }] : []),
  ];

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-72 bg-[#0a0a0a]/95 backdrop-blur-xl border-r border-white/5 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 flex items-center gap-3">
             <div className="relative w-10 h-10">
                <Image src="/logo.png" alt="Logo" fill className="object-contain" />
             </div>
             <span className="font-bold text-xl text-white tracking-tight">Task<span className="text-orange-500">Master</span></span>
             <button onClick={() => setIsOpen(false)} className="ml-auto lg:hidden text-gray-400 hover:text-white transition-colors">
               <X size={24} />
             </button>
          </div>

          <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              const baseClassName = `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-orange-600/20 to-amber-600/10 text-orange-500 border border-orange-500/20" 
                  : "text-gray-400 hover:text-gray-100 hover:bg-white/5"
              }`;

              return (
                <motion.div
                  key={item.label}
                  whileHover={{ scale: 1.02, x: 5 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    href={item.href}
                    onClick={() => {
                      if (window.innerWidth < 1024) setIsOpen(false);
                    }}
                    className={baseClassName}
                  >
                    <item.icon size={20} />
                    <span className="font-medium">{item.label}</span>
                    {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />}
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <div className="p-4 border-t border-white/5">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
            >
              <LogOut size={20} />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

