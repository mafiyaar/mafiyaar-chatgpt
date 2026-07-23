import { exports } from 'cloudflare:workers';
export const ORIGIN='http://example.test';
export interface TestSession { cookie:string; csrf:string; user:any; }
export function cookies(response:Response):string{
  const raw=response.headers.get('set-cookie')??'';
  const session=/my_session=([^;,]+)/.exec(raw)?.[1]??'';
  const csrf=/my_csrf=([^;,]+)/.exec(raw)?.[1]??'';
  return `my_session=${session}; my_csrf=${csrf}`;
}
export async function request(path:string,options:RequestInit={}):Promise<Response>{
  const headers=new Headers(options.headers);headers.set('origin',ORIGIN);if(options.body&&!headers.has('content-type'))headers.set('content-type','application/json');
  return exports.default.fetch(new Request(`http://example.test${path}`,{...options,headers}));
}
export async function register(suffix:string):Promise<TestSession>{
  const res=await request('/api/auth/register',{method:'POST',body:JSON.stringify({username:`player_${suffix}`,displayName:`Player ${suffix}`,pin:'864209',locale:'ur-Roman'})});
  if(res.status!==201)throw new Error(`registration failed ${res.status}: ${await res.text()}`);
  const body=await res.json() as any;return{cookie:cookies(res),csrf:body.csrfToken,user:body.user};
}
export async function authed(path:string,session:TestSession,options:RequestInit={}):Promise<Response>{
  const headers=new Headers(options.headers);headers.set('cookie',session.cookie);headers.set('x-csrf-token',session.csrf);return request(path,{...options,headers});
}
