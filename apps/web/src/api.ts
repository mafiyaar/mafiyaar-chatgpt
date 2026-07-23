export class ApiError extends Error {
  constructor(public code:string,message:string,public status:number,public recoverable:boolean){super(message)}
}
export function cookie(name:string):string|null{
  const prefix=`${name}=`;for(const part of document.cookie.split(';')){const item=part.trim();if(item.startsWith(prefix))return decodeURIComponent(item.slice(prefix.length));}return null;
}
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const headers=new Headers(options.headers||{});if(options.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
  const method=(options.method||'GET').toUpperCase();if(!['GET','HEAD','OPTIONS'].includes(method)){const csrf=cookie('my_csrf');if(csrf)headers.set('X-CSRF-Token',csrf);}
  let response:Response;try{response=await fetch(path,{...options,headers,credentials:'same-origin'});}catch{throw new ApiError('NETWORK_ERROR','Server se connection nahi ho raha.',0,true)}
  const body=await response.json().catch(()=>({}));if(!response.ok){const e=body?.error||{};throw new ApiError(e.code||'REQUEST_FAILED',e.message||`Request failed (${response.status})`,response.status,e.recoverable!==false)}return body as T;
}
