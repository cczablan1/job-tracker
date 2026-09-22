import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=(await readFile(new URL('../supabase/functions/extract-job/index.ts',import.meta.url),'utf8')).replace('Deno.serve(handler);','').replace("'npm:linkedom@0.18.13'",JSON.stringify(import.meta.resolve('linkedom')));
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {pageContent,checkedUrl,publicIPv4,decodeHttp,fetchPublicPage,validateAI,aiExtract,handler}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const utf8=s=>new TextEncoder().encode(s);
test('DOM extraction handles metadata, headings and tables without executing scripts',()=>{
 const page=pageContent(`<html><head><title>Careers portal</title><script type="application/ld+json">{"@type":"JobPosting","title":"Data Engineer","hiringOrganization":{"name":"Acme Labs"}}</script></head><body><nav>Job alerts and unrelated links</nav><main><h1>Data Engineer</h1><table><tr><th>Location</th><td>Madrid, Spain</td></tr></table><dl><dt>Closing date</dt><dd>November 4, 2026</dd></dl><p>Salary: EUR 50000 gross per year</p><script>throw Error('Do not run')</script></main><footer>Other careers</footer></body></html>`);
 assert.equal(page.structured[0].hiringOrganization.name,'Acme Labs');assert.match(page.text,/Title: Data Engineer/);assert.match(page.text,/Location: Madrid, Spain/);assert.match(page.text,/Closing date: November 4, 2026/);assert.doesNotMatch(page.text,/Job alerts|Other careers|Do not run/);
});
test('microdata works for an unrelated employer without JSON-LD',()=>{
 const page=pageContent(`<html><body><main itemscope itemtype="https://schema.org/JobPosting"><h1 itemprop="title">Marine Research Fellow</h1><div itemprop="hiringOrganization" itemscope><span itemprop="name">Coastal Institute</span></div><time itemprop="validThrough" datetime="2026-12-01">December 1</time><div itemprop="jobLocation"><span itemprop="addressLocality">Bergen</span><span itemprop="addressCountry">Norway</span></div><div itemprop="baseSalary"><meta itemprop="currency" content="NOK"><meta itemprop="value" content="600000"><meta itemprop="unitText" content="YEAR"></div></main></body></html>`);
 assert.equal(page.structured[0].hiringOrganization.name,'Coastal Institute');assert.equal(page.structured[0].validThrough,'2026-12-01');assert.equal(page.structured[0].baseSalary.value.minValue,'600000');
});
test('URL validation permits new public sites but rejects local addresses and credentials',()=>{
 for(const host of ['careers.newcompany.com','jobs.some-university.edu','recruitment.example.org'])assert.equal(checkedUrl('https://'+host+'/vacancy').hostname,host);
 for(const url of ['https://127.0.0.1/','https://2130706433/','https://[::1]/','https://x.local/','https://localhost/','file:///etc/passwd','https://user:pass@example.org/','https://example.org:8080/'])assert.throws(()=>checkedUrl(url));
 for(const address of ['10.0.0.1','127.0.0.1','169.254.169.254','100.64.0.1','192.0.2.1','198.51.100.1','203.0.113.1','224.0.0.1'])assert.equal(publicIPv4(address),false);
});
test('HTTP framing rejects truncation and safely decodes chunks',async()=>{
 assert.equal(await decodeHttp(utf8('HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello')).text(),'hello');
 assert.equal(await decodeHttp(utf8('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n0\r\n\r\n')).text(),'hello');
 assert.throws(()=>decodeHttp(utf8('HTTP/1.1 200 OK\r\nContent-Length: 15\r\n\r\nhello')));
 assert.throws(()=>decodeHttp(utf8('HTTP/1.1 200 OK\r\n\r\nhello'),true));
 assert.throws(()=>decodeHttp(utf8('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n')));
});
test('DNS addresses are validated then pinned at connection time; TLS keeps the original hostname',async()=>{
 const old=globalThis.Deno;let connectCount=0,read=false,closed=false;const connections=[];const data=utf8('HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello');
 const conn={write:async b=>b.length,read:async b=>{if(read)return null;read=true;b.set(data);return data.length;},close:()=>{closed=true;}};
 globalThis.Deno={resolveDns:async()=>['93.184.216.34'],connect:async options=>{connectCount++;connections.push(options);return conn;},startTls:async(c,options)=>{assert.equal(options.hostname,'some-employer.org');assert.equal(options.unsafelyDisableHostnameVerification,undefined);return c;},errors:{UnexpectedEof:class extends Error{}}};
 try{assert.equal(await (await fetchPublicPage(checkedUrl('https://some-employer.org/job'))).text(),'hello');assert.deepEqual(connections[0],{hostname:'93.184.216.34',port:443});assert.equal(closed,true);globalThis.Deno.resolveDns=async()=>['127.0.0.1'];await assert.rejects(fetchPublicPage(checkedUrl('https://some-employer.org/job')),/public IPv4/);assert.equal(connectCount,1);}finally{globalThis.Deno=old;}
});
test('AI validation rejects unsupported facts, protected fields and optional documents',()=>{
 const text='Acme Labs is hiring a Data Engineer. Deadline: 27 October 2026. CV required. Reference letters are optional. Salary: EUR 50000 per year.';
 const result=validateAI({fields:[{field:'organization',value:'Acme Labs',evidence:'Acme Labs is hiring'},{field:'deadline',value:'2026-02-30',evidence:'Deadline: 27 October 2026'},{field:'country',value:'Canada',evidence:'Based in Canada'},{field:'status',value:'Submitted',evidence:'Acme Labs is hiring'}],requirements:[{name:'CV',evidence:'CV required'},{name:'Reference letters',evidence:'Reference letters are optional'}],salary:{min:50000,max:50000,currency:'EUR',period:'Year',basis:'Net',evidence:'Salary: EUR 50000 per year'}},text);
 assert.deepEqual(result.fields,{organization:'Acme Labs'});assert.deepEqual(result.requirements,['CV']);assert.equal(result.salary.basis,'Unknown');
});
test('AI stays off without a key and handles quota failures without paid fallback',async()=>{
 const oldDeno=globalThis.Deno,oldFetch=globalThis.fetch;let calls=0;
 globalThis.Deno={env:{get:()=>undefined}};globalThis.fetch=async()=>{calls++;return new Response('{}',{status:429});};
 try{assert.match((await aiExtract('posting')).notice,/not configured/);assert.equal(calls,0);globalThis.Deno.env.get=()=> 'unit-test-placeholder';assert.match((await aiExtract('posting')).notice,/limit reached/);assert.equal(calls,1);
 globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');const body=JSON.parse(options.body);assert.equal(body.messages[1].content,'Data Engineer at Acme Labs');assert.equal(body.tools,undefined);assert.equal(body.model,'openai/gpt-oss-20b');return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({fields:[{field:'title',value:'Data Engineer',evidence:'Data Engineer'}],requirements:[],salary:null})}}]});};assert.equal((await aiExtract('Data Engineer at Acme Labs')).ai.fields.title,'Data Engineer');
 }finally{globalThis.Deno=oldDeno;globalThis.fetch=oldFetch;}
});

test('authenticated redirects cannot escape to a private server',async()=>{
 const oldDeno=globalThis.Deno,oldFetch=globalThis.fetch;let connects=0,reads=0;
 const data=utf8('HTTP/1.1 302 Found\r\nLocation: https://127.0.0.1/secrets\r\nContent-Length: 0\r\n\r\n');
 globalThis.Deno={env:{get:()=> 'test-config'},resolveDns:async()=>['93.184.216.34'],errors:{UnexpectedEof:class extends Error{}},connect:async()=>{connects++;return {write:async b=>b.length,read:async b=>{if(reads++)return null;b.set(data);return data.length;},close:()=>{}};},startTls:async c=>c};
 globalThis.fetch=async()=>Response.json({id:'test-owner-redirect'});
 try{const response=await handler(new Request('https://extract.example',{method:'POST',headers:{Authorization:'Bearer test-token','Content-Type':'application/json'},body:JSON.stringify({url:'https://some-employer.org/job'})}));assert.equal(response.status,400);assert.equal(connects,1);assert.match((await response.json()).error,/public HTTPS/);}finally{globalThis.Deno=oldDeno;globalThis.fetch=oldFetch;}
});
