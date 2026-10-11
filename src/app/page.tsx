import Workspace from '@/components/workspace';
import ViewerReports from '@/components/viewer-reports';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {sessionUser} from '@/lib/auth';
export const dynamic='force-dynamic';
export default async function Page(){const user=await sessionUser((await cookies()).get('aeo_session')?.value);if(!user)redirect('/login');return user.role==='VIEWER'?<ViewerReports user={user}/>:<Workspace user={user}/>;}
