import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {Session} from '@supabase/supabase-js';
import {supabase,configured} from './supabase';
import {api,importJobs} from './data';
import Tracker from '../app/tracker';
import '../app/globals.css';
import '../app/editor.css';
import './account.css';

function App(){
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true),[email,setEmail]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const [retryAt,setRetryAt]=useState(()=>Number(localStorage.getItem('tracker-email-retry-at')||0)),[now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const retrySeconds=Math.max(0,Math.ceil((retryAt-now)/1000));
 function cooldown(seconds:number){const until=Date.now()+seconds*1000;localStorage.setItem('tracker-email-retry-at',String(until));setRetryAt(until);}
 function authError(e:{message:string;code?:string}){if(/rate.limit|over_email_send_rate_limit/i.test((e.code||'')+' '+e.message))return 'The email service has reached its sending limit. Wait before requesting another link. The built-in service allows only two emails per hour.';if(/code.verifier|pkce|flow_state|exchange|expired|otp_expired/i.test((e.code||'')+' '+e.message))return 'This sign-in link could not be completed. It may be expired, already used, or opened in a different browser. When email sending is available again, request one new link and open it in the same browser.';return e.message;}
 useEffect(()=>{
  if(!supabase){setLoading(false);return;}
  let active=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{if(active){setSession(next);setLoading(false);}});
  supabase.auth.initialize().then(async ({error:initialError})=>{if(initialError){if(active){setError(authError(initialError));setLoading(false);}return;}const {data,error}=await supabase!.auth.getSession();if(active){setSession(data.session);setLoading(false);if(error)setError(authError(error));else if(!data.session&&new URLSearchParams(location.search).has('code'))setError('This link could not finish signing in. Open the latest email link in the browser where you requested it. If it has expired, wait for the email limit to reset before requesting one new link.');}}).catch(()=>{if(active){setLoading(false);setError('Could not load your session. Refresh to try again.');}});
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 async function login(e:React.FormEvent){e.preventDefault();if(!supabase||retrySeconds>0)return;setBusy(true);setError('');setMessage('');try{
  const {error}=await supabase.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:new URL(import.meta.env.BASE_URL,location.origin).href}});
  if(error){if(error.status===429||/rate.limit/i.test(error.message))cooldown(3600);throw error;}
  cooldown(60);
  setMessage('Check your email for a sign-in link. Open it in this same browser to finish signing in.');
 }catch(e){setError(e instanceof Error?authError(e):'Could not send the sign-in link. Try again.');}finally{setBusy(false);}}
 async function logout(){if(!supabase)return;setError('');const {error}=await supabase.auth.signOut();if(error)setError(error.message);else{setSession(null);setMessage('');}}
 async function importFile(file?:File){if(!file)return;setBusy(true);setError('');setMessage('');try{
  if(file.size>5_000_000)throw Error('Choose an export smaller than 5 MB.');
  const count=await importJobs(JSON.parse(await file.text()));
  setMessage(count+' applications imported into '+session?.user.email+'. Existing applications were kept.');
  setRevision(n=>n+1);
 }catch(e){setError(e instanceof Error?e.message:'Import failed. Check your file and try again.');}finally{setBusy(false);}}
 async function exportFile(){setBusy(true);setError('');try{
  const response=await api('/api/jobs');const data=await response.json();if(!response.ok)throw Error(data.error);
  const url=URL.createObjectURL(new Blob([JSON.stringify(data.jobs,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='job-tracker-export.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){setError(e instanceof Error?e.message:'Export failed.');}finally{setBusy(false);}}
 if(!configured)return <main className="auth-page"><section className="auth-card"><span className="brand-mark">JT</span><h1>Setup required</h1><p>Connect this tracker to its login and database service to get started.</p><p>The repository README contains the setup steps. No application data is included in this website.</p></section></main>;
 if(loading)return <main className="auth-page" role="status">Loading your account…</main>;
 if(!session)return <main className="auth-page"><form className="auth-card" onSubmit={login}><span className="brand-mark">JT</span><h1>Sign in to Job Tracker</h1><p>Use your email to access your applications on any device.</p><label>Email address<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com"/></label><button className="primary" disabled={busy||retrySeconds>0}>{busy?'Sending…':retrySeconds>0?'Try again in '+Math.ceil(retrySeconds/60)+' min':'Email me a sign-in link'}</button>{message&&<p className="account-success" role="status">{message}</p>}{error&&<p className="account-error" role="alert">{error}</p>}<small>No password needed. Your applications are private to your account.</small></form></main>;
 return <><details className="account-tools"><summary>Account & data · {session.user.email}</summary><div><p>Import your application export into this account. Existing records will not be overwritten.</p><label className="secondary">Import applications<input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{void importFile(e.target.files?.[0]);e.target.value='';}}/></label><button className="secondary" disabled={busy} onClick={exportFile}>Export applications</button><button className="secondary" disabled={busy} onClick={logout}>Sign out</button>{busy&&<p role="status">Working…</p>}{message&&<p className="account-success" role="status">{message}</p>}{error&&<p className="account-error" role="alert">{error}</p>}</div></details><Tracker key={session.user.id+revision} email={session.user.email||'My account'} onSignOut={logout}/></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
