import type {SalaryDetails} from './salary';
export type Extracted = {fields:Partial<Record<'title'|'organization'|'location'|'country'|'deadline'|'start'|'team'|'type',string>>;salary?:SalaryDetails;requirements:string[]};
const clean=(v:unknown)=>typeof v==='string'?v.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,500):'';
const iso=(v:unknown)=>{const s=clean(v).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s?s:'';};
export function extractText(text:string):Extracted {
  const result:Extracted={fields:{},requirements:[]};
  const lines=text.slice(0,80000).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const labels:Record<string, keyof Extracted['fields']>={'title':'title','position':'title','job title':'title','organization':'organization','organisation':'organization','university':'organization','company':'organization','location':'location','country':'country','department':'team','team':'team','advisor':'team','deadline':'deadline','application deadline':'deadline','start date':'start'};
  for(const line of lines){const m=line.match(/^([^:]{2,30}):\s*(.+)$/);if(m&&labels[m[1].toLowerCase()]){const k=labels[m[1].toLowerCase()];const value=k==='deadline'?iso(m[2]):clean(m[2]);if(value)result.fields[k]=value;}}
  if(!result.fields.title&&lines[0]&&lines[0].length<180&&!/^https?:|:/.test(lines[0]))result.fields.title=clean(lines[0]);
  if(/\b(ph\.?d|doctoral)\b/i.test(text))result.fields.type='PhD';else if(/\bpostdoc/i.test(text))result.fields.type='Postdoc';
  const pay=lines.find(l=>/salary|remuneration|compensation|stipend|gross|net pay/i.test(l));
  if(pay){
    const m=pay.match(/(EUR|CHF|USD|GBP|€|£)\s*([\d]+(?:[, .]\d{3})*(?:\.\d{1,2})?)\s*(?:[-–]\s*(?:EUR|CHF|USD|GBP|€|£)?\s*([\d]+(?:[, .]\d{3})*(?:\.\d{1,2})?))?/i);
    const period=/\b(year|annual|annum|yearly)\b/i.test(pay)?'Year':/\b(month|monthly)\b/i.test(pay)?'Month':/\b(week|weekly)\b/i.test(pay)?'Week':/\b(hour|hourly)\b/i.test(pay)?'Hour':undefined;
    if(m&&period&&!/\d\s*[kK]\b|\d,\d{1,2}(?:\D|$)/.test(pay)){const number=(s:string)=>Number(s.replace(/[, ]/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,''));const min=number(m[2]),max=number(m[3]||m[2]);if(min>0&&max>=min&&max<=100000000)result.salary={source:'Posted',basis:/\bnet\b/i.test(pay)?'Net':/\bgross\b/i.test(pay)?'Gross':'Unknown',min,max,currency:({'€':'EUR','£':'GBP','$':'USD'} as Record<string,string>)[m[1]]||m[1].toUpperCase(),period,evidence:clean(pay)};}
  }
  const docs:Record<string,RegExp>={'CV':/\bcv\b|curriculum vitae|résumé|resume/i,'Motivation letter':/motivation letter|cover letter|statement of motivation/i,'Transcripts':/transcripts?/i,'Reference contacts':/reference contacts|contact details.{0,25}referees/i,'Reference letters':/reference letters|recommendation letters|letters of recommendation/i};
  for(const [name,pattern] of Object.entries(docs))if(lines.some(l=>pattern.test(l)&&!/not required|optional|not necessary/i.test(l)))result.requirements.push(name);
  return result;
}
export function extractStructured(input:unknown, fallbackText=''):Extracted {
  const result=extractText(fallbackText);
  const find=(x:unknown,depth=0):Record<string,any>|undefined=>{if(depth>12||!x||typeof x!=='object')return;const o=x as Record<string,any>;if([o['@type']].flat().includes('JobPosting'))return o;for(const item of Array.isArray(x)?x:Object.values(o)){const found=find(item,depth+1);if(found)return found;}};
  const j=find(input);if(!j)return result;
  const location=[j.jobLocation].flat()[0]?.address;
  const values={title:clean(j.title),organization:clean(j.hiringOrganization?.name),location:clean(location?.addressLocality),country:clean(location?.addressCountry?.name||location?.addressCountry),deadline:iso(j.validThrough),start:iso(j.jobStartDate)};
  Object.assign(result.fields,Object.fromEntries(Object.entries(values).filter(([,v])=>v)));
  const d=extractText(typeof j.description==='string'?j.description.replace(/<[^>]*>/g,'\n').slice(0,80000):'');result.requirements=[...new Set([...result.requirements,...d.requirements])];
  if(!result.fields.type&&d.fields.type)result.fields.type=d.fields.type;
  if(!result.salary&&d.salary)result.salary=d.salary;
  const salary=j.baseSalary,amount=salary?.value;
  const unit=({YEAR:'Year',MONTH:'Month',WEEK:'Week',HOUR:'Hour'} as const)[String(amount?.unitText).toUpperCase() as 'YEAR'];
  const min=Number(amount?.minValue??amount?.value),max=Number(amount?.maxValue??amount?.value??amount?.minValue);
  if(unit&&min>0&&Number.isFinite(max)&&max>=min&&max<=100000000&&/^[A-Z]{3}$/.test(salary?.currency))result.salary={source:'Posted',basis:'Gross',min,max,currency:salary.currency,period:unit,evidence:'Posting structured data: baseSalary (treated as gross; verify with employer).'};
  return result;
}
