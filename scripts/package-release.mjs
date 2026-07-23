import {spawnSync} from 'node:child_process';const r=spawnSync('python3',['scripts/package_release.py'],{stdio:'inherit'});process.exit(r.status??1);
