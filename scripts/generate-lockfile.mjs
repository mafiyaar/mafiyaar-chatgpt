import {spawnSync} from 'node:child_process';const r=spawnSync('npm',['install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund'],{stdio:'inherit'});process.exit(r.status??1);
