import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0f" }}>
      <div className="relative">
        <div className="absolute inset-0 blur-3xl opacity-20 rounded-full"
          style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)", transform: "scale(1.5)" }} />
        <div className="relative z-10 mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8h12M8 2l6 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-xl font-semibold" style={{ color: "#e2e2f0" }}>FlowForge</span>
          </div>
          <p className="text-sm" style={{ color: "#8b8ba7" }}>Create your account</p>
        </div>
        <SignUp />
      </div>
    </div>
  );
}
