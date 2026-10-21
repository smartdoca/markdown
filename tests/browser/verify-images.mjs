const { chromium } = await import(process.env.EXMD_PLAYWRIGHT_MODULE || 'playwright-core')
import fs from 'node:fs/promises'
const base = process.argv[2] || 'http://127.0.0.1:5198'
const label = process.argv[3] || 'source'
const evidence = process.env.EXMD_BROWSER_EVIDENCE || new URL('../../docs/verification/image-preview-0.4.4', import.meta.url).pathname
await fs.mkdir(evidence, { recursive: true })
const browser = await chromium.launch({ executablePath:process.env.EXMD_CHROME_EXECUTABLE, headless:true, args:['--no-first-run','--no-default-browser-check'] })
const context = await browser.newContext({viewport:{width:1440,height:1000}})
const page = await context.newPage()
const errors=[]; page.on('pageerror', error=>errors.push(error.message))
const pdfRequests=[]; page.on('request', request=>{ if(/pdfjs|pdf-lib|fontkit|pdf-file-impl/.test(request.url())) pdfRequests.push(request.url()) })
const report = {label,base,suites:[],native:{},errors,pdfRequests}
try {
  await page.goto(base+'/tests/browser/client.html?view=preview')
  await page.waitForFunction(()=>window.fixture,{timeout:60000})
  await page.goto(base+'/tests/browser/index.html')
  for(const [button,mark] of [['image-tests','IMAGES ALL PASSED'],['run','ALL PASSED'],['preview-tests','PREVIEW ALL PASSED'],['end-tests','PASS all document-end click cases']]) {
    await page.locator('#'+button).click()
    await page.waitForFunction(({mark})=>document.querySelector('#results').textContent.includes(mark)||document.querySelector('#results').textContent.includes('FAIL'),{mark},{timeout:90000})
    const text=await page.locator('#results').innerText()
    report.suites.push({button,text})
    console.log(label,button,text)
    if(text.includes('FAIL')) throw new Error('Suite failed: '+button)
  }
  if(pdfRequests.length) throw new Error('Editor/preview eagerly loaded PDF conversion: '+pdfRequests.join(', '))
  await page.goto(base+'/tests/browser/client.html?view=preview')
  await page.waitForFunction(()=>window.fixture)
  await page.evaluate(()=>window.fixture.bootstrap('![First](asset-a)\n\n![Second](asset-b)\n\n```mermaid\ngraph TD\nA[Start]-->B[Done]\n```'))
  await page.waitForFunction(()=>document.querySelector('.mermaid-diagram svg') && document.querySelector('.markdown-body img')?.naturalWidth)
  await page.evaluate(()=>{window.fixture.remember();window.fixture.takeUpdates();window.__imageBaseline=window.fixture.count()})
  await page.locator('.markdown-body img').first().click()
  const image=page.locator('.exmd-image-lightbox-image')
  await image.waitFor()
  const bounds=await image.boundingBox()
  const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2
  await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.move(x+130,y+75,{steps:10}); await page.mouse.up()
  const transform=await image.evaluate(e=>e.style.transform)
  if(!transform.includes('translate(130px, 75px)')) throw new Error('Native drag failed: '+transform)
  report.native.dragAtInitialZoom=transform
  await page.getByRole('button',{name:'放大',exact:true}).click()
  const b2=await image.boundingBox(); const x2=Math.max(200,Math.min(1100,b2.x+b2.width/2)),y2=Math.max(160,Math.min(700,b2.y+b2.height/2))
  await page.mouse.move(x2,y2); await page.mouse.down(); await page.mouse.move(x2-80,y2+40,{steps:10}); await page.mouse.up()
  report.native.dragAfterZoom=await image.evaluate(e=>e.style.transform)
  if(!report.native.dragAfterZoom.includes('translate(50px, 115px) scale(1.25)')) throw new Error('Native scaled drag failed')
  await page.screenshot({path:evidence+'/'+label+'-drag.png'})
  await page.getByRole('button',{name:'下一张图片',exact:true}).click()
  if(await image.getAttribute('alt')!=='Second') throw new Error('native next failed')
  const cdp=await context.newCDPSession(page)
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true})
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:850,y:500}]})
  for(let n=1;n<=5;n++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:850-n*40,y:500}]})
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
  await page.waitForFunction(()=>document.querySelector('.exmd-image-lightbox-counter')?.textContent==='3 / 3')
  report.native.touchSwipe=true
  await page.screenshot({path:evidence+'/'+label+'-mermaid.png'})
  await page.keyboard.press('Escape')
  report.native.after=await page.evaluate(()=>({count:window.fixture.count(),stable:window.fixture.stable(),effects:window.fixture.effects(),baseline:window.__imageBaseline}))
  if(report.native.after.count.pending || report.native.after.count.changes !== report.native.after.baseline.changes || !report.native.after.stable) throw new Error('preview wrote content/rebuilt editor')
  await page.evaluate(()=>window.fixture.replaceSource('Math: $x^2 + \\frac{a}{b}$\n\n<span data-color="#ff0000" style="position:fixed">Color</span>'))
  await page.waitForSelector('.katex .vlist > span', { state: 'attached' })
  await page.evaluate(()=>document.fonts.ready)
  report.math=await page.locator('.katex .vlist > span').first().evaluate(e=>({top:e.style.top,mathmlClipPath:getComputedStyle(document.querySelector('.katex-mathml')).clipPath}))
  if(!report.math.top) throw new Error('KaTeX generated positioning styles were lost')
  if(report.math.mathmlClipPath!=='inset(50%)') throw new Error('Math host stylesheet is missing')
  report.sanitized=await page.locator('.markdown-body span[data-color]').evaluate(e=>({color:e.style.color,position:e.style.position}))
  if(report.sanitized.color!=='rgb(255, 0, 0)' || report.sanitized.position) throw new Error('Raw HTML styles bypassed sanitization')
  await page.screenshot({path:evidence+'/'+label+'-math.png'})
  report.passed=true
} catch(error) { report.passed=false; report.failure=error.stack; await page.screenshot({path:evidence+'/'+label+'-failure.png'}); console.error(error.stack); process.exitCode=1 }
finally { await fs.writeFile(evidence+'/'+label+'-browser.json',JSON.stringify(report,null,2)); await browser.close() }
