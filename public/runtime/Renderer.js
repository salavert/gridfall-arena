/* Renderer production subsystem. Extracted from the shipping runtime without behavior changes. */
var Vc=[`Kilo-9`,`Mirage`,`Sable`,`Ion`,`Moth`,`Echo`,`Brick`,`Glitch`,`Cipher`,`Rook`,`Pulse`,`Null`,`Vector`,`Chrome`],Hc={easy:{label:`Easy`,damage:.5,skill:[.3,.6],react:1.9,cadence:1.6,hunters:1,engage:5.5},normal:{label:`Normal`,damage:.68,skill:[.45,.78],react:1.4,cadence:1.3,hunters:2,engage:6.5},hard:{label:`Hard`,damage:.85,skill:[.62,.95],react:1,cadence:1,hunters:3,engage:9}},Uc={low:{label:`Low`,dpr:1,msaa:0,shadowMap:1024,pcss:!1,tier:0,ao:!1,bloom:!0,lampShadows:!1,lampMap:512,poolLights:4},medium:{label:`Medium`,dpr:1,msaa:2,shadowMap:2048,pcss:!0,tier:1,ao:!1,bloom:!0,lampShadows:!0,lampMap:512,poolLights:6},high:{label:`High`,dpr:1.25,msaa:4,shadowMap:4096,pcss:!0,tier:2,ao:!0,bloom:!0,lampShadows:!0,lampMap:1024,poolLights:10},ultra:{label:`Ultra`,dpr:2,msaa:4,shadowMap:4096,pcss:!0,tier:3,ao:!0,bloom:!0,lampShadows:!0,lampMap:2048,poolLights:12}},Wc=`

		#define PCSS_SUN_DEPTH_SOFTNESS ${(120*.085*.5).toFixed(4)}
		#define PCSS_SUN_MAX_WORLD ${.2.toFixed(4)}
		#define PCSS_LAMP_NEAR ${Rc.near.toFixed(4)}
		#define PCSS_LAMP_FAR ${Rc.far.toFixed(4)}
		#define PCSS_LAMP_MAX_UV ${.022.toFixed(4)}
		#define PCSS_NOISE_PERIOD ${64 .toFixed(1)}

		float pcssNoise( vec2 p ) {

			return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) );

		}

		vec2 pcssDisk( int i, float n, float phi ) {

			float r = sqrt( ( float( i ) + 0.5 ) / n );
			float theta = float( i ) * 2.399963229728653 + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;

		}

		float pcssLinearDepth( float z ) {

			return PCSS_LAMP_NEAR * PCSS_LAMP_FAR / ( PCSS_LAMP_FAR - z * ( PCSS_LAMP_FAR - PCSS_LAMP_NEAR ) );

		}

		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {

			float shadow = 1.0;

			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;

			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;

			if ( frustumTest ) {

				float packed = abs( shadowRadius );
				float tier = floor( packed );
				float param = packed - tier;
				bool persp = shadowRadius < 0.0;

				int nSearch = 8 + int( tier ) * 4;
				int nFilter = 10 + int( tier ) * 8;
				float fSearch = float( nSearch );
				float fFilter = float( nFilter );

				float zR = shadowCoord.z;
				float texel = 1.0 / shadowMapSize.x;
				float maxRadius = persp ? PCSS_LAMP_MAX_UV : PCSS_SUN_MAX_WORLD * param * 0.1;
				// Rotate the sample disk per shadow-map texel, not per screen pixel. A
				// screen-space pattern slides over the world whenever the camera pans, and
				// every penumbra shimmers. The pattern repeats every PCSS_NOISE_PERIOD
				// texels and the shadow frustum only ever moves in whole periods (see
				// Lighting.fitShadow), so the grain stays glued to the ground.
				vec2 grainCell = mod( floor( shadowCoord.xy * shadowMapSize ), PCSS_NOISE_PERIOD );
				float phi = pcssNoise( grainCell ) * 6.28318530718;

				// 1. blocker search: average depth of whatever sits between us and the light

				float blockerSum = 0.0;
				float blockers = 0.0;

				for ( int i = 0; i < 20; i ++ ) {

					if ( i >= nSearch ) break;
					float d = textureLod( shadowMap, shadowCoord.xy + pcssDisk( i, fSearch, phi ) * maxRadius, 0.0 ).r;
					if ( d < zR ) { blockerSum += d; blockers += 1.0; }

				}

				if ( blockers >= fSearch ) {

					shadow = 0.0; // deep umbra, skip the filter

				} else if ( blockers > 0.5 ) {

					// 2. penumbra width grows with the blocker -> receiver distance

					float zB = blockerSum / blockers;
					float radius;

					if ( persp ) {

						float lR = pcssLinearDepth( zR );
						float lB = pcssLinearDepth( zB );
						radius = ( lR - lB ) / ( lB * lR ) * param;

					} else {

						radius = ( zR - zB ) * PCSS_SUN_DEPTH_SOFTNESS * param * 0.1;

					}

					radius = clamp( radius, texel * 1.25, maxRadius );

					// 3. variable-width percentage-closer filter

					float lit = 0.0;

					for ( int i = 0; i < 34; i ++ ) {

						if ( i >= nFilter ) break;
						lit += step( zR, textureLod( shadowMap, shadowCoord.xy + pcssDisk( i, fFilter, phi + 1.7 ) * radius, 0.0 ).r );

					}

					shadow = lit / fFilter;

				}

			}

			return mix( 1.0, shadow, shadowIntensity );

		}

`,Gc=null;function Kc(e){let t=e.indexOf(`#elif defined( SHADOWMAP_TYPE_VSM )`);if(t<0)return null;let n=/#[ \t]*(ifdef|ifndef|if|elif|else|endif)\b/g;n.lastIndex=t+5;let r=0,i=-1,a;for(;a=n.exec(e);){let t=a[1];if(t===`if`||t===`ifdef`||t===`ifndef`)r++;else if(t===`endif`){if(r===0)return i<0?null:e.slice(i,a.index).includes(`float getShadow( sampler2D shadowMap`)?{start:i,end:a.index}:null;r--}else if(t===`else`&&r===0&&i<0){let t=e.indexOf(`
`,a.index);i=t<0?a.index+a[0].length:t}}return null}function qc(){let e=`getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay )`,t=`getDistanceAttenuation( max( lightDistance, ${Rc.nearClamp.toFixed(2)} ), spotLight.distance, spotLight.decay )`,n=Y.lights_pars_begin;n.includes(e)?Y.lights_pars_begin=n.replace(e,t):console.warn(`[pipeline] spot light chunk changed - lamps keep plain inverse-square falloff`)}function Jc(){if(Gc!==null)return Gc;qc();let e=Y.shadowmap_pars_fragment,t=Kc(e);return t?(Y.shadowmap_pars_fragment=e.slice(0,t.start)+`
`+Wc+`
	`+e.slice(t.end),Gc=!0,!0):(console.warn(`[pipeline] shadow chunk layout changed - falling back to hardware PCF shadows`),Gc=!1,!1)}var Yc={name:`SanitizeShader`,uniforms:{tDiffuse:{value:null}},vertexShader:`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`,fragmentShader:`
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D( tDiffuse, vUv );
      bvec3 bad = bvec3( isnan( c.r ) || isinf( c.r ), isnan( c.g ) || isinf( c.g ), isnan( c.b ) || isinf( c.b ) );
      c.rgb = mix( c.rgb, vec3( 0.0 ), vec3( bad ) );
      gl_FragColor = vec4( clamp( c.rgb, 0.0, 120.0 ), 1.0 );
    }`},Xc={name:`GradeShader`,uniforms:{tDiffuse:{value:null},uVignette:{value:.3},uSaturation:{value:1.02},uTint:{value:new J(1,1,1)},uFocus:{value:.065},uPeripheral:{value:.09},uCombat:{value:0}},vertexShader:`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uSaturation;
    uniform vec3 uTint;
    uniform float uFocus;
    uniform float uPeripheral;
    uniform float uCombat;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D( tDiffuse, vUv );
      vec2 d = ( vUv - 0.5 ) * vec2( 1.0, 1.12 );
      float v = smoothstep( 0.9, 0.3, length( d ) );
      c.rgb *= mix( 1.0 - uVignette, 1.0, v );
      float l = dot( c.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
      // split-tone: uTint colours the dark end only, so lamp-lit areas keep their warmth
      vec3 tint = mix( uTint, vec3( 1.0 ), smoothstep( 0.04, 0.75, l ) );
      c.rgb = max( mix( vec3( l ), c.rgb, uSaturation ), 0.0 ) * tint;
      float focus = 1.0 - smoothstep( 0.12, 0.72, length( ( vUv - 0.5 ) * vec2( 0.88, 1.0 ) ) );
      float l2 = dot( c.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
      float peripheral = ( 1.0 - focus ) * uPeripheral * ( 0.72 + uCombat * 0.55 );
      c.rgb = mix( c.rgb, vec3( l2 ), clamp( peripheral, 0.0, 0.22 ) );
      c.rgb *= mix( 1.0 - uFocus, 1.0 + uFocus * ( 0.24 + uCombat * 0.08 ), focus );
      gl_FragColor = c;
    }`};globalThis.Zc=class{constructor(e,t,n){this.scene=t,this.camera=n,this.pcssAvailable=Jc();let r=new uc({canvas:e,antialias:!1,powerPreference:`high-performance`,stencil:!1});this.renderer=r,r.outputColorSpace=k,r.toneMapping=4,r.toneMappingExposure=1,r.shadowMap.enabled=!0,r.shadowMap.type=+!this.pcssAvailable,r.shadowMap.autoUpdate=!1,r.setClearColor(724506,1),this.qualityName=`high`,this.quality=Uc.high,this.toggles={ao:!0,bloom:!0},this.superSample=0,this.composer=null,this.width=1,this.height=1}get usingPCSS(){return this.pcssAvailable&&this.quality.pcss}setQuality(e){if(!Uc[e])return;this.qualityName=e,this.quality=Uc[e];let t=+!this.usingPCSS;this.renderer.shadowMap.type!==t&&(this.renderer.shadowMap.type=t),this.build()}build(){let e=this.quality,t=this.renderer,n=Math.max(2,window.innerWidth),r=Math.max(2,window.innerHeight),i=this.superSample||Math.min(window.devicePixelRatio||1,e.dpr);t.setPixelRatio(i),t.setSize(n,r,!1),this.width=n,this.height=r,this.composer&&(this.composer.passes.forEach(e=>e.dispose&&e.dispose()),this.composer.renderTarget1.dispose(),this.composer.renderTarget2.dispose());let a=t.getDrawingBufferSize(new V),o=new yc(t,new Fe(a.x,a.y,{type:u,samples:e.msaa}));if(o.setPixelRatio(i),o.setSize(n,r),this.composer=o,o.addPass(new bc(this.scene,this.camera)),o.addPass(new gc(Yc)),this.gtao=null,e.ao){let e=new Ac(this.scene,this.camera,a.x,a.y);e.output=Ac.OUTPUT.Default,e.blendIntensity=.85,e.updateGtaoMaterial({radius:.55,distanceExponent:1.4,thickness:1.2,scale:1.15,samples:16,distanceFallOff:1,screenSpaceRadius:!1}),e.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:7,radiusExponent:1.2,rings:2,samples:14});let t=e._overrideVisibility.bind(e);e._overrideVisibility=function(){t();let e=this._visibilityCache;this.scene.traverse(t=>{t.userData.noAO&&t.visible&&(t.visible=!1,e.push(t))})},e.enabled=this.toggles.ao,o.addPass(e),this.gtao=e}this.bloom=new Mc(new V(a.x,a.y),.3,.56,1.42),this.bloom.enabled=e.bloom&&this.toggles.bloom,o.addPass(this.bloom),this.grade=new gc(Xc),o.addPass(this.grade),o.addPass(new Pc)}setToggle(e,t){this.toggles[e]=t,e===`ao`&&this.gtao&&(this.gtao.enabled=t),e===`bloom`&&this.bloom&&(this.bloom.enabled=t&&this.quality.bloom)}resize(){let e=Math.max(2,window.innerWidth),t=Math.max(2,window.innerHeight);(e!==this.width||t!==this.height)&&(this.width=e,this.height=t,this.renderer.setSize(e,t,!1),this.composer.setSize(e,t),this.camera.aspect=e/t,this.camera.updateProjectionMatrix())}render(e){this.renderer.shadowMap.needsUpdate=!0,this.composer.render(e)}};
