import { SignIn, SignUp } from "@clerk/nextjs";
import { Dumbbell } from "lucide-react";

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg p-6">
      <div className="flex items-center gap-2 text-h2">
        <Dumbbell size={24} className="text-accent" aria-hidden />
        Gym Platform
      </div>
      {children}
    </div>
  );
}

export function SignInPage() {
  return (
    <AuthShell>
      <SignIn routing="hash" />
    </AuthShell>
  );
}

export function SignUpPage() {
  return (
    <AuthShell>
      <SignUp routing="hash" />
    </AuthShell>
  );
}
