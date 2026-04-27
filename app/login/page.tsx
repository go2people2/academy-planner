import { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Login | Academy Management",
  description: "Secure login for academy teachers.",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0a0a0a] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1a1a1a] via-[#0a0a0a] to-[#050505]">
      {/* Subtle Grid Pattern Overlay */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      
      <div className="z-10 w-full max-w-md px-4">
        <LoginForm />
      </div>
    </main>
  );
}
