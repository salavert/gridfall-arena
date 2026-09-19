// Deterministic CPU portrait of the actual model. The game uses WebGL PBR.
// Run: node scripts/render-volt.mjs [output.png]
import * as T from 'three';
import { createVoltModel } from '../src/volt/model.js';
import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
const size = 900, model = createVoltModel(T), triangles = [];
model.root.updateMatrixWorld(true);
model.root.traverse(mesh => {
  if (!mesh.isMesh) return;
  const g = mesh.geometry, p = g.attributes.position, n = g.attributes.normal;
  const normalMatrix = new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
  for (let i = 0; i < (g.index?.count || p.count); i += 3) {
    const vertices = [0,1,2].map(j => {
      const k = g.index ? g.index.getX(i+j) : i+j;
      return { p: new T.Vector3().fromBufferAttribute(p,k).applyMatrix4(mesh.matrixWorld),
        n: new T.Vector3().fromBufferAttribute(n,k).applyMatrix3(normalMatrix).normalize() };
    });
    triangles.push({ vertices, material: mesh.material });
  }
});
function camera(position, target, extent) {
  const c = new T.OrthographicCamera(-extent,extent,extent,-extent,.1,20);
  c.position.set(...position); c.lookAt(...target); c.updateMatrixWorld();
  return c;
}
const eye = camera([2.5,2.15,4.1],[0,.82,.12],1.05);
const light = camera([-3,6,4],[0,.75,0],1.6);
const key = new T.Vector3(-3,6,4).normalize();
const fill = new T.Vector3(3,2,-2).normalize();
function project(v,c) { const p=v.clone().project(c); return [(p.x*.5+.5)*size,(.5-p.y*.5)*size,p.z]; }
function raster(c, onPixel) {
  const depth = new Float32Array(size*size).fill(Infinity);
  for (const tri of triangles) {
    const v=tri.vertices.map(v=>project(v.p,c));
    const area=(v[1][0]-v[0][0])*(v[2][1]-v[0][1])-(v[1][1]-v[0][1])*(v[2][0]-v[0][0]);
    if (Math.abs(area)<1e-6) continue;
    const minX=Math.max(0,Math.floor(Math.min(...v.map(p=>p[0])))), maxX=Math.min(size-1,Math.ceil(Math.max(...v.map(p=>p[0]))));
    const minY=Math.max(0,Math.floor(Math.min(...v.map(p=>p[1])))), maxY=Math.min(size-1,Math.ceil(Math.max(...v.map(p=>p[1]))));
    for(let y=minY;y<=maxY;y++) for(let x=minX;x<=maxX;x++) {
      const w1=((x+.5-v[0][0])*(v[2][1]-v[0][1])-(y+.5-v[0][1])*(v[2][0]-v[0][0]))/area;
      const w2=((v[1][0]-v[0][0])*(y+.5-v[0][1])-(v[1][1]-v[0][1])*(x+.5-v[0][0]))/area;
      const w0=1-w1-w2;
      if(w0<0||w1<0||w2<0) continue;
      const z=w0*v[0][2]+w1*v[1][2]+w2*v[2][2], index=y*size+x;
      if(z>=depth[index])continue;
      depth[index]=z; if(onPixel)onPixel(index,tri,[w0,w1,w2]);
    }
  }
  return depth;
}
const shadow=raster(light);
const pixels=Buffer.alloc(size*size*4);
const normal=new T.Vector3(),world=new T.Vector3(),view=new T.Vector3(),half=new T.Vector3();
const aces=x=>Math.max(0,Math.min(1,(x*(2.51*x+.03))/(x*(2.43*x+.59)+.14)));
const srgb=x=>x<=.0031308?x*12.92:1.055*Math.pow(x,1/2.4)-.055;
raster(eye,(index,tri,weights)=>{
  normal.set(0,0,0);world.set(0,0,0);
  tri.vertices.forEach((v,i)=>{normal.addScaledVector(v.n,weights[i]);world.addScaledVector(v.p,weights[i]);});
  normal.normalize();
  const s=project(world,light);let visibility=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const x=Math.max(0,Math.min(size-1,Math.round(s[0])+dx)),y=Math.max(0,Math.min(size-1,Math.round(s[1])+dy));
    visibility+=s[2]-.003>shadow[y*size+x]?.24:1;
  }
  visibility/=9;
  view.copy(eye.position).sub(world).normalize();half.copy(key).add(view).normalize();
  const m=tri.material, diffuse=Math.max(0,normal.dot(key))*visibility;
  const blue=Math.max(0,normal.dot(fill));
  const spec=Math.pow(Math.max(0,normal.dot(half)),24+70*(1-m.roughness))*visibility*(.18+m.metalness*.5);
  ['r','g','b'].forEach((channel,j)=>{
    const light=.27+Math.max(0,normal.y)*.13+diffuse*[1.55,1.35,1.15][j]+blue*[.14,.27,.38][j];
    const value=m.color[channel]*light+spec+m.emissive[channel]*m.emissiveIntensity*.7;
    pixels[index*4+j]=Math.round(srgb(aces(value))*255);
  });
  pixels[index*4+3]=255;
});
// PNG encoder keeps portrait generation portable without native dependencies.
function crc32(b){let c=0xffffffff;for(const n of b){c^=n;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([len,name,data,crc]);}
const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
const raw=Buffer.alloc((size*4+1)*size);for(let y=0;y<size;y++)pixels.copy(raw,y*(size*4+1)+1,y*size*4,(y+1)*size*4);
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
const output=process.argv[2]||'public/volt-portrait.png';await writeFile(output,png);
console.log(`${triangles.length} triangles; ${output}`);
