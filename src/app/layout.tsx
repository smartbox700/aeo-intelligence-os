import type {Metadata} from 'next';
import './globals.css';
import './pilot.css';
export const metadata:Metadata={title:'AEO Intelligence OS',description:'근거로 측정하고, 데이터로 개선하는 AI 검색 가시성 분석'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>;}
