import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#f4f4f8] flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-[#13131b] mb-1">Cognos Sales CRM</h1>
        <p className="text-[#54536b]">Create an account to get started</p>
      </div>
      <SignUp
        appearance={{
          variables: {
            colorBackground: "#ffffff",
            colorPrimary: "#494bd6",
            colorText: "#13131b",
            colorTextSecondary: "#54536b",
            colorInputBackground: "#f8f8fb",
            colorInputText: "#13131b",
            borderRadius: "0.75rem",
          },
          elements: {
            card: "shadow-xl border border-[#e5e5ec]",
          },
        }}
      />
    </div>
  );
}
