import {backupIntegrated,restoreIntegrated} from './integrated-backup.mjs';
try{const backup=await backupIntegrated(),restored=await restoreIntegrated(backup.file,backup.keyFile);console.log(JSON.stringify({backup,restored}));}catch{console.error('Isolated backup test failed; source preserved.');process.exitCode=1;}
