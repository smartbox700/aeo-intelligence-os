import {chromium} from '@playwright/test';
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {homedir} from 'node:os';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
const font=await readFile(path.join(process.env.WINDIR||'C:\\Windows','Fonts','malgun.ttf'));let fsType;
for(let i=0;i<font.readUInt16BE(4);i++){const at=12+i*16;if(font.toString('ascii',at,at+4)==='OS/2')fsType=font.readUInt16BE(font.readUInt32BE(at+8)+8);}
if(fsType===undefined||(fsType&(2|256|512)))throw new Error('폰트의 문서 포함/부분 포함 권한을 확인하세요.');
const python=process.env.AEO_PDF_PYTHON||path.join(homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','python','python.exe');await access(python);
const browser=await chromium.launch({channel:'msedge',headless:true});let pdf,layout;
try{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:1000,height:1500}});await context.route('**/*',route=>route.abort());const page=await context.newPage();await page.setContent(input.html,{waitUntil:'load'});await page.emulateMedia({media:'print'});await page.evaluate(()=>document.fonts.ready);
 layout=await page.evaluate(()=>{const issues=[];const pages=[...document.querySelectorAll('.page')];for(const [i,p] of pages.entries()){const b=p.getBoundingClientRect(),footer=p.querySelector('footer').getBoundingClientRect();for(const el of p.querySelectorAll('[data-check]')){const r=el.getBoundingClientRect();if(r.left<b.left+30||r.right>b.right-30||r.top<b.top||r.bottom>footer.top-6)issues.push('page '+(i+1)+' block bounds');}const blocks=[...p.querySelectorAll('[data-check]')];for(let a=0;a<blocks.length;a++)for(let c=a+1;c<blocks.length;c++){if(blocks[a].contains(blocks[c])||blocks[c].contains(blocks[a]))continue;const x=blocks[a].getBoundingClientRect(),y=blocks[c].getBoundingClientRect();if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>1&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1)issues.push('page '+(i+1)+' overlap');}}return {ok:pages.length===2&&issues.length===0,issues};});
 if(!layout.ok)throw new Error('A4 레이아웃 검사 실패: '+layout.issues.join(','));pdf=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
}finally{await browser.close();}
const quality=await new Promise((resolve,reject)=>{const child=spawn(python,[path.join(process.cwd(),'scripts','validate-sales-pdf.py')],{windowsHide:true});let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',()=>{});child.on('error',()=>reject(new Error('PDF 검증기 실행 실패')));child.on('close',code=>{try{code===0?resolve(JSON.parse(output)):reject(new Error('PDF 페이지/글꼴 검증 실패'));}catch{reject(new Error('PDF 검증 결과 오류'));}});child.stdin.end(pdf);});
process.stdout.write(JSON.stringify({pdfBase64:pdf.toString('base64'),sha256:createHash('sha256').update(pdf).digest('hex'),pages:quality.pages,quality:{a4:quality.a4,embeddedFonts:quality.embeddedFonts,hangul:quality.hangul,layout:layout.ok},fontEmbeddingBits:fsType}));
