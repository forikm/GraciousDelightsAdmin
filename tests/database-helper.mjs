import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
// PGlite executes the real PostgreSQL SQL engine locally. Its single connection is
// queued here so concurrent test requests cannot interleave transaction commands.
export async function testDatabase() {
  const engine=new PGlite();
  await engine.exec(await readFile(new URL('../db/001_initial.sql',import.meta.url),'utf8'));
  let tail=Promise.resolve();
  async function connect() {
    const previous=tail;let release;
    tail=new Promise(resolve=>{release=resolve;});
    await previous;
    return {query:(sql,args)=>engine.query(sql,args),release};
  }
  return {
    connect,
    async query(sql,args){const client=await connect();try{return await client.query(sql,args);}finally{client.release();}},
    close:()=>engine.close()
  };
}
