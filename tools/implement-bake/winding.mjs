/* ENROLAMENTO — a prova de que a expansão de tira não virou o modelo do avesso.
   ---------------------------------------------------------------------------
   Numa TRIANGLE_STRIP o triângulo de índice ímpar tem o enrolamento invertido:
   expandir sem trocar dois vértices deixa metade das faces olhando para dentro.
   E isso NÃO aparece em foto quando os materiais são `doubleSided` — que é o
   caso de todos os do `trailer.glb` —, então precisa de medida.

   Este script compara, triângulo a triângulo, a normal GEOMÉTRICA (a do
   enrolamento) com a média das normais DECLARADAS nos três vértices. Uma
   expansão certa concorda em quase tudo; uma errada bate em ~50 %.

   Medido no sobrechassi materializado: 99,85 % concordam. Os 0,15 % restantes
   (2 571 triângulos) já vinham assim do rip — o mesmo teste no `.gltf` de
   origem os acusa.

   Só GLB sem Draco: ele lê os acessores crus. Rode ANTES do passo `draco`.

   USO
       node tools/implement-bake/winding.mjs <glb>
*/
import fs from 'node:fs';
function readGLB(p){const fd=fs.openSync(p,'r');const h=Buffer.alloc(20);fs.readSync(fd,h,0,20,0);const l=h.readUInt32LE(12);const jb=Buffer.alloc(l);fs.readSync(fd,jb,0,l,20);
 const bh=Buffer.alloc(8);fs.readSync(fd,bh,0,8,20+l);const bl=bh.readUInt32LE(0);const bin=Buffer.alloc(bl);fs.readSync(fd,bin,0,bl,20+l+8);fs.closeSync(fd);
 return {json:JSON.parse(jb.toString('utf8')),bin};}
const {json:g,bin}=readGLB(process.argv[2]);
const SZ={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function read(a){const acc=g.accessors[a];const v=g.bufferViews[acc.bufferView];const n=NC[acc.type];const es=SZ[acc.componentType]*n;
 const stride=v.byteStride||es;const base=(v.byteOffset||0)+(acc.byteOffset||0);const out=new Float64Array(acc.count*n);
 for(let i=0;i<acc.count;i++){for(let c=0;c<n;c++){const at=base+i*stride+c*SZ[acc.componentType];
  out[i*n+c]= acc.componentType===5126?bin.readFloatLE(at): acc.componentType===5125?bin.readUInt32LE(at): acc.componentType===5123?bin.readUInt16LE(at): bin.readUInt8(at);}}
 return out;}
let agree=0,disagree=0,zero=0,prims=0;
for(const m of g.meshes||[]){
 for(const p of m.primitives||[]){
  if(p.attributes?.NORMAL==null||p.indices==null) continue;
  prims++;
  const P=read(p.attributes.POSITION), N=read(p.attributes.NORMAL), I=read(p.indices);
  for(let t=0;t+2<I.length;t+=3){
   const a=I[t]|0,b=I[t+1]|0,c=I[t+2]|0;
   const ux=P[b*3]-P[a*3],uy=P[b*3+1]-P[a*3+1],uz=P[b*3+2]-P[a*3+2];
   const vx=P[c*3]-P[a*3],vy=P[c*3+1]-P[a*3+1],vz=P[c*3+2]-P[a*3+2];
   const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
   const len=Math.hypot(nx,ny,nz);
   if(len<1e-12){zero++;continue;}
   const mx=(N[a*3]+N[b*3]+N[c*3])/3, my=(N[a*3+1]+N[b*3+1]+N[c*3+1])/3, mz=(N[a*3+2]+N[b*3+2]+N[c*3+2])/3;
   const d=(nx*mx+ny*my+nz*mz)/len;
   if(d>=0) agree++; else disagree++;
  }
 }
}
const tot=agree+disagree;
console.log(`primitivas com NORMAL: ${prims}`);
console.log(`triângulos: ${tot.toLocaleString('pt-BR')}  ·  concordam ${(100*agree/tot).toFixed(2)}%  ·  discordam ${(100*disagree/tot).toFixed(2)}% (${disagree.toLocaleString('pt-BR')})  ·  área nula ${zero}`);
