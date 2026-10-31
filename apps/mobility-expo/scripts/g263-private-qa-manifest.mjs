/**
 * G263: local-only generator for eight independent, strong STAGING QA credentials.
 * No network, no actual Auth users, no commits, no LIVE and no credential stdout.
 * File is created with exclusive O_NOFOLLOW and mode 0600 under private 0700 dir.
 */
import {randomBytes} from 'node:crypto';
import {open, mkdtemp, stat, lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, isAbsolute, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {QA_SLOTS,verifyManifest} from './qore-staging-qa-identity-bootstrap.mjs';

const denied=()=>Error('G263 private STAGING QA manifest gate denied');
export function generatePrivateQaManifest({random=randomBytes}={}){
 if(typeof random!=='function')throw denied();
 const actors=QA_SLOTS.map(([slot,role])=>{
  const entropy=random(32);
  const idEntropy=random(9);
  if(!Buffer.isBuffer(entropy)||entropy.length!==32||
    !Buffer.isBuffer(idEntropy)||idEntropy.length!==9)throw denied();
  return Object.freeze({
   slot,role,
   email:'qore-'+slot+'-'+idEntropy.toString('hex')+'@qore.invalid',
   password:entropy.toString('base64url')
  });
 });
 return verifyManifest(actors);
}
const NOFOLLOW=constants.O_NOFOLLOW??0;
export async function writePrivateQaManifest({baseDir=tmpdir(),random=randomBytes}={}){
 if(typeof baseDir!=='string'||!isAbsolute(baseDir))throw denied();
 const actors=generatePrivateQaManifest({random});
 // mkdtemp makes a private directory with owner-only 0700 under POSIX umask.
 const dir=await mkdtemp(join(baseDir,'qore-qa-private-'));
 const p=join(dir,'actors.json');
 let file;
 try{
  const dirInfo=await stat(dir);
  if(!dirInfo.isDirectory()||(dirInfo.mode&0o077)!==0)throw denied();
  file=await open(p,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|NOFOLLOW,0o600);
  await file.writeFile(JSON.stringify(actors)+'\n','utf8');
  const info=await file.stat();
  if(!info.isFile()||(info.mode&0o077)!==0)throw denied();
  return Object.freeze({path:p,slots:actors.length,privateFile:true});
 }finally{
  await file?.close();
 }
}
/** Shareable secure file reader for G251 bootstrap and G261 Auth verification.
 * Does NOT accept symlinks, readable-by-group/world manifests or oversized JSON.
 * Read only after explicit --apply/--verify operator opt-in.
 */
export async function readPrivateQaManifest(path){
 if(typeof path!=='string'||!isAbsolute(path))throw denied();
 const dirInfo=await stat(dirname(path));
 if(!dirInfo.isDirectory()||(dirInfo.mode&0o077)!==0)throw denied();
 const linkInfo=await lstat(path);
 if(!linkInfo.isFile()||linkInfo.isSymbolicLink()||(linkInfo.mode&0o077)!==0||
    linkInfo.size<10||linkInfo.size>12000)throw denied();
 const file=await open(path,constants.O_RDONLY|NOFOLLOW);
 try{
  const actual=await file.stat();
  if(!actual.isFile()||(actual.mode&0o077)!==0||
    actual.size<10||actual.size>12000)throw denied();
  const str=await file.readFile('utf8');
  return verifyManifest(JSON.parse(str));
 }catch{throw denied();}
 finally{await file.close();}
}
const invoked=process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url;
if(invoked){
 try{
  if(process.argv.length!==3||process.argv[2]!=='--generate')throw denied();
  const x=await writePrivateQaManifest();
  // Path is not a secret. Never print the emails or passwords.
  console.log('G263 STAGING QA manifest: '+x.path);
  console.log('Eight independent QA credentials stored privately; no Auth accounts created');
 }catch{
  console.error('G263 BLOCKED: private credential manifest not generated');
  process.exitCode=1;
 }
}
