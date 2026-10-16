import {platformTabForView} from '@/lib/workspace-views';
import {notFound} from 'next/navigation';
import {platformOperationsEnabled} from '@/lib/platform-intelligence/server/ui-flags';
import Workspace from '@/components/workspace';
import ViewerReports from '@/components/viewer-reports';
import {cookies} from 'next/headers';
import CitedLanding from '@/components/cited-landing';
import {sessionUser} from '@/lib/auth';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{view?:string}>}){const user=await sessionUser((await cookies()).get('aeo_session')?.value);if(!user)return <CitedLanding/>;if(user.role==='VIEWER'&&platformTabForView((await searchParams).view??null)!==undefined)notFound();return user.role==='VIEWER'?<ViewerReports user={user}/>:<Workspace user={user} platformIntelligenceEnabled={platformOperationsEnabled()}/>;}
