import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('database enforces account isolation, ownership and concurrent updates',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`
 create role anon;
 create role authenticated;
 create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
 grant usage on schema auth to anon,authenticated;
 grant execute on function auth.uid() to anon,authenticated;
 insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
 `);
 await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
 const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222';
 const insert=(owner,id='job')=>db.query('insert into opportunities(owner,id,payload) values($1,$2,$3)',[owner,id,JSON.stringify({id,version:1,status:'Saved'})]);
 await insert(a);await insert(b);
 await db.exec('set role anon');
 await assert.rejects(db.query('select * from opportunities'),/permission denied/);
 await assert.rejects(insert(a,'anonymous'),/permission denied/);
 await db.exec('reset role; set role authenticated');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);
 assert.equal((await db.query('select * from opportunities')).rows.length,1);
 assert.equal((await db.query('select owner from opportunities')).rows[0].owner,a);
 await assert.rejects(insert(b,'other-account'),/row-level security/);
 await insert(a,'mine');
 assert.equal((await db.query('update opportunities set version=2,payload=jsonb_set(payload,\'{version}\',\'2\') where owner=$1 returning id',[b])).rows.length,0);
 await assert.rejects(db.query('update opportunities set owner=$1,version=2,payload=jsonb_set(payload,\'{version}\',\'2\') where id=\'job\'',[b]),/identity cannot change/);
 await assert.rejects(db.query('update opportunities set version=5,payload=jsonb_set(payload,\'{version}\',\'5\') where id=\'job\''),/Invalid record version/);
 const update="update opportunities set version=2,payload=jsonb_set(payload,'{version}','2') where owner=$1 and id='job' and version=1 returning id";
 assert.equal((await db.query(update,[a])).rows.length,1);
 assert.equal((await db.query(update,[a])).rows.length,0,'stale edits must not overwrite a newer version');
 await assert.rejects(db.query("delete from opportunities where id='job'"),/permission denied/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);
 assert.equal((await db.query('select * from opportunities')).rows.length,1);
 assert.equal((await db.query('select owner from opportunities')).rows[0].owner,b);
 }finally{await db.close();}
});
