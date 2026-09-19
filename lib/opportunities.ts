export const statuses=['Saved','Preparing','Submitted','Waiting for Recommendation','Interview','Offer','Rejected','Declined','Withdrawn'] as const;
export const docNames=['CV','Motivation letter','Transcripts','Reference contacts','Reference letters'] as const;
export const docStates=['Not checked','Required','In progress','Done','Not required'] as const;
export type DocState=typeof docStates[number];
export type Job={id:string;title:string;organization:string;type:string;url:string;team:string;location:string;country:string;found:string;status:typeof statuses[number];deadline:string;applied:string;salary:string;start:string;notes:string;docs:Record<string,DocState>;version:number};
export const blankDocs=():Record<string,DocState>=>Object.fromEntries(docNames.map(n=>[n,'Not checked']));
export const closed=(j:Job)=>['Rejected','Declined','Withdrawn'].includes(j.status);
export const needsApplication=(j:Job)=>['Saved','Preparing'].includes(j.status);
export const documentProgress=(j:Job)=>{const r=Object.values(j.docs).filter(s=>s!=='Not required'&&s!=='Not checked');return {done:r.filter(s=>s==='Done').length,total:r.length,unchecked:Object.values(j.docs).some(s=>s==='Not checked')};};
export function dateLabel(s:string){return s?new Date(s+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'No deadline';}
export function daysLeft(s:string){const n=new Date();return Math.round((Date.parse(s+'T00:00:00Z')-Date.UTC(n.getFullYear(),n.getMonth(),n.getDate()))/86400000);}
