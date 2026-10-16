/** Existing Pilot tab IDs only. Unknown/future tabs must not mount PilotPanel. */
const pilotViews:Readonly<Record<number,number>>=Object.freeze({28:0,29:1,30:2,31:3,32:4,33:5,34:6});
export function pilotViewForTab(tab:number):number|undefined{return Object.hasOwn(pilotViews,tab)?pilotViews[tab]:undefined;}
export const platformViewTabs={'platform-intelligence':36,'platform-insights':37} as const;
export type PlatformWorkspaceView=keyof typeof platformViewTabs;
export function platformViewForTab(tab:number):PlatformWorkspaceView|undefined{return (Object.keys(platformViewTabs) as PlatformWorkspaceView[]).find(id=>platformViewTabs[id]===tab);}
export function platformTabForView(view:string|null):number|undefined{return view&&Object.hasOwn(platformViewTabs,view)?platformViewTabs[view as PlatformWorkspaceView]:undefined;}
