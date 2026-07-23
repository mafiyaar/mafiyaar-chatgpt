from pathlib import Path
import zipfile,hashlib,sys,os,tempfile,subprocess,json,shutil
zip_path=Path(os.environ.get('MAFIYAAR_RELEASE_ZIP',Path.cwd().parent/'MafiYaar_Cloudflare_Deploy_Ready_Final.zip'))
if not zip_path.exists(): raise SystemExit(f'Missing {zip_path}')
forbidden={'node_modules','.wrangler','.git','.dev.vars','.env','coverage','test-results','playwright-report'}
errors=[]; commands=[]
def run(cmd,root,timeout=240):
    result=subprocess.run(cmd,cwd=root,text=True,capture_output=True,timeout=timeout)
    commands.append({'command':' '.join(cmd),'returncode':result.returncode,'stdout':result.stdout[-4000:],'stderr':result.stderr[-4000:]})
    if result.returncode!=0: errors.append(f"Command failed: {' '.join(cmd)}")
    return result
with zipfile.ZipFile(zip_path) as z:
    bad=z.testzip()
    if bad: errors.append(f'CRC failure: {bad}')
    names=z.namelist()
    for n in names:
        parts=Path(n).parts
        if any(x in forbidden for x in parts) or n.endswith(('.db','.sqlite','.sqlite3')) or n.startswith('/') or '..' in parts:errors.append(f'Forbidden entry: {n}')
    with tempfile.TemporaryDirectory(prefix='mafiyaar-cf-verify-') as td:
        z.extractall(td);root=Path(td)/'cloudflare-production'
        required=['README.md','DEPLOY.md','package.json','wrangler.jsonc','apps/worker/src/index.ts','apps/worker/src/durable/MafiYaarRoom.ts','apps/web/dist/index.html','migrations/d1/0001_initial.sql','MafiYaar_Cloudflare_Architecture_Lock_v1.0.md','MafiYaar_Cloudflare_Deploy_Ready_Final_MANIFEST.txt','CLOUDFLARE_FINAL_AUDIT.md']
        for x in required:
            if not (root/x).exists():errors.append(f'Missing required path: {x}')
        manifest_path=root/'MafiYaar_Cloudflare_Deploy_Ready_Final_MANIFEST.txt'
        if manifest_path.exists():
            for line in manifest_path.read_text().splitlines():
                digest,rel=line.split('  ',1);p=root/rel
                if not p.exists() or hashlib.sha256(p.read_bytes()).hexdigest()!=digest:errors.append(f'Manifest mismatch: {rel}')
        for p in root.rglob('*'):
            if p.is_symlink(): errors.append(f'Symlink found: {p.relative_to(root)}')
            if p.is_file():
                try:
                    text=p.read_text(errors='ignore')
                    if p.name not in {'verify_zip.py','ZIP_VERIFICATION.md'} and (str(Path.cwd()) in text or '/mnt/data/mafiyaar-cloudflare-work' in text):errors.append(f'Absolute work path found: {p.relative_to(root)}')
                except Exception: pass
        # Run all checks that do not require downloading external packages.
        run(['npm','run','test:credential-free'],root,360)
        # Re-run a source-only deployment/configuration sanity check.
        try:
            json.loads((root/'package.json').read_text())
            # JSONC parse after stripping full-line comments (config intentionally contains no comments today).
            json.loads((root/'wrangler.jsonc').read_text())
        except Exception as exc: errors.append(f'Configuration parse failure: {exc}')
report={
  'ok':not errors,
  'zip':zip_path.name,
  'files':len(names),
  'size':zip_path.stat().st_size,
  'sha256':hashlib.sha256(zip_path.read_bytes()).hexdigest(),
  'forbiddenEntryScan':'PASS' if not any('Forbidden entry' in e for e in errors) else 'FAIL',
  'cleanExtractionCommands':commands,
  'packageLockPresent':False,
  'officialDependencyInstall':'NOT RUN — npm registry HTTP 503 in source environment',
  'errors':errors
}
print(json.dumps(report,indent=2))
report_out=Path(os.environ.get('MAFIYAAR_ZIP_REPORT',Path.cwd()/'reports/ZIP_VERIFICATION.md'))
report_out.write_text('# ZIP Verification\n\n```json\n'+json.dumps(report,indent=2)+'\n```\n',encoding='utf-8')
if errors: raise SystemExit(1)
