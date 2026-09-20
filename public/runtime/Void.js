/* Void production subsystem. Extracted from the shipping runtime without behavior changes. */
var Pu=`
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4( position, 1.0 );
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`,Fu=`
  uniform float uTime;
  uniform float uHalf;
  uniform float uRound;
  uniform float uLayer;
  uniform float uAlpha;
  uniform float uAmbient;
  uniform float uGlow;
  varying vec3 vWorld;

  float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float noise( vec2 p ) {
    vec2 i = floor( p ); vec2 f = fract( p );
    vec2 u = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), u.x ), mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
  }
  float fbm( vec2 p ) {
    float v = 0.0; float a = 0.5;
    for ( int i = 0; i < 4; i ++ ) { v += a * noise( p ); p = p * 2.03 + 17.0; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 p = vWorld.xz;
    vec2 q = abs( p ) - vec2( uHalf - uRound );
    float sd = length( max( q, 0.0 ) ) + min( max( q.x, q.y ), 0.0 ) - uRound; // < 0 inside the safe zone
    vec2 flow = vec2( uTime * 0.11, - uTime * 0.07 ) * ( 1.0 + uLayer * 0.35 );
    float n = fbm( p * 0.33 + flow + uLayer * 9.7 );
    float n2 = fbm( p * 0.9 - flow * 1.7 + uLayer * 3.1 );
    float edge = sd + ( n - 0.5 ) * 1.9;
    float body = smoothstep( 0.0, 2.2, edge );
    if ( body <= 0.001 ) discard;
    float dens = body * mix( 0.5, 1.0, n ) * mix( 0.7, 1.0, n2 );
    float rim = smoothstep( 0.0, 0.5, edge ) * ( 1.0 - smoothstep( 0.5, 2.4, edge ) );
    float scan = pow( max( 0.0, sin( ( p.x + p.y ) * 8.0 - uTime * 11.0 ) ), 22.0 );
    float cells = step( 0.82, hash( floor( p * 2.6 ) + floor( uTime * 2.0 ) ) );
    float corrupt = rim * ( scan * 0.42 + cells * ( 0.12 + n2 * 0.22 ) );
    vec3 deep = vec3( 0.07, 0.025, 0.16 );
    vec3 light = vec3( 0.72, 0.16, 1.0 );
    vec3 col = mix( deep, light, n * n2 * 1.45 ) * uAmbient;
    col += vec3( 0.9, 0.18, 1.5 ) * rim * uGlow;
    col += vec3( 1.4, 0.45, 2.2 ) * corrupt * uGlow;
    gl_FragColor = vec4( col, clamp( dens * uAlpha + rim * 0.28 + corrupt * 0.18, 0.0, 0.95 ) );
  }`,Iu=[.34,.3,.26];globalThis.Lu=class{constructor(e){this.game=e,this.half=Lc.gasStartHalf,this.round=5,this.layers=[],this.tickT=0,this.ticks=0,this.fxT=0,this.fragmentT=0,this.pulseT=0,this.edgeColor=new J(12534015),this.sparkColor=new J(17760255);let t=new yr(104,104).rotateX(-Math.PI/2);[.3,.72,1.12].forEach((n,r)=>{let i=new jr({uniforms:{uTime:{value:0},uHalf:{value:this.half},uRound:{value:this.round},uLayer:{value:r},uAlpha:{value:Iu[r]},uAmbient:{value:1},uGlow:{value:1}},vertexShader:Pu,fragmentShader:Fu,transparent:!0,depthWrite:!1}),a=new Ln(t,i);a.position.y=n,a.renderOrder=4,a.userData.noAO=!0,a.frustumCulled=!1,e.scene.add(a),this.layers.push(a)}),this.reset()}reset(){this.half=Lc.gasStartHalf,this.tickT=0,this.ticks=0,this.fxT=0,this.fragmentT=0,this.pulseT=0,this.active=!1;for(let e of this.layers)e.visible=!1}depthAt(e,t){let n=Math.abs(e)-(this.half-this.round),r=Math.abs(t)-(this.half-this.round);return Math.hypot(Math.max(n,0),Math.max(r,0))+Math.min(Math.max(n,r),0)-this.round}update(e,t){let n=this.game,r=$c((t-Lc.gasDelay)/Lc.gasDuration,0,1);this.active=t>Lc.gasDelay-6,this.half=el(Lc.gasStartHalf,Lc.gasEndHalf,r),this.round=el(5,2.2,r);let i=tl(Lc.gasDelay-6,Lc.gasDelay,t);if(this.pulseT=Math.max(0,this.pulseT-e),this.layers.forEach((e,t)=>{e.visible=this.active;let r=e.material.uniforms;r.uTime.value=n.elapsed,r.uHalf.value=this.half,r.uRound.value=this.round;let a=$c((n.lighting.ambientLevel-.36)/.64,0,1),o=n.player&&n.player.alive?$c((this.depthAt(n.player.x,n.player.z)+6)/6,0,1):0;r.uAmbient.value=el(.2,1,a),r.uGlow.value=(.38+n.lighting.night*.18+o*.42)*i,r.uAlpha.value=Iu[t]*i*(.82+o*.18)}),this.active&&(this.fxT-=e,this.fragmentT-=e,this.pulseT<=0&&r>.02&&(this.pulseT=1.15+Math.random()*1.55,(()=>{let e=Math.random()<.5?this.half:-this.half,t=Q(-this.half,this.half),r=Math.random()<.5;let i=r?e:t,a=r?t:e;n.effects.ring(i,a,1.1+Math.random()*1.8,this.sparkColor,.5,2.4),n.effects.flash(i,.3,a,this.edgeColor,5.5,4,.12),n.world.shockwave(i,a,.45)})()),this.fxT<=0)&&(this.fxT=.11+Math.random()*.14,(()=>{let e=Math.random()*Math.PI*2,t=Math.random()<.5?this.half-Q(.3,1.4):-this.half+Q(.3,1.4),r=Math.sin(e)*Math.max(2,this.half-2),i=Math.cos(e)*Math.max(2,this.half-2);Math.random()<.5?t=r:i=t,n.effects.spark(t,Q(.12,.75),i,this.sparkColor),Math.random()<.12&&n.effects.flash(t,.35,i,this.edgeColor,3.5,2.8,.08),this.fragmentT<=0&&(this.fragmentT=.12+Math.random()*.16,n.effects.debris(t,Q(.18,.65),i,10420479,1+Math.floor(Math.random()*2)),n.effects.smoke.emit(t,Q(.1,.45),i,Q(-.25,.25),Q(.5,1.7),Q(-.25,.25),Q(.35,.7),.18,.45,.38,.08,.7,.45,1.8,1.2))})()),!(t<Lc.gasDelay)&&(this.tickT+=e,this.tickT>=1)){--this.tickT,this.ticks++;let e=600+Math.min(this.ticks,60)*25;for(let t of n.brawlers)t.alive&&!t.airborne&&this.depthAt(t.x,t.z)>.35&&(t.takeDamage(e,null,!0),t.isPlayer&&n.audio.play(`gas`))}}};
