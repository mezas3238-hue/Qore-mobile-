import test from 'node:test';
import assert from 'node:assert/strict';
import {chmod, lstat, mkdir, rm, symlink, writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {generatePrivateQaManifest,readPrivateQaManifest,writePrivateQaManifest}
 from './g263-private-qa-manifest.mjs';
import {verifyManifest} from './qore-staging-qa-identity-bootstrap.mjs';

test('G263 generates exactly 8 independent QA accounts with high-entropy secrets',()=>{
 const m=generatePrivateQaManifest();
 assert.equal(m.length,8);
 assert.equal(new Set(m.map(a=>a.email)).size,8);
 assert.equal(new Set(m.map(a=>a.password)).size,8);
 assert.equal(m.every(a=>a.password.length>=42),true);
 assert.deepEqual(verifyManifest(m),m);
});
test('G263 writes a private file and securely rereads it without printing secrets',async t=>{
 const dir=await mkdir(join(tmpdir(),'g263-missing-'+process.pid),{recursive:true,mode:0o700})
  .then(()=>join(tmpdir(),'g263-missing-'+process.pid));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const x=await writePrivateQaManifest({baseDir:dir});
 const expected=await readPrivateQaManifest(x.path);
 assert.equal(expected.length,8);
 assert.equal(((await lstat(x.path)).mode & 0o077),0);
 assert.equal(((await lstat(dirname(x.path))).mode & 0o077),0);
});
test('G263 refuses world-readable file and symlink even inside private folder',async t=>{
 const x=await writePrivateQaManifest();
 t.after(()=>rm(dirname(x.path),{recursive:true,force:true}));
 await chmod(x.path,0o644);
 await assert.rejects(readPrivateQaManifest(x.path),/G263 private/);
 await chmod(x.path,0o600);
 const link=join(dirname(x.path),'alias.json');
 await symlink(x.path,link);
 await assert.rejects(readPrivateQaManifest(link),/G263 private/);
});
test('G263 detects tampered manifest before using any provider credentials',async t=>{
 const x=await writePrivateQaManifest();
 t.after(()=>rm(dirname(x.path),{recursive:true,force:true}));
 const m=await readPrivateQaManifest(x.path);
 m[7].password=m[0].password;
 await writeFile(x.path,JSON.stringify(m));
 await assert.rejects(readPrivateQaManifest(x.path),/G263 private/);
});
