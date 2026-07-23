import { PROTOCOL_VERSION, CLIENT_MINIMUM_VERSION, type ClientCommand, type PlayerView, type ServerEvent } from '../../../packages/contracts/index.js';
import { api } from './api.js';
export type ConnectionState='connecting'|'online'|'offline'|'reconnecting'|'replaced';
export class RealtimeClient{
  private ws:WebSocket|null=null;private roomCode:string|null=null;private retry=0;private stopped=false;private sequence=1;private serverOffset=0;private latestView:PlayerView|null=null;
  constructor(private onView:(view:PlayerView)=>void,private onState:(state:ConnectionState,message?:string)=>void,private onError:(message:string)=>void){}
  connect(roomCode:string){this.roomCode=roomCode;this.stopped=false;void this.open();}
  private async open(){if(this.stopped||!this.roomCode)return;this.onState(this.retry?'reconnecting':'connecting');try{const issued=await api<{ticket:string}>(`/api/rooms/${encodeURIComponent(this.roomCode)}/connection-ticket`,{method:'POST',body:JSON.stringify({protocolVersion:PROTOCOL_VERSION,clientVersion:CLIENT_MINIMUM_VERSION})});if(this.stopped)return;const protocol=location.protocol==='https:'?'wss':'ws';const ws=new WebSocket(`${protocol}://${location.host}/ws/connect/${encodeURIComponent(issued.ticket)}`);this.ws=ws;
    ws.addEventListener('open',()=>{this.retry=0;this.onState('online');});
    ws.addEventListener('message',event=>this.message(String(event.data)));ws.addEventListener('close',()=>this.closed());ws.addEventListener('error',()=>this.onState('offline'));
  }catch(error){this.onError(error instanceof Error?error.message:'Connection ticket nahi mil saka.');this.closed();}}
  private closed(){if(this.stopped)return;this.onState('offline');const delay=Math.min(10_000,500*2**this.retry++);setTimeout(()=>void this.open(),delay);}
  private message(raw:string){let event:ServerEvent;try{event=JSON.parse(raw)}catch{return}if('serverTime'in event&&typeof event.serverTime==='number')this.serverOffset=event.serverTime-Date.now();
    if(event.type==='snapshot'||event.type==='room_update'){this.latestView=event.view;this.onView(event.view);}
    else if(event.type==='error')this.onError(event.message);
    else if(event.type==='ping')this.sendRaw({type:'pong',at:event.at,commandId:crypto.randomUUID()});
    else if(event.type==='session_replaced'){this.stopped=true;this.onState('replaced',event.message);this.ws?.close();}
  }
  command(command:Omit<ClientCommand,'sequence'|'commandId'|'phaseSequence'> & {sequence?:number}){const sequence='sequence'in command&&typeof command.sequence==='number'?command.sequence:this.sequence++;const payload={...command,sequence,commandId:crypto.randomUUID(),phaseSequence:this.latestView?.match?.phaseSequence} as ClientCommand;this.sendRaw(payload);return sequence;}
  private sendRaw(command:ClientCommand){if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify(command));else this.onError('Action server tak nahi pohanchi. Connection wapas aane dein.');}
  serverNow(){return Date.now()+this.serverOffset;}
  close(){this.stopped=true;this.ws?.close();this.ws=null;this.roomCode=null;this.latestView=null;}
}
