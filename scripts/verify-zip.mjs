import {spawnSync} from 'node:child_process';const r=spawnSync('python3',['scripts/verify_zip.py'],{stdio:'inherit'});process.exit(r.status??1);
