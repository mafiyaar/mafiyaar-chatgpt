from pathlib import Path
import hashlib, zipfile, os, sys
root=Path.cwd(); out=Path(os.environ.get('MAFIYAAR_RELEASE_ZIP',root.parent/'MafiYaar_Cloudflare_Deploy_Ready_Final.zip'))
forbidden_parts={'node_modules','.wrangler','.git','.build-web','coverage','test-results','playwright-report','dist/worker'}
forbidden_names={'.dev.vars','.env'}
files=[]
for p in root.rglob('*'):
    if not p.is_file(): continue
    rel=p.relative_to(root)
    if any(part in forbidden_parts for part in rel.parts) or p.name in forbidden_names or p.name=='MafiYaar_Cloudflare_Deploy_Ready_Final_MANIFEST.txt' or p.suffix in {'.db','.sqlite','.sqlite3','.zip'}: continue
    files.append((p,rel))
manifest=[]
for p,rel in sorted(files,key=lambda x:str(x[1])):
    digest=hashlib.sha256(p.read_bytes()).hexdigest();manifest.append(f'{digest}  {rel.as_posix()}')
manifest_path=root/'MafiYaar_Cloudflare_Deploy_Ready_Final_MANIFEST.txt';manifest_path.write_text('\n'.join(manifest)+'\n',encoding='utf-8')
files=[x for x in files if x[1].name!=manifest_path.name]+[(manifest_path,manifest_path.relative_to(root))]
out.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p,rel in sorted(files,key=lambda x:str(x[1])):z.write(p,Path('cloudflare-production')/rel)
digest=hashlib.sha256(out.read_bytes()).hexdigest();sha=out.with_suffix('.sha256.txt');sha.write_text(f'{digest}  {out.name}\n',encoding='utf-8')
print(f'{out}\nfiles={len(files)}\nsha256={digest}\nsize={out.stat().st_size}')
