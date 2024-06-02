(()=>{var f,pe={952:f=>{const v="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",x=[62,-1,-1,52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,-1,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,63,-1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51],l=typeof BigInt<"u"?BigInt:Number;function P(M){let c=M;return c&l(1)&&(c=~c),c>>=l(1),+c.toString()}function ue(M){let c="",m=l(M);for(;m>31;){const T=m&l(31)|l(32);c+=v[T],m>>=l(5)}return c+v[m]}function z(M){let c=l(M);const m=c<0;return c<<=l(1),m&&(c=~c),ue(c)}f.exports={encode:function I({precision:M=5,thirdDim:c=0,thirdDimPrecision:m=0,polyline:T}){const Z=10**M,U=10**m,Y=function J(M,c,m){if(M<0||M>15)throw new Error("precision out of range. Should be between 0 and 15");if(m<0||m>15)throw new Error("thirdDimPrecision out of range. Should be between 0 and 15");if(c<0||c>7||4===c||5===c)throw new Error("thirdDim should be between 0, 1, 2, 3, 6 or 7");const T=m<<7|c<<4|M;return ue(1)+ue(T)}(M,c,m),H=[];let re=l(0),j=l(0),D=l(0);return T.forEach(ne=>{const se=l(Math.round(ne[0]*Z));H.push(z(se-re)),re=se;const ee=l(Math.round(ne[1]*Z));if(H.push(z(ee-j)),j=ee,c){const ce=l(Math.round(ne[2]*U));H.push(z(ce-D)),D=ce}}),[...Y,...H].join("")},decode:function y(M){const c=function R(M){let c=l(0),m=l(0);const T=[];if(M.split("").forEach(Z=>{const U=l(function S(M){const c=M.charCodeAt(0);return x[c-45]}(Z));c|=(U&l(31))<<m,(U&l(32))===l(0)?(T.push(c),c=l(0),m=l(0)):m+=l(5)}),m>0)throw new Error("Invalid encoding");return T}(M),m=function k(M,c){if(1!=+M.toString())throw new Error("Invalid format version");const m=+c.toString();return{precision:15&m,thirdDim:m>>4&7,thirdDimPrecision:m>>7&15}}(c[0],c[1]),T=10**m.precision,Z=10**m.thirdDimPrecision,{thirdDim:U}=m;let Y=0,H=0,re=0;const j=[];let D=2;for(;D<c.length;)Y+=P(c[D])/T,H+=P(c[D+1])/T,U?(re+=P(c[D+2])/Z,j.push([Y,H,re]),D+=3):(j.push([Y,H]),D+=2);if(D!==c.length)throw new Error("Invalid encoding. Premature ending reached");return{...m,polyline:j}},ABSENT:0,LEVEL:1,ALTITUDE:2,ELEVATION:3}},619:(f,b,v)=>{"use strict";var x=v(459);function _(n,t,e,r,o,i,a){try{var u=n[i](a),s=u.value}catch(p){return void e(p)}u.done?t(s):Promise.resolve(s).then(r,o)}function E(n){return function(){var t=this,e=arguments;return new Promise(function(r,o){var i=n.apply(t,e);function a(s){_(i,r,o,a,u,"next",s)}function u(s){_(i,r,o,a,u,"throw",s)}a(void 0)})}}var N=v(952),q=v(358);function J(n,t,e){if(void 0===e&&(e={}),n.length<2)throw new Error("coordinates must be an array of two or more positions");return function y(n,t,e){void 0===e&&(e={});var r={type:"Feature"};return(0===e.id||e.id)&&(r.id=e.id),e.bbox&&(r.bbox=e.bbox),r.properties=t||{},r.geometry=n,r}({type:"LineString",coordinates:n},t,e)}function z(n,t){void 0===t&&(t={});var e={type:"FeatureCollection"};return t.id&&(e.id=t.id),t.bbox&&(e.bbox=t.bbox),e.features=n,e}function ae(n,t,e){if(null!==n)for(var r,o,i,a,u,s,p,L,C=0,d=0,G=n.type,A="FeatureCollection"===G,K="Feature"===G,te=A?n.features.length:1,F=0;F<te;F++){u=(L=!!(p=A?n.features[F].geometry:K?n.geometry:n)&&"GeometryCollection"===p.type)?p.geometries.length:1;for(var ie=0;ie<u;ie++){var B=0,W=0;if(null!==(a=L?p.geometries[ie]:p)){s=a.coordinates;var $=a.type;switch(C=!e||"Polygon"!==$&&"MultiPolygon"!==$?0:1,$){case null:break;case"Point":if(!1===t(s,d,F,B,W))return!1;d++,B++;break;case"LineString":case"MultiPoint":for(r=0;r<s.length;r++){if(!1===t(s[r],d,F,B,W))return!1;d++,"MultiPoint"===$&&B++}"LineString"===$&&B++;break;case"Polygon":case"MultiLineString":for(r=0;r<s.length;r++){for(o=0;o<s[r].length-C;o++){if(!1===t(s[r][o],d,F,B,W))return!1;d++}"MultiLineString"===$&&B++,"Polygon"===$&&W++}"Polygon"===$&&B++;break;case"MultiPolygon":for(r=0;r<s.length;r++){for(W=0,o=0;o<s[r].length;o++){for(i=0;i<s[r][o].length-C;i++){if(!1===t(s[r][o][i],d,F,B,W))return!1;d++}W++}B++}break;case"GeometryCollection":for(r=0;r<a.geometries.length;r++)if(!1===ae(a.geometries[r],t,e))return!1;break;default:throw new Error("Unknown Geometry Type")}}}}}function he(n){var t=[1/0,1/0,-1/0,-1/0];return ae(n,function(e){t[0]>e[0]&&(t[0]=e[0]),t[1]>e[1]&&(t[1]=e[1]),t[2]<e[0]&&(t[2]=e[0]),t[3]<e[1]&&(t[3]=e[1])}),t}he.default=he;const Re=he;class Le{constructor(t){this.response=t,this.code=401,this.message="Unauthorized"}}class Me{constructor(){this.latestResponseId=0,this.lastResponseId=0,this.buffer=[],this.maxBuffer=4,this.pending=!1}get hasPendingRequests(){return this.pending}request(t,e){var r=this;return E(function*(){const o=new AbortController,i=Date.now();r.lastResponseId=i,r.pending=!0,r.buffer.length>r.maxBuffer&&(r.buffer[0].abort(),r.buffer.splice(0,1)),r.buffer.push(o);const a=yield fetch(t,{...e,signal:o.signal});if(r.cleanBuffer(o),200!==a.status)throw a;if(r.latestResponseId>i)throw new Error("Prev response");return r.pending=r.lastResponseId!==i,r.latestResponseId=i,yield a.json()})()}abortAllRequests(){this.buffer.forEach(t=>t.abort())}cleanBuffer(t){this.buffer=this.buffer.filter(e=>e!==t)}}const me=(n,t)=>n.some(e=>{const r=t[e.severity];return r&&("all"===r||r.includes(e.code))});function we(n,t){return q(n.map(([e,r])=>({x:e,y:r})),t,!0).map(e=>[+e.y.toFixed(6),+e.x.toFixed(6)])}const xe=new class Ce{constructor(){this.requester=new Me}request(t){var e=this;return E(function*(){try{const r=yield e.requester.request(t.url,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({}),...t.requestParams});if(!r.routes||0===r.routes.length||t.routeExcludeNotice&&((n,t)=>!!me(n.notices||[],t)||(n.routes||[]).some(e=>(e.sections||[]).some(r=>me(r.notices||[],t))))(r,t.routeExcludeNotice))throw new Error("No routes found");const o=r.routes.map((s,p)=>((n,t,e)=>{const{distance:r,cost:o,durationTime:i,waypoints:a,path:u,shape:s,shapePath:p,turnByTurnActions:C}=n.sections.reduce((d,L,G)=>{const A=(L.tolls||[]).reduce((V,O)=>(O.fares||[]).forEach(Q=>V+=(Q.convertedPrice||Q.price).value),0),K=L.summary?.duration||0,te=[];L.departure.place.originalLocation&&te.push(L.departure.place.location),L.arrival.place.originalLocation&&(n.sections.length>=2&&G===n.sections.length-1||1===n.sections.length)&&te.push(L.arrival.place.location);const F=function Fe(n){return(0,N.decode)(n).polyline}(L.polyline),ie=e.shapePolylinePrecision?we(F,e.shapePolylinePrecision):F,B=(L.turnByTurnActions||[]).map(V=>{const[O,Q]=F[V.offset];return{...V,offset:d.path.length+V.offset,position:{lat:O,lng:Q}}});let W=[];if("default"===e.mode&&e.geoJSONShapeSplitStrategies?.default&&e.geoJSONShapeSplitStrategies.default.length>0||"drag"===e.mode&&e.geoJSONShapeSplitStrategies?.drag&&e.geoJSONShapeSplitStrategies.drag.length>0){const V=L.spans?.length;W=L.spans?.reduce((O,Q,le)=>{const Se=F.slice(Q.offset,(le<V-1?L.spans[le+1].offset:F.length-1)+1),oe=e.shapePolylinePrecision?we(Se,e.shapePolylinePrecision):Se,ge=0===le||le===V-1;if(("default"===e.mode&&e.geoJSONShapeSplitStrategies?.default&&e.geoJSONShapeSplitStrategies.default.includes("jamFactor")||"drag"===e.mode&&e.geoJSONShapeSplitStrategies?.drag?.includes("jamFactor"))&&Q.dynamicSpeedInfo){const fe=Q.dynamicSpeedInfo.trafficSpeed/Q.dynamicSpeedInfo.baseSpeed,qe=O[O.length-1]?.properties?.jamFactor;if(fe===qe&&O[O.length-1])O[O.length-1].geometry.coordinates.push(...oe.slice(1,oe.length)),O[O.length-1].properties.isMarginalChunk=ge;else{const Ge=J(oe,{waypoint:d.waypointIndex,routeId:t,jamFactor:fe,isMarginalChunk:ge});O.push(Ge)}}else if(O.length>0)O[O.length-1].geometry.coordinates.push(...oe.slice(1,oe.length));else{const fe=J(oe,{waypoint:d.waypointIndex,routeId:t,isMarginalChunk:ge});O.push(fe)}return O},[])}else{const V=J(ie,{waypoint:d.waypointIndex,routeId:t});W.push(V)}return{distance:d.distance+L.summary?.length||0,durationTime:d.durationTime+K,cost:d.cost+A,waypoints:[...d.waypoints,...te],path:[...d.path,...F],turnByTurnActions:[...d.turnByTurnActions,...B],shape:z([...d.shape?.features||[],...W]),shapePath:[...d.shapePath,...ie],waypointIndex:"vehicle"===L.type&&n.sections[G+1]&&"vehicle"===n.sections[G+1].type?d.waypointIndex+1:d.waypointIndex}},{distance:0,cost:0,waypoints:[],path:[],durationTime:0,turnByTurnActions:[],shape:null,shapePath:[],waypointIndex:0});return{durationTime:i,distance:r,cost:o,path:u,arriveTime:new Date(n.sections[n.sections.length-1].arrival.time),departureTime:new Date(n.sections[0].departure.time),id:t,waypoints:a,label:n.routeLabels?n.routeLabels.map(d=>d.name.value).join(", "):void 0,shape:s,turnByTurnActions:C,shapePath:p,rawRoute:n}})(s,p,t)),i=function ke(n,t){return"fastest"===t?n.reduce(function(r,o){return r?.arriveTime.valueOf()<o?.arriveTime.valueOf()?r:o})?.id:"shortest"===t?n.reduce(function(r,o){return r?.distance<o?.distance?r:o})?.id:"cheapest"===t?n.filter(r=>null!=r.cost).reduce(function(r,o){return r?.cost<o?.cost?r:o})?.id:"none"===t?null:0}(o,t.selectRouteStrategy),u=z(o.reduce((s,p)=>[...s,...p.shape.features.map(C=>({...C,properties:{...C.properties,selected:i===C.properties.routeId}}))],[]));return{routesShapeBounds:Re(u),rawResponse:r,routes:o,selectedRouteId:i,routesShapeGeojson:u,version:performance.now(),latest:!e.requester.hasPendingRequests,mode:t.mode,requestOptions:t}}catch(r){if(r instanceof Response){const o=r,i=yield o.json();if(401===o.status)throw new Le(i)}throw r}})()}hasPendingRequests(){return this.requester.hasPendingRequests}abortAllRequests(){this.requester.abortAllRequests()}};(0,x.p)(xe)},358:(f,b,v)=>{var x;!function(){"use strict";function _(g,l){var y=g.x-l.x,S=g.y-l.y;return y*y+S*S}function E(g,l,y){var S=l.x,R=l.y,k=y.x-S,P=y.y-R;if(0!==k||0!==P){var I=((g.x-S)*k+(g.y-R)*P)/(k*k+P*P);I>1?(S=y.x,R=y.y):I>0&&(S+=k*I,R+=P*I)}return(k=g.x-S)*k+(P=g.y-R)*P}function q(g,l,y,S,R){for(var P,k=S,I=l+1;I<y;I++){var J=E(g[I],g[l],g[y]);J>k&&(P=I,k=J)}k>S&&(P-l>1&&q(g,l,P,S,R),R.push(g[P]),y-P>1&&q(g,P,y,S,R))}function w(g,l){var y=g.length-1,S=[g[0]];return q(g,0,y,l,S),S.push(g[y]),S}function X(g,l,y){if(g.length<=2)return g;var S=void 0!==l?l*l:1;return g=y?g:function N(g,l){for(var R,y=g[0],S=[y],k=1,P=g.length;k<P;k++)_(R=g[k],y)>l&&(S.push(R),y=R);return y!==R&&S.push(R),S}(g,S),w(g,S)}void 0!==(x=function(){return X}.call(b,v,b,f))&&(f.exports=x)}()}},ye={};function h(f){var b=ye[f];if(void 0!==b)return b.exports;var v=ye[f]={exports:{}};return pe[f](v,v.exports,h),v.exports}h.m=pe,h.x=()=>{var f=h.O(void 0,[76],()=>h(619));return h.O(f)},f=[],h.O=(b,v,x,_)=>{if(!v){var N=1/0;for(E=0;E<f.length;E++){for(var[v,x,_]=f[E],q=!0,w=0;w<v.length;w++)(!1&_||N>=_)&&Object.keys(h.O).every(R=>h.O[R](v[w]))?v.splice(w--,1):(q=!1,_<N&&(N=_));if(q){f.splice(E--,1);var X=x();void 0!==X&&(b=X)}}return b}_=_||0;for(var E=f.length;E>0&&f[E-1][2]>_;E--)f[E]=f[E-1];f[E]=[v,x,_]},h.d=(f,b)=>{for(var v in b)h.o(b,v)&&!h.o(f,v)&&Object.defineProperty(f,v,{enumerable:!0,get:b[v]})},h.f={},h.e=f=>Promise.all(Object.keys(h.f).reduce((b,v)=>(h.f[v](f,b),b),[])),h.u=f=>"common.c9b086c64c41730d.js",h.miniCssF=f=>{},h.o=(f,b)=>Object.prototype.hasOwnProperty.call(f,b),(()=>{var f;h.tt=()=>(void 0===f&&(f={createScriptURL:b=>b},typeof trustedTypes<"u"&&trustedTypes.createPolicy&&(f=trustedTypes.createPolicy("angular#bundler",f))),f)})(),h.tu=f=>h.tt().createScriptURL(f),h.p="",(()=>{var f={619:1};h.f.i=(_,E)=>{f[_]||importScripts(h.tu(h.p+h.u(_)))};var v=self.webpackChunklibre_routing_playground=self.webpackChunklibre_routing_playground||[],x=v.push.bind(v);v.push=_=>{var[E,N,q]=_;for(var w in N)h.o(N,w)&&(h.m[w]=N[w]);for(q&&q(h);E.length;)f[E.pop()]=1;x(_)}})(),(()=>{var f=h.x;h.x=()=>h.e(76).then(f)})(),h.x()})();