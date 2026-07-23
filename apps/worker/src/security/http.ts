export function json(data:unknown,status=200,headers:HeadersInit={}):Response{
  const h=new Headers(headers);h.set('content-type','application/json; charset=utf-8');securityHeaders(h);return new Response(JSON.stringify(data),{status,headers:h});
}
export function errorResponse(code:string,message:string,status=400,recoverable=true):Response{return json({error:{code,message,recoverable}},status);}
export function securityHeaders(h:Headers):void{
  h.set('x-content-type-options','nosniff');h.set('x-frame-options','DENY');h.set('referrer-policy','no-referrer');
  h.set('permissions-policy','camera=(self), microphone=(), geolocation=()');
  h.set('content-security-policy',"default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; img-src 'self' data:; connect-src 'self' ws: wss: https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
}
export function cookieHeader(name:string,value:string,opts:{httpOnly?:boolean;maxAge?:number;secure?:boolean;sameSite?:'Lax'|'Strict'}={}):string{
  const parts=[`${name}=${encodeURIComponent(value)}`,'Path=/',`SameSite=${opts.sameSite??'Lax'}`];
  if(opts.httpOnly)parts.push('HttpOnly');if(opts.secure)parts.push('Secure');if(opts.maxAge!==undefined)parts.push(`Max-Age=${Math.max(0,Math.floor(opts.maxAge))}`);return parts.join('; ');
}
export function parseCookies(request:Request):Record<string,string>{const out:Record<string,string>={};for(const part of (request.headers.get('cookie')??'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());}return out;}
export async function bodyObject(request:Request,maxBytes=32_000):Promise<Record<string,unknown>>{
  const length=Number(request.headers.get('content-length')||0);if(length>maxBytes)throw Object.assign(new Error('Request body too large.'),{status:413,code:'BODY_TOO_LARGE'});
  const text=await request.text();
  if(new TextEncoder().encode(text).byteLength>maxBytes)throw Object.assign(new Error('Request body too large.'),{status:413,code:'BODY_TOO_LARGE'});
  let value:unknown;try{value=JSON.parse(text)}catch{throw Object.assign(new Error('Valid JSON is required.'),{status:400,code:'INVALID_JSON'})}
  if(!value||typeof value!=='object'||Array.isArray(value))throw Object.assign(new Error('JSON object required.'),{status:400,code:'INVALID_BODY'});return value as Record<string,unknown>;
}
export function validateOrigin(request:Request,expected:string):boolean{const origin=request.headers.get('origin');return !origin||origin===expected;}
