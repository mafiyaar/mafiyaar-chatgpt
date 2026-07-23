// Focused QR Code Model 2 encoder for version 5-L, byte mode, mask 0.
// It keeps local/runtime room QR generation dependency-free.
const VERSION=5, SIZE=17+4*VERSION, DATA_CODEWORDS=108, EC_CODEWORDS=26;
const ALIGNMENT=[6,30];
function gfTables(){const exp=new Uint8Array(512),log=new Uint8Array(256);let x=1;for(let i=0;i<255;i++){exp[i]=x;log[x!]=i;x<<=1;if(x&0x100)x^=0x11d;}for(let i=255;i<512;i++)exp[i]=exp[i-255]!;return{exp,log};}
const GF=gfTables();
function mul(a:number,b:number){if(!a||!b)return 0;return GF.exp[GF.log[a]!+GF.log[b]!]!;}
function generator(degree:number){let poly=[1];for(let i=0;i<degree;i++){const next=new Array(poly.length+1).fill(0);for(let j=0;j<poly.length;j++){next[j]^=poly[j]!;next[j+1]^=mul(poly[j]!,GF.exp[i]!);}poly=next;}return poly;}
function errorCorrection(data:number[]){const gen=generator(EC_CODEWORDS),msg=[...data,...new Array(EC_CODEWORDS).fill(0)];for(let i=0;i<data.length;i++){const factor=msg[i]!;if(!factor)continue;for(let j=0;j<gen.length;j++)msg[i+j]^=mul(gen[j]!,factor);}return msg.slice(data.length);}
class Bits{items:number[]=[];push(value:number,length:number){for(let i=length-1;i>=0;i--)this.items.push((value>>>i)&1);}bytes(){const out=[];for(let i=0;i<this.items.length;i+=8){let value=0;for(let j=0;j<8;j++)value=(value<<1)|(this.items[i+j]??0);out.push(value);}return out;}}
function dataCodewords(text:string){const bytes=[...new TextEncoder().encode(text)];if(bytes.length>106)throw new Error('Invite URL is too long for the local QR encoder.');const bits=new Bits();bits.push(0b0100,4);bits.push(bytes.length,8);for(const byte of bytes)bits.push(byte,8);const capacity=DATA_CODEWORDS*8;bits.push(0,Math.min(4,capacity-bits.items.length));while(bits.items.length%8)bits.items.push(0);const out=bits.bytes();let pad=0;while(out.length<DATA_CODEWORDS)out.push(pad++%2===0?0xec:0x11);return out;}
function bchTypeInfo(data:number){let d=data<<10;const generator=0x537;while(bitLength(d)>=bitLength(generator))d^=generator<<(bitLength(d)-bitLength(generator));return((data<<10)|d)^0x5412;}
function bitLength(value:number){let n=0;while(value){n++;value>>>=1;}return n;}
export function qrMatrix(text:string):boolean[][]{
  const modules:Array<Array<boolean|null>>=Array.from({length:SIZE},()=>Array(SIZE).fill(null));
  const finder=(row:number,col:number)=>{for(let r=-1;r<=7;r++)for(let c=-1;c<=7;c++){const y=row+r,x=col+c;if(y<0||x<0||y>=SIZE||x>=SIZE)continue;modules[y]![x]=r>=0&&r<=6&&c>=0&&c<=6&&(r===0||r===6||c===0||c===6||(r>=2&&r<=4&&c>=2&&c<=4));}};
  finder(0,0);finder(SIZE-7,0);finder(0,SIZE-7);
  for(const row of ALIGNMENT)for(const col of ALIGNMENT){if(modules[row]![col]!==null)continue;for(let r=-2;r<=2;r++)for(let c=-2;c<=2;c++)modules[row+r]![col+c]=Math.max(Math.abs(r),Math.abs(c))!==1;}
  for(let i=8;i<SIZE-8;i++){if(modules[i]![6]===null)modules[i]![6]=i%2===0;if(modules[6]![i]===null)modules[6]![i]=i%2===0;}
  const format=bchTypeInfo((1<<3)|0);for(let i=0;i<15;i++){const value=((format>>i)&1)===1;if(i<6)modules[i]![8]=value;else if(i<8)modules[i+1]![8]=value;else modules[SIZE-15+i]![8]=value;if(i<8)modules[8]![SIZE-i-1]=value;else if(i<9)modules[8]![15-i]=value;else modules[8]![15-i-1]=value;}modules[SIZE-8]![8]=true;
  const data=dataCodewords(text),stream=[...data,...errorCorrection(data)];let byteIndex=0,bitIndex=7,row=SIZE-1,inc=-1;
  for(let col=SIZE-1;col>0;col-=2){if(col===6)col--;while(true){for(let c=0;c<2;c++){const x=col-c;if(modules[row]![x]!==null)continue;let dark=false;if(byteIndex<stream.length)dark=((stream[byteIndex]!>>>bitIndex)&1)===1;if((row+x)%2===0)dark=!dark;modules[row]![x]=dark;bitIndex--;if(bitIndex<0){byteIndex++;bitIndex=7;}}row+=inc;if(row<0||row>=SIZE){row-=inc;inc=-inc;break;}}}
  return modules.map(row=>row.map(value=>Boolean(value)));
}
export function qrSvg(text:string,scale=6,border=4):string{const matrix=qrMatrix(text),size=(SIZE+border*2)*scale;let path='';for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(matrix[y]![x])path+=`M${(x+border)*scale} ${(y+border)*scale}h${scale}v${scale}h-${scale}z`;return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="MafiYaar room invite QR code"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000" shape-rendering="crispEdges"/></svg>`;}
