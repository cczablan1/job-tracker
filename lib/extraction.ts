import type {SalaryDetails} from './salary';
export type Extracted = {fields:Partial<Record<'title'|'organization'|'location'|'country'|'deadline'|'start'|'team'|'type'|'notes',string>>;salary?:SalaryDetails;requirements:string[];notices?:string[]};
const clean=(v:unknown)=>typeof v==='string'?v.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,500):'';
const iso=(v:unknown)=>{const s=clean(v).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s?s:'';};
const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
export function postingDate(value:string):string {
  const numeric=value.match(/\b\d{4}-\d{2}-\d{2}\b/);if(numeric)return iso(numeric[0]);
  const dayFirst=value.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?\s*,?\s*(\d{4})\b/i);
  const monthFirst=value.match(/\b([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})\b/i);
  const m=dayFirst||monthFirst;if(!m)return '';
  const month=months.findIndex(v=>v===(dayFirst?m[2]:m[1]).toLowerCase()||v.slice(0,3)===(dayFirst?m[2]:m[1]).toLowerCase());
  if(month<0)return '';
  return iso(`${m[3]}-${String(month+1).padStart(2,'0')}-${String(dayFirst?m[1]:m[2]).padStart(2,'0')}`);
}
function titleFrom(lines:string[]):string {
  const candidates=lines.map(line=>line.replace(/^#+\s*/, '').split(/\s+(?=(?:The|We|Our)\s)/)[0].trim()).filter(line=>line.length>=5&&line.length<=160&&!/^https?:|^(?:about|apply for|requirements|guidelines|deadline|contact|homepage|navigation)\b/i.test(line)&&!/[.!?:]/.test(line));
  const match=candidates.find(line=>/\b(?:doctoral|phd|postdoc|research|engineer|analyst|developer|fellowships?)\b/i.test(line)&&!/\b(?:offers?|will|you|we|comprises|expected|must|have|salary|remunerated)\b/i.test(line))||candidates[0]||'';
  return candidates.find(line=>match.startsWith(line+' – ')||match.startsWith(line+' | '))||match;
}
export function extractText(input:string):Extracted {
  const text=input.slice(0,80000).replace(/\u00a0/g,' ');
  const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const result:Extracted={fields:{},requirements:[],notices:[]};const notes:string[]=[];
  const labels:Record<string, keyof Extracted['fields']>={'title':'title','position':'title','job title':'title','organization':'organization','organisation':'organization','university':'organization','company':'organization','location':'location','country':'country','department':'team','team':'team','advisor':'team','deadline':'deadline','application deadline':'deadline','start date':'start'};
  for(const line of lines){const m=line.match(/^([^:]{2,30}):\s*(.+)$/);if(m&&labels[m[1].toLowerCase()]){const k=labels[m[1].toLowerCase()];const value=k==='deadline'?postingDate(m[2]):clean(m[2]);if(value)result.fields[k]=value;}}
  if(!result.fields.title)result.fields.title=titleFrom(lines);
  if(!result.fields.title)delete result.fields.title;
  // Locate dates in application-related context, never degree-completion or start dates.
  const deadline=text.match(/(?:application\s+deadline|deadline(?:\s+for\s+applications)?|applications?\s+(?:close|must\s+be\s+(?:received|submitted)\s+by)|apply\s+by)\s*[:–-]?\s*([^\n]{1,160})/i);
  if(deadline){const date=postingDate(deadline[1]);if(date){result.fields.deadline=date;notes.push('Deadline as posted: '+clean(deadline[0]));}}
  const role=result.fields.title||'';
  if(/\bpostdoc(?:toral)?\b/i.test(role))result.fields.type='Postdoc';else if(/\b(ph\.?d|doctoral)\b/i.test(role+' '+text))result.fields.type='PhD';
  // Named institution recognition is separate from the extraction of advertised facts.
  // Do not confuse collaborating universities later in a description with the employer.
  if(/\bETH (?:AI Center|Zurich|Zürich)\b/i.test(role)){
    result.fields.organization ||= 'ETH Zurich';
    if(/\bETH AI Center\b/i.test(role))result.fields.team ||= 'ETH AI Center';
    result.fields.location ||= 'Zurich';result.fields.country ||= 'Switzerland';
    result.notices!.push('Organization and location inferred from the named ETH institution; verify the work location.');
  }else if(!result.fields.organization){
    const employer=text.match(/(?:^|\n)([A-Z][^\n.!?]{2,100}?(?:University|Institute|Laboratory|College|Company))\s+(?:is\s+(?:seeking|recruiting)|invites|offers)/);
    if(employer)result.fields.organization=clean(employer[1]);
  }
  if(!result.fields.start){const flexible=text.match(/flexible\s+start\s+dates?[^.\n]{0,100}/i);if(flexible)result.fields.start=clean(flexible[0]);else{const start=text.match(/(?:expected\s+start(?:\s+date)?|starting\s+date|start\s+date)\s*[:–-]?\s*([^\n.]{1,100})/i);if(start)result.fields.start=postingDate(start[1])||clean(start[1]);}}
  // Salary amounts often appear on lines AFTER the salary heading. Parse each
  // pay line rather than assuming the heading itself contains an amount.
  const payLines=lines.flatMap(line=>line.replace(/(\b(?:first|second|third|1st|2nd|3rd)\s+year)[. ]+(?=(?:CHF|EUR|USD|GBP|€|£)\s*\d)/gi,'$1\n').split('\n')).filter(line=>/(?:CHF|EUR|USD|GBP|€|£)\s*\d/i.test(line));
  const salaries:{salary:SalaryDetails;progression:boolean;first:boolean;year:number}[]=[];
  for(const pay of payLines){
    const m=pay.match(/(EUR|CHF|USD|GBP|€|£)\s*(\d+(?:[, .]\d{3})*(?:\.\d{1,2})?)\s*(?:[-–]\s*(?:EUR|CHF|USD|GBP|€|£)?\s*(\d+(?:[, .]\d{3})*(?:\.\d{1,2})?))?/i);
    if(!m)continue;
    const period=/\b(year|annual|annum|yearly)\b/i.test(pay)?'Year':/\b(month|monthly)\b/i.test(pay)?'Month':/\b(week|weekly)\b/i.test(pay)?'Week':/\b(hour|hourly)\b/i.test(pay)?'Hour':undefined;
    if(!period||/\d\s*[kK]\b|\d,\d{1,2}(?:\D|$)/.test(pay))continue;
    const number=(s:string)=>Number(s.replace(/[, ]/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,''));
    const min=number(m[2]),max=number(m[3]||m[2]);if(!(min>0&&max>=min&&max<=100000000))continue;
    const originalLine=lines.find(line=>line.includes(pay))||pay;
    const basis=/\bnet\b/i.test(originalLine)?'Net':/\bgross\b/i.test(originalLine)?'Gross':'Unknown';
    salaries.push({salary:{source:'Posted',basis,min,max,currency:({'€':'EUR','£':'GBP'} as Record<string,string>)[m[1]]||m[1].toUpperCase(),period,evidence:clean(originalLine)},year:/\b(first|1st)\s+year\b/i.test(pay)?1:/\b(second|2nd)\s+year\b/i.test(pay)?2:/\b(third|3rd)\s+year\b/i.test(pay)?3:0,progression:/\b(first|second|third|1st|2nd|3rd)\s+year\b/i.test(pay),first:/\b(first|1st)\s+year\b/i.test(pay)});
  }
  const chosen=salaries.find(s=>s.first)||salaries[0];
  if(chosen){result.salary=chosen.salary;const progression=salaries.filter(s=>s.progression);if(progression.length>1){const evidence=progression.map(s=>`${s.salary.currency} ${s.salary.min.toLocaleString('en-GB')}${s.first?' (first year)':s.year===2?' (second year)':' (third year)'}`).join('; ');result.salary.evidence=('Annual salary progression: '+evidence+'. First-year amount selected. '+(result.salary.basis==='Unknown'?'Gross/net basis needs confirmation.':'')).slice(0,1000);notes.push(result.salary.evidence);result.notices!.push('Salary progression detected: the first year is selected, not a range spanning different years.');}if(result.salary.basis==='Unknown')result.notices!.push('The salary excerpt does not explicitly say gross or net. Confirm its basis before calculating take-home pay.');}
  const docs:Record<string,RegExp>={'CV':/\bcv\b|curriculum vitae|résumé|resume/i,'Motivation letter':/motivation letter|cover letter|statement of motivation/i,'Transcripts':/transcripts?/i,'Reference contacts':/reference contacts|contact details.{0,25}referees/i,'Reference letters':/reference letters|recommendation letters|letters of recommendation/i};
  for(const [name,pattern] of Object.entries(docs))if(lines.some(l=>pattern.test(l)&&!/not required|optional|not necessary/i.test(l)))result.requirements.push(name);
  if(!result.requirements.length&&/guidelines|application process|requirements/i.test(text))result.notices!.push('No specific document checklist found in this text. Check the linked application guidelines.');
  if(notes.length)result.fields.notes=notes.join('\n');
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
