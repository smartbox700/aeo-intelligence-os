import type {Metadata} from 'next';
import './globals.css';
import './pilot.css';
export const metadata:Metadata={title:'CITED | AI가 인용하는 브랜드',description:'실제 응답의 브랜드 언급·추천·출처 인용을 기록하고, 근거로 개선하는 AI 검색 가시성 분석'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>;}
