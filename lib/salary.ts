export type SalaryDetails = {
  source: 'Posted' | 'Guessed'; basis: 'Net' | 'Gross' | 'Unknown';
  min: number; max: number; currency: string; period: 'Year' | 'Month' | 'Week' | 'Hour';
  deductions?: number; hoursPerWeek?: number; paymentsPerYear?: number; evidence: string;
};
export function monthlyNet(s: SalaryDetails): {min:number;max:number}|null {
  if (![s.min,s.max].every(n=>Number.isFinite(n)&&n>0)||s.max<s.min||!/^([A-Z]{3})$/.test(s.currency)||s.basis==='Unknown') return null;
  if(s.basis==='Gross'&&(s.deductions===undefined||!Number.isFinite(s.deductions)||s.deductions<0||s.deductions>=100))return null;
  if(s.period==='Hour'&&(!s.hoursPerWeek||s.hoursPerWeek<=0||s.hoursPerWeek>168))return null;
  const payments=s.paymentsPerYear??12;
  if(!Number.isFinite(payments)||payments<1||payments>24)return null;
  const factor=s.period==='Year'?1/12:s.period==='Week'?52/12:s.period==='Hour'?(s.hoursPerWeek??0)*52/12:payments/12;
  const takeHome=s.basis==='Gross'?1-s.deductions!/100:1;
  return {min:s.min*factor*takeHome,max:s.max*factor*takeHome};
}
export function netLabel(s:SalaryDetails):string {
  const n=monthlyNet(s);if(!n)return '';
  const fmt=(v:number)=>Math.round(v).toLocaleString('en-GB');
  return `${s.currency} ${fmt(n.min)}${Math.round(n.max)!==Math.round(n.min)?'–'+fmt(n.max):''} / month`;
}
export function salarySource(job:{salary:string;salaryDetails?:SalaryDetails}):string {
  const s=job.salaryDetails;
  if(!s)return job.salary?'Source not recorded':'Not added';
  if(!monthlyNet(s))return s.source+' · net not calculated';
  return s.source==='Guessed'?'Guessed · estimated net':s.basis==='Gross'?'Posted gross · estimated net':'Posted net';
}

export function comparableEstimate(job:{id:string;country:string;type:string},jobs:Array<{id:string;country:string;type:string;salary:string;salaryDetails?:SalaryDetails}>,parseLegacy:(s:string)=>SalaryDetails|undefined):SalaryDetails|null {
  const normalize=(country:string)=>{const value=country.trim();if(/^[a-z]{2}$/i.test(value)){try{return new Intl.DisplayNames(['en'],{type:'region'}).of(value.toUpperCase())!.toLowerCase();}catch{}}return value.toLowerCase();};
  const country=normalize(job.country);if(!country)return null;
  const comparable=jobs.filter(j=>j.id!==job.id&&normalize(j.country)===country&&j.type===job.type&&j.salaryDetails?.source!=='Guessed').map(j=>j.salaryDetails||parseLegacy(j.salary)).filter((v):v is SalaryDetails=>!!v&&v.basis==='Net'&&!!monthlyNet(v));
  if(!comparable.length)return null;
  const currencies=[...new Set(comparable.map(v=>v.currency))];
  // Prefer the currency with the most comparable entries, never convert or mix currencies.
  const currency=currencies.sort((a,b)=>comparable.filter(v=>v.currency===b).length-comparable.filter(v=>v.currency===a).length||a.localeCompare(b))[0];
  const group=comparable.filter(v=>v.currency===currency);const values=group.map(v=>monthlyNet(v)!);
  return {source:'Guessed',basis:'Net',period:'Month',min:Math.round(Math.min(...values.map(v=>v.min))),max:Math.round(Math.max(...values.map(v=>v.max))),currency,evidence:`Estimate from ${group.length} existing ${job.type} entry/entries in ${job.country}, in ${currency}. Original entries may be unverified; this is not the advertised pay.`};
}
