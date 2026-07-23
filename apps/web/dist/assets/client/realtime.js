import { PROTOCOL_VERSION, CLIENT_MINIMUM_VERSION } from '../shared/contracts.js';
import { api } from './api.js';
export class RealtimeClient {
    onView;
    onState;
    onError;
    ws = null;
    roomCode = null;
    retry = 0;
    stopped = false;
    sequence = 1;
    serverOffset = 0;
    latestView = null;
    constructor(onView, onState, onError) {
        this.onView = onView;
        this.onState = onState;
        this.onError = onError;
    }
    connect(roomCode) { this.roomCode = roomCode; this.stopped = false; void this.open(); }
    async open() {
        if (this.stopped || !this.roomCode)
            return;
        this.onState(this.retry ? 'reconnecting' : 'connecting');
        try {
            const issued = await api(`/api/rooms/${encodeURIComponent(this.roomCode)}/connection-ticket`, { method: 'POST', body: JSON.stringify({ protocolVersion: PROTOCOL_VERSION, clientVersion: CLIENT_MINIMUM_VERSION }) });
            if (this.stopped)
                return;
            const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
            const ws = new WebSocket(`${protocol}://${location.host}/ws/connect/${encodeURIComponent(issued.ticket)}`);
            this.ws = ws;
            ws.addEventListener('open', () => { this.retry = 0; this.onState('online'); });
            ws.addEventListener('message', event => this.message(String(event.data)));
            ws.addEventListener('close', () => this.closed());
            ws.addEventListener('error', () => this.onState('offline'));
        }
        catch (error) {
            this.onError(error instanceof Error ? error.message : 'Connection ticket nahi mil saka.');
            this.closed();
        }
    }
    closed() { if (this.stopped)
        return; this.onState('offline'); const delay = Math.min(10_000, 500 * 2 ** this.retry++); setTimeout(() => void this.open(), delay); }
    message(raw) {
        let event;
        try {
            event = JSON.parse(raw);
        }
        catch {
            return;
        }
        if ('serverTime' in event && typeof event.serverTime === 'number')
            this.serverOffset = event.serverTime - Date.now();
        if (event.type === 'snapshot' || event.type === 'room_update') {
            this.latestView = event.view;
            this.onView(event.view);
        }
        else if (event.type === 'error')
            this.onError(event.message);
        else if (event.type === 'ping')
            this.sendRaw({ type: 'pong', at: event.at, commandId: crypto.randomUUID() });
        else if (event.type === 'session_replaced') {
            this.stopped = true;
            this.onState('replaced', event.message);
            this.ws?.close();
        }
    }
    command(command) { const sequence = 'sequence' in command && typeof command.sequence === 'number' ? command.sequence : this.sequence++; const payload = { ...command, sequence, commandId: crypto.randomUUID(), phaseSequence: this.latestView?.match?.phaseSequence }; this.sendRaw(payload); return sequence; }
    sendRaw(command) { if (this.ws?.readyState === WebSocket.OPEN)
        this.ws.send(JSON.stringify(command));
    else
        this.onError('Action server tak nahi pohanchi. Connection wapas aane dein.'); }
    serverNow() { return Date.now() + this.serverOffset; }
    close() { this.stopped = true; this.ws?.close(); this.ws = null; this.roomCode = null; this.latestView = null; }
}
//# sourceMappingURL=realtime.js.map