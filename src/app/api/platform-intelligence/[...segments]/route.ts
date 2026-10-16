import {NextRequest} from 'next/server';
import {platformHttpHandler} from '@/lib/platform-intelligence/server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{segments:string[]}>};
export async function GET(req:NextRequest,context:Context){return platformHttpHandler(req,context);}
export async function POST(req:NextRequest,context:Context){return platformHttpHandler(req,context);}
