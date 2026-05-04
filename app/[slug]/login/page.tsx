'use client';

import { useState, useEffect } from 'react';
import { useParams } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const { slug } = useParams();
  const [academy, setAcademy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAcademy() {
      const { data } = await supabase
        .from('ams_academies')
        .select('*')
        .eq('slug', slug)
        .single();
      
      if (data) setAcademy(data);
      setLoading(false);
    }
    fetchAcademy();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-gray-500">
        <Loader2 className="animate-spin mb-4" size={32} />
        <p className="text-[10px] font-black uppercase tracking-[0.4em]">Identifying Academy...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0a0a0a] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1a1a1a] via-[#0a0a0a] to-[#050505]">
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      
      <div className="z-10 w-full max-w-md px-4">
        <LoginForm academy={academy} />
      </div>
    </main>
  );
}
