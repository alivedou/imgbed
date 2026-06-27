import { Inter } from "next/font/google";
import "./globals.css";
import 'react-toastify/dist/ReactToastify.css';
import 'react-toastify/ReactToastify.min.css';
import 'react-photo-view/dist/react-photo-view.css';
import { GoogleAnalytics } from '@next/third-parties/google'


const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "图床",
  description: "图床",
};



export default function RootLayout({ children }) {
  // suppressHydrationWarning: 浏览器扩展(如翻译/暗色模式)可能在 React hydrate 前修改 DOM
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
      {process.env.NEXT_PUBLIC_GA_ID && <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />}
    </html>
  );
}
