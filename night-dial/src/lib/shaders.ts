/** One full-screen triangle; the fragment shader does everything. */
export const VS = `#version 300 es
in vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

/**
 * The dial, drawn on the 2160 × 2160 canvas (2 px per stage px): the recessed groove with its 48 ticks, the sleep arc
 * (bedtime → wake-up) with its shadow and glow, the well round the sphere and the sphere itself, white by day with a
 * starry night side whose terminator follows the sleep window.
 * Uniforms: uB / uW = bedtime / wake-up angle (radians, clockwise from 12 o'clock; uW may pass 2π), uT = time (s, for
 * the twinkle), uP = how hard the knob is pressed (0–1).
 * C = dial centre (stage px), RS = sphere radius, RR = ring radius, TW = ring half width.
 */
export const FS = `#version 300 es
precision highp float;
uniform float uB,uW,uT,uP;
out vec4 o;
const vec2 C=vec2(540.,488.);const float RS=236.,RR=310.,TW=28.,PI=3.14159265;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+7.1;a*=.5;}return s;}
vec4 over(vec4 a,vec4 b){return vec4(b.rgb*b.a+a.rgb*(1.-b.a),b.a+a.a*(1.-b.a));}
vec3 lin(vec3 c){return pow(c,vec3(2.2));}
vec3 arcCol(float u){vec3 a=vec3(.2,.21,.56),b=vec3(.48,.41,.94),c=vec3(.99,.74,.62);return u<.72?mix(a,b,smoothstep(0.,.72,u)):mix(b,c,smoothstep(.72,1.,u));}
float stars(vec2 sp,float sc,float th,float sz,float t){vec2 g=sp*sc,ci=floor(g),fi=fract(g)-.5;float h=hash(ci);if(h<th)return 0.;
 vec2 o2=vec2(hash(ci+3.1),hash(ci+7.7))-.5;float d=length(fi-o2*.55);
 float tw=.6+.4*sin(2.*PI*(t/8.*(1.+floor(h*3.)))+h*50.);return (smoothstep(sz,0.,d)+.35*smoothstep(sz*4.,0.,d))*tw;}
void main(){
 vec2 f=vec2(gl_FragCoord.x,2160.-gl_FragCoord.y)*.5,p=f-C;float r=length(p),aa=.75;vec2 ur=p/max(r,1.),L2=normalize(vec2(-.45,-.9));
 float ph=atan(p.x,-p.y),ang=uB+mod(ph-uB,2.*PI),mid=.5*(uB+uW),half_=.5*(uW-uB);
 vec4 col=vec4(0.);
 // recessed groove
 float s=(r-RR)/TW,tr=smoothstep(TW+aa,TW-aa,abs(r-RR));
 if(tr>0.){float c=.905+.04*s*dot(ur,L2)-.03*(1.-s*s)+.05*smoothstep(.82,.98,s)*max(dot(ur,-L2),0.);
  c-=.05*smoothstep(-.8,-1.,s)*max(dot(ur,L2),0.);
  col=over(col,vec4(vec3(c,c,c+.012),tr));
  float k=ph/(2.*PI)*48.,dk=abs(fract(k+.5)-.5)*2.*PI/48.*RR,hr=step(.5,abs(fract(k*.5+.25)-.5)*2.);
  float tk=smoothstep(1.2,.5,dk)*smoothstep(hr>0.?7.:4.,(hr>0.?7.:4.)-1.5,abs(r-RR));
  col=over(col,vec4(vec3(.74,.74,.8),tk*.85*tr));}
 // arc: soft shadow in the groove, glossy body, ticks show through
 vec2 pb=C+RR*vec2(sin(uB),-cos(uB)),pw=C+RR*vec2(sin(uW),-cos(uW));
 float da=ang<=uW?abs(r-RR):min(length(f-pb),length(f-pw));
 vec2 fs2=f-vec2(0.,5.);vec2 q2=fs2-C;float r2=length(q2),a2=uB+mod(atan(q2.x,-q2.y)-uB,2.*PI);
 float ds=a2<=uW?abs(r2-RR):min(length(fs2-pb),length(fs2-pw));
 col=over(col,vec4(vec3(.15,.12,.4),.22*exp(-pow(max(ds-20.,0.)/7.,2.))*tr));
 float am=smoothstep(23.+aa,23.-aa,da);
 if(am>0.){float u=clamp((ang-uB)/(uW-uB),0.,1.);if(ang>uW)u=length(f-pb)<length(f-pw)?0.:1.;
  float sa=(r-RR)/23.;vec3 c=arcCol(u);
  c=mix(c,vec3(1.),.22*smoothstep(.2,.95,-sa*dot(ur,L2)*2.)*(1.-smoothstep(.95,1.,abs(sa))));
  c*=1.-.14*smoothstep(.3,1.,sa*dot(ur,L2))+.08*uP;
  col=over(col,vec4(c,am));
  float k=ph/(2.*PI)*48.,dk=abs(fract(k+.5)-.5)*2.*PI/48.*RR,hr=step(.5,abs(fract(k*.5+.25)-.5)*2.);
  float tk=smoothstep(1.2,.5,dk)*smoothstep(hr>0.?7.:4.,(hr>0.?7.:4.)-1.5,abs(r-RR))*step(ang,uW);
  col=over(col,vec4(vec3(1.),tk*.45*am));}
 float gl=exp(-pow(max(da-23.,0.)/16.,2.))*(1.-am)*(.1+.1*uP);
 col=over(col,vec4(vec3(.5,.45,.95),gl*smoothstep(RS+6.,RS+30.,r)*smoothstep(RR+TW+40.,RR+TW,r)));
 // the well the sphere sits in
 float wr=r-RS;
 col=over(col,vec4(vec3(.3,.3,.45),(.1*exp(-max(wr,0.)/10.)+.08*exp(-pow(length(p-vec2(8.,20.))-RS,2.)/700.))*step(RS,r)));
 // sphere
 float sm=smoothstep(RS+aa,RS-aa,r);
 if(sm>0.){vec2 q=vec2(p.x,-p.y)/RS;float z=sqrt(max(1.-dot(q,q),0.));vec3 n=vec3(q,z);
  vec2 dir=vec2(sin(mid),cos(mid));float g=.42;vec3 Dt=vec3(dir*cos(g),-sin(g));
  float th=cos(half_)*cos(g),dn=dot(n,Dt),night=smoothstep(th-.03,th+.03,dn);
  float warm=exp(-pow(max(th-dn,0.)/.13,2.))*(1.-night),cool=exp(-pow(max(dn-th,0.)/.05,2.))*night;
  vec3 Ld=normalize(vec3(-.42,.55,.72));
  float grain=vn(q*90.)*.5+vn(q*190.)*.5;
  float dif=clamp((dot(n,Ld)+.25)/1.25,0.,1.),rim=pow(1.-z,2.5),spc=pow(max(dot(reflect(-Ld,n),vec3(0,0,1)),0.),18.);
  vec3 day=lin(vec3(.99,.985,.98))*(.5+.55*dif)-vec3(.07,.07,.05)*rim+spc*.14+(grain-.5)*.012;
  day=mix(day,lin(vec3(1.,.8,.7))*(.62+.4*dif),warm*.55);
  float cs=cos(-mid),sn=sin(-mid);vec2 qr=vec2(cs*n.x-sn*n.y,sn*n.x+cs*n.y);
  vec2 sp=vec2(atan(qr.x,n.z),asin(clamp(qr.y,-1.,1.)));
  float neb=fbm(sp*3.2+3.);
  vec3 ngt=mix(lin(vec3(.075,.08,.22)),lin(vec3(.16,.16,.44)),clamp(.45+.5*dot(n,vec3(dir,.4)),0.,1.));
  ngt+=lin(vec3(.36,.24,.62))*pow(neb,3.)*.5+lin(vec3(.2,.3,.6))*pow(fbm(sp*5.+9.),4.)*.35;
  ngt*=.8+.2*z;
  float st=stars(sp,34.,.55,.07,uT)*.55+stars(sp+.37,13.,.86,.06,uT)*1.2;
  ngt+=vec3(.95,.95,1.)*st*smoothstep(.15,.6,night)*(.5+.5*z);
  ngt+=lin(vec3(.55,.5,1.))*rim*1.1;
  vec3 c=mix(day,ngt,night)+lin(vec3(.68,.6,1.))*cool*.6;
  col=over(col,vec4(pow(max(c,0.),vec3(1./2.2)),sm));}
 o=vec4(col.rgb*col.a,col.a);
}`;
