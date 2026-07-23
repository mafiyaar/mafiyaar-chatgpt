from pathlib import Path
import json, re
from playwright.sync_api import sync_playwright
html=Path('apps/web/dist/testing/equal-action.html').read_text(encoding='utf-8')
js=Path('apps/web/dist/testing/equal-action.js').read_text(encoding='utf-8')
css=Path('apps/web/dist/styles.css').read_text(encoding='utf-8')
html=re.sub(r'<link[^>]+href="\.\./styles\.css"[^>]*>','<style>'+css+'</style>',html)
html=html.replace('<script src="equal-action.js" defer></script>','<script>'+js+'</script>')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':430,'height':932})
    page.set_content(html,wait_until='load')
    page.wait_for_function("document.documentElement.dataset.testComplete === 'true'")
    result=json.loads(page.locator('#result').inner_text())
    result['browser']='system Chromium through Playwright set_content'
    print(json.dumps(result,indent=2))
    browser.close()
if not result.get('ok'): raise SystemExit(1)
