import {supabase} from './supabase';
import {jobSchema} from '../lib/validation';
export async function api(_url:string,options:RequestInit={}):Promise<Response>{
 try{
  if(!supabase)throw Error('Account storage is not configured.');
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)return Response.json({error:'Your session expired. Sign in again.'},{status:401});
  const client=supabase;
  const table=()=>client.from('opportunities');
  if(!options.method||options.method==='GET'){
   const {data,error}=await table().select('payload,version').eq('owner',session.user.id).order('created',{ascending:false}).abortSignal(options.signal||new AbortController().signal);
   if(error)throw error;
   return Response.json({jobs:data.map(r=>({...r.payload,version:r.version}))});
  }
  const parsed=jobSchema.safeParse(JSON.parse(String(options.body)));
  if(!parsed.success)return Response.json({error:parsed.error.issues[0].message},{status:400});
  const job=parsed.data;
  if(options.method==='POST'){
   const {data,error}=await table().insert({owner:session.user.id,id:job.id,payload:{...job,version:1},version:1}).select('payload,version').single();
   if(error)throw error;
   return Response.json({job:{...data.payload,version:data.version}},{status:201});
  }
  const {data,error}=await table().update({payload:{...job,version:job.version+1},version:job.version+1}).eq('owner',session.user.id).eq('id',job.id).eq('version',job.version).select('payload,version').maybeSingle();
  if(error)throw error;
  if(!data)return Response.json({error:'This application changed on another device. Copy your edits, close this panel, and refresh.'},{status:409});
  return Response.json({job:{...data.payload,version:data.version}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Could not connect to account storage. Try again.'},{status:503});}
}
export async function importJobs(input:unknown){
 if(!Array.isArray(input)||input.length>1000)throw Error('Choose a valid application export (up to 1,000 jobs).');
 const jobs=input.map(row=>jobSchema.parse(row));
 if(!supabase)throw Error('Storage is not configured.');
 const {data:{session}}=await supabase.auth.getSession();
 if(!session)throw Error('Sign in before importing.');
 const {data,error}=await supabase.from('opportunities').upsert(jobs.map(j=>({owner:session.user.id,id:j.id,payload:{...j,version:1},version:1})),{onConflict:'owner,id',ignoreDuplicates:true}).select('id');
 if(error)throw error;
 return data.length;
}