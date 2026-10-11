'use client';
import Link from 'next/link';
import {useEffect,useState,type ReactNode} from 'react';
import './cited.css';
export default function CitedShell({children}:{children:ReactNode}){
 const [projectId,setProjectId]=useState('');
 useEffect(()=>{const sync=()=>setProjectId(new URLSearchParams(location.search).get('projectId')??'');sync();window.addEventListener('cited-project-change',sync);return()=>window.removeEventListener('cited-project-change',sync);},[]);
 const query=projectId?'?projectId='+encodeURIComponent(projectId):'';
 return <div className="cited"><header className="cited-header"><Link href="/welcome" className="cited-logo"><span>❞</span> CITED<span className="cited-logo-note">AI가 인용하는 브랜드</span></Link><nav aria-label="CITED 메뉴"><Link href={'/diagnosis'+query}>고객 진단</Link><Link href={'/report'+query}>진단 리포트</Link><Link href="/welcome#pricing">가격</Link><Link href="/blog/aeo-marketing-1">가이드</Link><Link href={projectId?'/os'+query+'&view=cited':'/os'} className="cited-outline">{projectId?'고객 OS':'운영 OS'}</Link></nav></header>{children}<footer className="cited-footer"><Link href="/welcome" className="cited-logo">CITED</Link><p>근거로 측정하고, 데이터로 개선합니다.</p><Link href={'/diagnosis'+query}>무료 수동 진단 시작 ↗</Link><small>브랜드 언급·추천·인용을 구분합니다. AI 응답과 검색 결과의 특정 순위 또는 개선 수치를 보장하지 않습니다.</small></footer></div>;
}
