import path from 'node:path';
export const dataRoot=()=>path.resolve(process.env.AEO_FILES_ROOT||path.join(process.cwd(),'data'));
