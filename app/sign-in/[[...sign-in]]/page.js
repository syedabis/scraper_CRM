import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#f4f4f8] flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-[#13131b] mb-1">Cognos Sales CRM</h1>
        <p className="text-[#54536b]">Your portal to high-velocity sales</p>
      </div>
      <SignIn
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
