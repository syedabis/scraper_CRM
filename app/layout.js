import localFont from "next/font/local";
import "./globals.css";

const poppins = localFont({
  variable: "--font-poppins",
  src: [
    {
      path: "../public/fonts/Poppins-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/Poppins-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/Poppins-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/Poppins-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/Poppins-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
});

export const metadata = {
  title: "DataCrumbs Lead Management",
  description: "Capture and track your sales leads efficiently with DataCrumbs Lead Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
