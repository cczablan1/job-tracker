// Deploy as extract-job. This function validates the caller independently of gateway JWT checks.
// No service-role key, AI key, or database access is used.
const allowedHosts = ['ai.ethz.ch','ethz.ch','www.ethz.ch','jobs.uzh.ch','leibniz-zmt.de','www.leibniz-zmt.de','daad.de','www.daad.de','recruitingapp-5442.de.umantis.com','globalsouthopportunities.com','www.globalsouthopportunities.com','linkedin.com','www.linkedin.com','jobs.lever.co','boards.greenhouse.io','job-boards.greenhouse.io',...(Deno.env.get('EXTRA_POSTING_HOSTS')||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)];
const allowedOrigins = ['https://cczablan1.github.io','http://localhost:5173','http://127.0.0.1:5173'];
const requests = new Map<string,{count:number;until:number}>();
export function checkedUrl(value:string):URL {
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||!allowedHosts.includes(url.hostname.toLowerCase()))throw Error('This posting host is not enabled. Paste its description instead.');
  url.hash='';return url;
}
export function publicIPv4(address:string):boolean {
  const parts=address.split('.').map(Number);if(parts.length!==4||parts.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
  const [a,b]=parts;return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&[0,168].includes(b)||a===100&&b>=64&&b<=127||a===198&&[18,19,51].includes(b)||a===203&&b===0);
}
async function limitedText(response:Response,max:number):Promise<string>{
  if(Number(response.headers.get('content-length'))>max)throw Error('Posting is too large. Paste the description instead.');
  if(!response.body)return '';const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('Posting is too large. Paste the description instead.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);
}
const plain=(s:string)=>s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<\/(p|div|li|h[1-6])\s*>|<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/[ \t]+/g,' ').slice(0,80000);
export async function handler(req:Request):Promise<Response>{
  const origin=req.headers.get('origin')||'';const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':allowedOrigins.includes(origin)?origin:allowedOrigins[0],'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
  const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!allowedOrigins.includes(origin))return respond({error:'Origin not allowed'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return respond({error:'Use POST'},405);
  try{
    const authorization=req.headers.get('authorization');if(!authorization?.startsWith('Bearer '))return respond({error:'Sign in first.'},401);
    const auth=await fetch(Deno.env.get('SUPABASE_URL')+'/auth/v1/user',{headers:{Authorization:authorization,apikey:Deno.env.get('SUPABASE_ANON_KEY')!},signal:AbortSignal.timeout(8000)});
    if(!auth.ok)return respond({error:'Sign in again to extract a posting.'},401);
    const user=await auth.json();if(!user.id)return respond({error:'Sign in first.'},401);
    const now=Date.now();for(const [id,limit] of requests)if(limit.until<now)requests.delete(id);
    const limit=requests.get(user.id)||{count:0,until:now+60000};if(++limit.count>10)return respond({error:'Too many requests. Wait a minute.'},429);requests.set(user.id,limit);
    const raw=await limitedText(new Response(req.body),6000);const body=JSON.parse(raw);if(typeof body.url!=='string'||body.url.length>4000)return respond({error:'Enter a posting link.'},400);
    let url=checkedUrl(body.url);let html='';
    for(let i=0;i<4;i++){
      // Only operator-approved public posting hosts; validate every redirect too.
      const addresses=await Deno.resolveDns(url.hostname,'A');if(!addresses.length||addresses.some(a=>!publicIPv4(a)))throw Error('This address is not a public posting site.');
      const response=await fetch(url,{redirect:'manual',headers:{Accept:'text/html','User-Agent':'JobTracker/1.1 (job details preview)'},signal:AbortSignal.timeout(12000)});
      if([301,302,303,307,308].includes(response.status)){const next=response.headers.get('location');await response.body?.cancel();if(!next||i===3)throw Error('Could not follow this posting. Paste its description instead.');url=checkedUrl(new URL(next,url).href);continue;}
      if(!response.ok){await response.body?.cancel();throw Error('The site blocked access or the posting is unavailable. Paste the description instead.');}
      if(!response.headers.get('content-type')?.includes('text/html')){await response.body?.cancel();throw Error('Only web pages are supported. Paste the description instead.');}
      html=await limitedText(response,1500000);break;
    }
    const structured:unknown[]=[];for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){if(structured.length>=5)break;try{if(match[1].length<100000)structured.push(JSON.parse(match[1]));}catch{/* Ignore malformed metadata. */}}
    return respond({structured,text:plain(html)});
  }catch(e){const message=e instanceof Error?e.message:'';return respond({error:/posting|Paste|address/.test(message)?message:'Could not read the posting. Paste its description instead.'},400);}
}
Deno.serve(handler);
