import {useEffect,useRef,useState} from 'react';
import {supabase} from '../src/supabase';
import {extractText,extractStructured,mergeExtraction,type Extracted} from '../lib/extraction';
import type {Job} from '../lib/opportunities';
import {netLabel} from '../lib/salary';
export default function ExtractJob({job,onChange}:{job:Job;onChange:(job:Job)=>void}){
  const [text,setText]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[result,setResult]=useState<Extracted|null>(null),[selected,setSelected]=useState<string[]>([]),[fallback,setFallback]=useState(false),[useAI,setUseAI]=useState(false);
  const request=useRef(0),latest=useRef(job);latest.current=job;
  useEffect(()=>{request.current++;setResult(null);setMessage('');setBusy(false);return()=>{request.current++;};},[job.url]);
  function preview(r:Extracted){setResult(r);setSelected(Object.keys(r.fields).filter(k=>!latest.current[k as keyof Job]).concat(r.salary&&!latest.current.salary&&!latest.current.salaryDetails?['salary']:[]));if(!Object.keys(r.fields).length&&!r.salary&&!r.requirements.length&&!r.ambiguous)setMessage('No reliable fields found. Add details manually or paste the full description.');}
  async function extract(fromText=false){
    const id=++request.current;setBusy(true);setMessage('');setResult(null);
    try{
      if(fromText&&!useAI){preview(extractText(text));return;}
      if(!supabase)throw Error('Sign in to extract a posting.');
      if(!fromText){const url=new URL(job.url);if(url.protocol!=='https:')throw Error('Use an HTTPS posting link.');}
      const {data,error}=await supabase.functions.invoke('extract-job',{body:fromText?{text,useAI}:{url:job.url,useAI}});
      if(error?.context instanceof Response){const problem=await error.context.json().catch(()=>null);if(problem?.error)throw Error(problem.error);}
      if(error||data?.error)throw Error(data?.error||'Extraction service unavailable. Paste the description or retry later.');
      if(id===request.current){const base=extractStructured(data.structured,data.text);preview(mergeExtraction(base,data.ai,data.notice||(useAI&&!data.version?'The server needs an update to enable AI. Ordinary extraction was used.':undefined)));}
    }catch(e){if(id===request.current){const reason=e instanceof Error?e.message:'Could not read the posting.';if(fromText){preview(extractText(text));setMessage(reason+' Ordinary text extraction was used.');}else{setMessage(reason);setFallback(true);}}}
    finally{if(id===request.current)setBusy(false);}
  }
  function toggle(key:string){setSelected(s=>s.includes(key)?s.filter(k=>k!==key):[...s,key]);}
  function apply(){if(!result)return;const next={...job,docs:{...job.docs}};for(const [k,v] of Object.entries(result.fields))if(selected.includes(k))(next as any)[k]=v;if(selected.includes('salary')&&result.salary){next.salaryDetails=result.salary;next.salary=netLabel(result.salary);}for(const doc of result.requirements)if(selected.includes('doc:'+doc)&&!['Done','In progress'].includes(next.docs[doc]))next.docs[doc]='Required';onChange(next);setResult(null);setMessage('Selected details added. Review the form, then save.');}
  return <section className="extract-panel">
    <label className="ai-choice"><input type="checkbox" disabled={busy} checked={useAI} onChange={e=>setUseAI(e.target.checked)}/><span>Use AI to help extract details (Groq)</span></label>
    <p className="form-note">{useAI?'Sends only this posting’s text to Groq. Requires a server key; free-tier limits apply. Review all suggestions.':'Uses page metadata and text patterns. Pasted text stays on this device.'}</p>
    <div className="extract-actions"><button type="button" className="primary" disabled={busy||!job.url} onClick={()=>void extract()}>{busy?'Extracting…':'Extract from link'}</button><button type="button" className="text-button" disabled={busy} onClick={()=>setFallback(!fallback)}>Paste description instead</button></div>
    {fallback&&<><label className="field"><span>Job description</span><textarea maxLength={80000} value={text} disabled={busy} onChange={e=>setText(e.target.value)} placeholder="Paste the full job posting here."/></label><button type="button" className="secondary" disabled={!text.trim()||busy} onClick={()=>void extract(true)}>Extract pasted text</button></>}
    {message&&<p role="status" className="inline-warning">{message}</p>}
    {result&&<div className="extraction-review"><h3>Review extracted details</h3><p>Existing values are unchecked. Check a field to replace it. Requirements are suggestions to verify.</p>{result.notices?.map((notice,i)=><p key={i} className="inline-warning">{notice}</p>)}
      {Object.entries(result.fields).map(([key,value])=><label key={key}><input type="checkbox" checked={selected.includes(key)} onChange={()=>toggle(key)}/><span><strong>{key}{result.evidence?.[key]?' · AI suggestion':''}</strong>{value}{result.evidence?.[key]&&<small>Source: “{result.evidence[key]}”</small>}</span></label>)}
      {result.salary&&<label><input type="checkbox" checked={selected.includes('salary')} onChange={()=>toggle('salary')}/><span><strong>Salary from posting · {result.salary.basis.toLowerCase()}</strong>{result.salary.currency} {result.salary.min}{result.salary.max!==result.salary.min?'–'+result.salary.max:''} / {result.salary.period.toLowerCase()}<small>{result.salary.evidence}</small></span></label>}
      {result.requirements.map(doc=><label key={doc}><input type="checkbox" disabled={['Done','In progress'].includes(job.docs[doc])} checked={selected.includes('doc:'+doc)} onChange={()=>toggle('doc:'+doc)}/><span>Requires {doc}{['Done','In progress'].includes(job.docs[doc])?' (progress preserved)':''}{result.evidence?.['doc:'+doc]&&<small>Source: “{result.evidence['doc:'+doc]}”</small>}</span></label>)}
      <button type="button" className="secondary" disabled={!selected.length} onClick={apply}>Use selected details</button>
    </div>}
  </section>;
}
