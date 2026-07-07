import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <SignUp
        appearance={{
          variables: {
            colorBackground: "#1f1f27",
            colorPrimary: "#c0c1ff",
            colorText: "#e4e1ed",
            colorTextSecondary: "#c7c4d7",
            colorInputBackground: "#292932",
            colorInputText: "#e4e1ed",
            borderRadius: "0.5rem",
          },
        }}
      />
    </div>
  );
}
