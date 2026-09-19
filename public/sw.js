// Private data and authenticated responses are never cached.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Job Tracker · Offline</title><body style="background:#f5f7fb;color:#365bf5;font:16px system-ui;padding:40px;line-height:1.7"><h1>You’re offline.</h1><p>Reconnect to open your saved opportunities. Your synced data is safe.</p><button onclick="location.reload()" style="padding:12px 20px">Try again</button></body>',{headers:{'Content-Type':'text/html;charset=utf-8'}})));}});
