import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
async function moduleUrl(path,replacements={}){let source=await readFile(new URL(path,import.meta.url),'utf8');for(const [from,to] of Object.entries(replacements))source=source.replaceAll(from,to);return 'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');}
const {monthlyNet,netLabel,salarySource,comparableEstimate}=await import(await moduleUrl('../lib/salary.ts'));
const {extractText,extractStructured,postingDate,mergeExtraction}=await import(await moduleUrl('../lib/extraction.ts'));
const opportunities=await moduleUrl('../lib/opportunities.ts');
const {jobSchema}=await import(await moduleUrl('../lib/validation.ts',{"'./opportunities'":JSON.stringify(opportunities),"'zod'":JSON.stringify(import.meta.resolve('zod'))}));
const salary={source:'Posted',basis:'Gross',min:48000,max:60000,currency:'EUR',period:'Year',deductions:25,evidence:'Example'};
test('net estimates annualize pay and require explicit deductions',()=>{
  assert.deepEqual(monthlyNet(salary),{min:3000,max:3750});
  assert.equal(monthlyNet({...salary,deductions:undefined}),null);
  assert.equal(monthlyNet({...salary,basis:'Unknown'}),null);
  assert.equal(monthlyNet({...salary,deductions:100}),null);
  assert.equal(monthlyNet({...salary,min:NaN}),null);
  assert.equal(monthlyNet({...salary,max:1}),null);
  assert.deepEqual(monthlyNet({...salary,basis:'Net',period:'Month',min:1200,max:1200,paymentsPerYear:14}),{min:1400,max:1400});
  assert.equal(monthlyNet({...salary,period:'Hour'}),null);
  assert.deepEqual(monthlyNet({...salary,period:'Hour',min:20,max:20,hoursPerWeek:30}),{min:1950,max:1950});
  assert.equal(netLabel(salary),'EUR 3,000–3,750 / month');
  assert.equal(salarySource({salary:'old data'}),'Source not recorded');
  assert.equal(salarySource({salary:'',salaryDetails:salary}),'Posted gross · estimated net');
  assert.equal(salarySource({salary:'',salaryDetails:{...salary,source:'Guessed'}}),'Guessed · estimated net');
});
test('pasted text extracts supported fields without asserting missing salary basis',()=>{
  const r=extractText('PhD in ecology\nOrganization: Test University\nCountry: Germany\nDeadline: 2026-10-15\nSalary: EUR 48,000–60,000 per year\nRequired: CV and transcripts\nReference letters are optional');
  assert.equal(r.fields.title,'PhD in ecology');assert.equal(r.fields.organization,'Test University');assert.equal(r.fields.deadline,'2026-10-15');assert.equal(r.fields.type,'PhD');
  assert.equal(r.salary.min,48000);assert.equal(r.salary.max,60000);assert.equal(r.salary.basis,'Unknown');assert.deepEqual(r.requirements,['CV','Transcripts']);
  assert.equal(extractText('Net salary: € 3700-4000 / month').salary.max,4000);
  assert.equal(extractText('Salary: competitive').salary,undefined);
  assert.equal(extractText('Deadline: 2026-02-30').fields.deadline,undefined);
});
test('JobPosting graph data wins over page text and handles incomplete metadata',()=>{
  const r=extractStructured({'@graph':[{'@type':'WebPage'},{'@type':'JobPosting',title:'Researcher',hiringOrganization:{name:'Institute'},jobLocation:{address:{addressLocality:'Bremen',addressCountry:'DE'}},validThrough:'2026-10-15T23:59:00Z',baseSalary:{currency:'EUR',value:{minValue:50000,maxValue:55000,unitText:'YEAR'}}}]},'Navigation\nOrganization: Wrong');
  assert.equal(r.fields.title,'Researcher');assert.equal(r.fields.organization,'Institute');assert.equal(r.fields.country,'DE');assert.equal(r.salary.basis,'Gross');assert.equal(r.salary.min,50000);
  assert.equal(extractStructured({'@type':'JobPosting',baseSalary:{value:123}}).salary,undefined);
});
test('existing backups remain valid while malformed salary metadata is rejected',()=>{
  const job={id:'example',title:'Researcher',organization:'',type:'PhD',url:'',team:'',location:'',country:'',found:'2026-09-19',status:'Saved',deadline:'',applied:'',salary:'EUR 2100 / month',start:'',notes:'',docs:Object.fromEntries(['CV','Motivation letter','Transcripts','Reference contacts','Reference letters'].map(n=>[n,'Not checked'])),version:1};
  assert.equal(jobSchema.safeParse(job).success,true);
  assert.equal(jobSchema.safeParse({...job,salaryDetails:salary}).success,true);
  assert.equal(jobSchema.safeParse({...job,salaryDetails:{...salary,min:0}}).success,false);
  assert.equal(jobSchema.safeParse({...job,salaryDetails:{...salary,max:1}}).success,false);
  assert.equal(jobSchema.safeParse({...job,salaryDetails:{...salary,deductions:100}}).success,false);
});
test('fetch function rejects unapproved URLs and anonymous calls',async()=>{
  const source=(await readFile(new URL('../supabase/functions/extract-job/index.ts',import.meta.url),'utf8')).replace('Deno.serve(handler);','').replace("'npm:linkedom@0.18.13'",JSON.stringify(import.meta.resolve('linkedom')));
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  globalThis.Deno={env:{get:()=>''}};
  try{const {checkedUrl,publicIPv4,handler}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  for(const url of ['http://jobs.uzh.ch/x','https://127.0.0.1/','https://user:pass@jobs.uzh.ch/x','https://jobs.uzh.ch:444/x'])assert.throws(()=>checkedUrl(url));
  assert.equal(checkedUrl('https://ai.ethz.ch/research/phd-fellowships.html').hostname,'ai.ethz.ch');
  assert.equal(checkedUrl('https://careers.some-new-employer.org/position').hostname,'careers.some-new-employer.org');
  assert.equal(checkedUrl('https://jobs.uzh.ch/posting#x').href,'https://jobs.uzh.ch/posting');
  for(const ip of ['127.0.0.1','10.1.1.1','169.254.169.254','192.168.1.1','172.16.0.1','100.64.0.1','::1'])assert.equal(publicIPv4(ip),false);
  assert.equal(publicIPv4('8.8.8.8'),true);
  assert.equal((await handler(new Request('https://example.test',{method:'POST'}))).status,401);
  assert.equal((await handler(new Request('https://example.test',{method:'POST',headers:{origin:'https://evil.test'}}))).status,403);
  }finally{delete globalThis.Deno;}
});

test('salary guesses use comparable personal records without mixing currencies or recycled guesses',()=>{
  const target={id:'new',country:'DE',type:'PhD'};
  const jobs=[{id:'one',country:'Germany',type:'PhD',salary:'EUR 2100 / month'},{id:'two',country:'Germany',type:'PhD',salary:'',salaryDetails:{...salary,basis:'Net',period:'Month',min:2300,max:2400}},{id:'three',country:'Germany',type:'PhD',salary:'',salaryDetails:{...salary,source:'Guessed',basis:'Net',min:1000000,max:1000000}},{id:'four',country:'Switzerland',type:'PhD',salary:'CHF 4000 / month'}];
  const parse=value=>extractText('Net salary: '+value).salary;
  const result=comparableEstimate(target,jobs,parse);
  assert.equal(result.min,2100);assert.equal(result.max,2400);assert.equal(result.source,'Guessed');assert.match(result.evidence,/2 existing/);
  assert.equal(comparableEstimate({...target,country:'Spain'},jobs,parse),null);
  assert.equal(comparableEstimate({...target,type:'Industry'},jobs,parse),null);
  assert.equal(extractText('Salary EUR 45k per year').salary,undefined,'unsupported shorthand must not become 45 EUR');
  assert.equal(extractText('Salary EUR 2100,50 per month').salary,undefined,'ambiguous number formats need manual review');
});

test('prose fellowship posting extracts deadline, institution, flexible start and first-year salary',()=>{
 const text=`ETH AI Center Doctoral Fellowships The ETH AI Center offers a fellowship for doctoral students.
The faculty includes researchers at ETH Zurich and collaborating universities.
We offer positions with flexible start dates, usually in September.
Transparent salary with automatic advancement. Positions use rate 5 at 100%.
CHF 73,100 in the first year
CHF 78,300 in the second year
CHF 83,500 in the third year.
Master's degree must be complete by June 2027.
See application guidelines for required documents.
Deadline: Tuesday, 27 October 2026 (16:00 CET)`;
 for(const input of [text,text.replaceAll('\n',' ')]){
  const r=extractText(input);
  assert.equal(r.fields.title,'ETH AI Center Doctoral Fellowships');assert.equal(r.fields.organization,'ETH AI Center');assert.equal(r.fields.location,undefined);assert.equal(r.fields.country,undefined);assert.equal(r.fields.type,'PhD');assert.equal(r.fields.deadline,'2026-10-27');assert.match(r.fields.start,/flexible start dates, usually in September/i);
  assert.equal(r.salary.min,73100);assert.equal(r.salary.max,73100);assert.equal(r.salary.period,'Year');assert.equal(r.salary.basis,'Unknown');assert.match(r.salary.evidence,/78,300/);assert.match(r.salary.evidence,/83,500 \(third year\)/);assert.match(r.fields.notes,/16:00 CET/);assert.deepEqual(r.requirements,[]);assert.ok(r.notices.some(n=>n.includes('hiring sentence')));
 }
});
test('written dates validate calendar days and remain tied to application context',()=>{
 assert.equal(postingDate('October 27, 2026'),'2026-10-27');assert.equal(postingDate('27th Oct 2026'),'2026-10-27');assert.equal(postingDate('31 February 2026'),'');assert.equal(postingDate('01/02/2026'),'');
 assert.equal(extractText('Research fellowship\nDegree completed by June 2027\nApplications close 27 October 2026').fields.deadline,'2026-10-27');
 assert.equal(extractText('Research fellowship\nStart date: 27 October 2026').fields.deadline,undefined);
 assert.equal(extractText('ETH AI Center Doctoral Fellowships – ETH AI Center | ETH Zurich\nHomepage\nETH AI Center Doctoral Fellowships\nThe ETH AI Center offers a fellowship').fields.title,'ETH AI Center Doctoral Fellowships');
 assert.equal(extractText('Postdoctoral Fellowship\nCandidates hold a PhD').fields.type,'Postdoc');
 assert.equal(extractText('Researcher\nSalary: EUR 48,000–EUR 60,000 gross per year').salary.max,60000);
});

test('unrelated employer prose, table labels and industry roles use general rules',()=>{
 const a=extractText('Data Engineer\nAcme Labs is hiring a Data Engineer.\nLocation: Madrid, Spain\nClosing date: November 4, 2026\nA PhD is optional.\nSalary: EUR 50000 gross per year');
 assert.equal(a.fields.organization,'Acme Labs');assert.equal(a.fields.country,'Spain');assert.equal(a.fields.type,'Industry');assert.equal(a.fields.deadline,'2026-11-04');
 const b=extractText('Marine Research Fellow\nOrganization\nCoastal Institute\nCountry\nNorway\nApplication deadline\n1 December 2026');
 assert.equal(b.fields.organization,'Coastal Institute');assert.equal(b.fields.country,'Norway');assert.equal(b.fields.deadline,'2026-12-01');
});
test('multiple postings are not combined and metadata remains authoritative over AI',()=>{
 const jobs=[{'@type':'JobPosting',title:'Role A',hiringOrganization:{name:'One'}},{'@type':'JobPosting',title:'Role B',hiringOrganization:{name:'Two'}}];
 const multiple=extractStructured(jobs,'Salary: EUR 30000 per year');assert.equal(multiple.ambiguous,true);assert.deepEqual(mergeExtraction(multiple,{fields:{title:'Guessed'},requirements:[]}).fields,{});
 const base=extractStructured(jobs[0],'Organization: Wrong');const ai={fields:{title:'Different title',country:'France'},evidence:{title:'Different title',country:'Based in France'},requirements:['CV'],notices:['Check quotes']};
 const merged=mergeExtraction(base,ai);assert.equal(merged.fields.title,'Role A');assert.equal(merged.fields.country,'France');assert.equal(merged.evidence.country,'Based in France');assert.deepEqual(merged.requirements,['CV']);
});
