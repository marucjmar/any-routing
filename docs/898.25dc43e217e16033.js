(()=>{"use strict";var s,U={898:(s,m,g)=>{var v=6371008.8,d={centimeters:100*v,centimetres:100*v,degrees:v/111325,feet:3.28084*v,inches:39.37*v,kilometers:v/1e3,kilometres:v/1e3,meters:v,metres:v,miles:v/1609.344,millimeters:1e3*v,millimetres:1e3*v,nauticalmiles:v/1852,radians:1,yards:1.0936*v};function p(e,t,r){void 0===r&&(r={});var n={type:"Feature"};return(0===r.id||r.id)&&(n.id=r.id),r.bbox&&(n.bbox=r.bbox),n.properties=t||{},n.geometry=e,n}function C(e,t,r){if(void 0===r&&(r={}),!e)throw new Error("coordinates is required");if(!Array.isArray(e))throw new Error("coordinates must be an Array");if(e.length<2)throw new Error("coordinates must be at least 2 numbers long");if(!$(e[0])||!$(e[1]))throw new Error("coordinates must contain numbers");return p({type:"Point",coordinates:e},t,r)}function _(e,t,r){if(void 0===r&&(r={}),e.length<2)throw new Error("coordinates must be an array of two or more positions");return p({type:"LineString",coordinates:e},t,r)}function N(e){return e%(2*Math.PI)*180/Math.PI}function M(e){return e%360*Math.PI/180}function $(e){return!isNaN(e)&&null!==e&&!Array.isArray(e)}function R(e){if(!e)throw new Error("coord is required");if(!Array.isArray(e)){if("Feature"===e.type&&null!==e.geometry&&"Point"===e.geometry.type)return e.geometry.coordinates;if("Point"===e.type)return e.coordinates}if(Array.isArray(e)&&e.length>=2&&!Array.isArray(e[0])&&!Array.isArray(e[1]))return e;throw new Error("coord must be GeoJSON Point or an Array of numbers")}function te(e){return"Feature"===e.type?e.geometry:e}function he(e,t){var r,n,a,i,o,l,u;for(n=1;n<=8;n*=2){for(r=[],i=!(q(a=e[e.length-1],t)&n),o=0;o<e.length;o++)(u=!(q(l=e[o],t)&n))!==i&&r.push(K(a,l,n,t)),u&&r.push(l),a=l,i=u;if(!(e=r).length)break}return r}function K(e,t,r,n){return 8&r?[e[0]+(t[0]-e[0])*(n[3]-e[1])/(t[1]-e[1]),n[3]]:4&r?[e[0]+(t[0]-e[0])*(n[1]-e[1])/(t[1]-e[1]),n[1]]:2&r?[n[2],e[1]+(t[1]-e[1])*(n[2]-e[0])/(t[0]-e[0])]:1&r?[n[0],e[1]+(t[1]-e[1])*(n[0]-e[0])/(t[0]-e[0])]:null}function q(e,t){var r=0;return e[0]<t[0]?r|=1:e[0]>t[2]&&(r|=2),e[1]<t[1]?r|=4:e[1]>t[3]&&(r|=8),r}function ge(e,t){var r=te(e),n=r.type,a="Feature"===e.type?e.properties:{},i=r.coordinates;switch(n){case"LineString":case"MultiLineString":var o=[];return"LineString"===n&&(i=[i]),i.forEach(function(l){!function ce(e,t,r){var o,l,u,f,h,n=e.length,a=q(e[0],t),i=[];for(r||(r=[]),o=1;o<n;o++){for(f=e[o-1],l=u=q(h=e[o],t);;){if(!(a|l)){i.push(f),l!==u?(i.push(h),o<n-1&&(r.push(i),i=[])):o===n-1&&i.push(h);break}if(a&l)break;a?a=q(f=K(f,h,a,t),t):l=q(h=K(f,h,l,t),t)}a=u}i.length&&r.push(i)}(l,t,o)}),1===o.length?_(o[0],a):function j(e,t,r){return void 0===r&&(r={}),p({type:"MultiLineString",coordinates:e},t,r)}(o,a);case"Polygon":return function D(e,t,r){void 0===r&&(r={});for(var n=0,a=e;n<a.length;n++){var i=a[n];if(i.length<4)throw new Error("Each LinearRing of a Polygon must have 4 or more Positions.");for(var o=0;o<i[i.length-1].length;o++)if(i[i.length-1][o]!==i[0][o])throw new Error("First and last Position are not equivalent.")}return p({type:"Polygon",coordinates:e},t,r)}(ne(i,t),a);case"MultiPolygon":return function ee(e,t,r){return void 0===r&&(r={}),p({type:"MultiPolygon",coordinates:e},t,r)}(i.map(function(l){return ne(l,t)}),a);default:throw new Error("geometry "+n+" not supported")}}function ne(e,t){for(var r=[],n=0,a=e;n<a.length;n++){var o=he(a[n],t);o.length>0&&((o[0][0]!==o[o.length-1][0]||o[0][1]!==o[o.length-1][1])&&o.push(o[0]),o.length>=4&&r.push(o))}return r}var ve=g(841);function B(e,t,r){if(null!==e)for(var n,a,i,o,l,u,f,P,h=0,y=0,L=e.type,E="FeatureCollection"===L,A="Feature"===L,Y=E?e.features.length:1,O=0;O<Y;O++){l=(P=!!(f=E?e.features[O].geometry:A?e.geometry:e)&&"GeometryCollection"===f.type)?f.geometries.length:1;for(var Z=0;Z<l;Z++){var k=0,G=0;if(null!==(o=P?f.geometries[Z]:f)){u=o.coordinates;var F=o.type;switch(h=!r||"Polygon"!==F&&"MultiPolygon"!==F?0:1,F){case null:break;case"Point":if(!1===t(u,y,O,k,G))return!1;y++,k++;break;case"LineString":case"MultiPoint":for(n=0;n<u.length;n++){if(!1===t(u[n],y,O,k,G))return!1;y++,"MultiPoint"===F&&k++}"LineString"===F&&k++;break;case"Polygon":case"MultiLineString":for(n=0;n<u.length;n++){for(a=0;a<u[n].length-h;a++){if(!1===t(u[n][a],y,O,k,G))return!1;y++}"MultiLineString"===F&&k++,"Polygon"===F&&G++}"Polygon"===F&&k++;break;case"MultiPolygon":for(n=0;n<u.length;n++){for(G=0,a=0;a<u[n].length;a++){for(i=0;i<u[n][a].length-h;i++){if(!1===t(u[n][a][i],y,O,k,G))return!1;y++}G++}k++}break;case"GeometryCollection":for(n=0;n<o.geometries.length;n++)if(!1===B(o.geometries[n],t,r))return!1;break;default:throw new Error("Unknown Geometry Type")}}}}}function ie(e){var t=[];return B(e,function(r){t.push(r)}),t}function H(e,t){!function ae(e,t){var r,n,a,i,o,l,u,f,h,y,P=0,L="FeatureCollection"===e.type,E="Feature"===e.type,A=L?e.features.length:1;for(r=0;r<A;r++){for(f=L?e.features[r].properties:E?e.properties:{},h=L?e.features[r].bbox:E?e.bbox:void 0,y=L?e.features[r].id:E?e.id:void 0,o=(u=!!(l=L?e.features[r].geometry:E?e.geometry:e)&&"GeometryCollection"===l.type)?l.geometries.length:1,a=0;a<o;a++)if(null!==(i=u?l.geometries[a]:l))switch(i.type){case"Point":case"LineString":case"MultiPoint":case"Polygon":case"MultiLineString":case"MultiPolygon":if(!1===t(i,P,f,h,y))return!1;break;case"GeometryCollection":for(n=0;n<i.geometries.length;n++)if(!1===t(i.geometries[n],P,f,h,y))return!1;break;default:throw new Error("Unknown Geometry Type")}else if(!1===t(null,P,f,h,y))return!1;P++}}(e,function(r,n,a,i,o){var u,l=null===r?null:r.type;switch(l){case null:case"Point":case"LineString":case"Polygon":return!1!==t(p(r,a,{bbox:i,id:o}),n,0)&&void 0}switch(l){case"MultiPoint":u="Point";break;case"MultiLineString":u="LineString";break;case"MultiPolygon":u="Polygon"}for(var f=0;f<r.coordinates.length;f++)if(!1===t(p({type:u,coordinates:r.coordinates[f]},a),n,f))return!1})}function T(e,t,r){if(void 0===r&&(r={}),!0===r.final)return function Me(e,t){var r=T(t,e);return r=(r+180)%360}(e,t);var n=R(e),a=R(t),i=M(n[0]),o=M(a[0]),l=M(n[1]),u=M(a[1]),f=Math.sin(o-i)*Math.cos(u),h=Math.cos(l)*Math.sin(u)-Math.sin(l)*Math.cos(u)*Math.cos(o-i);return N(Math.atan2(f,h))}function Pe(e,t,r,n){void 0===n&&(n={});var a=R(e),i=M(a[0]),o=M(a[1]),l=M(r),u=function J(e,t){void 0===t&&(t="kilometers");var r=d[t];if(!r)throw new Error(t+" units is invalid");return e/r}(t,n.units),f=Math.asin(Math.sin(o)*Math.cos(u)+Math.cos(o)*Math.sin(u)*Math.cos(l));return C([N(i+Math.atan2(Math.sin(l)*Math.sin(u)*Math.cos(o),Math.cos(u)-Math.sin(o)*Math.sin(f))),N(f)],n.properties)}const oe=function be(e,t,r){void 0===r&&(r={});var n=R(e),a=R(t),i=M(a[1]-n[1]),o=M(a[0]-n[0]),l=M(n[1]),u=M(a[1]),f=Math.pow(Math.sin(i/2),2)+Math.pow(Math.sin(o/2),2)*Math.cos(l)*Math.cos(u);return function re(e,t){void 0===t&&(t="kilometers");var r=d[t];if(!r)throw new Error(t+" units is invalid");return e*r}(2*Math.atan2(Math.sqrt(f),Math.sqrt(1-f)),r.units)};function Q(e,t,r){void 0===r&&(r={});for(var a=te(e).coordinates,i=0,o=0;o<a.length&&!(t>=i&&o===a.length-1);o++){if(i>=t){var l=t-i;if(l){var u=T(a[o],a[o-1])-180;return Pe(a[o],l,u,r)}return C(a[o])}i+=oe(a[o],a[o+1],r)}return C(a[a.length-1])}function V(e,t){return void 0===t&&(t={}),function we(e,t,r){var n=r,a=!1;return function de(e,t){H(e,function(r,n,a){var i=0;if(r.geometry){var o=r.geometry.type;if("Point"!==o&&"MultiPoint"!==o){var l,u=0,f=0,h=0;if(!1===B(r,function(y,P,L,E,A){if(void 0===l||n>u||E>f||A>h)return l=y,u=n,f=E,h=A,void(i=0);var Y=_([l,y],r.properties);if(!1===t(Y,n,a,A,i))return!1;i++,l=y}))return!1}}})}(e,function(i,o,l,u,f){n=!1===a&&void 0===r?i:t(n,i,o,l,u,f),a=!0}),n}(e,function(r,n){var a=n.geometry.coordinates;return r+oe(a[0],a[1],t)},0)}const ue=(e,t)=>Math.abs(e-t)<1e-5,ke=(e=[],t=[])=>ue(e[0],t[0])&&ue(e[1],t[1]),W=e=>`${e[0].toFixed(6)},${e[1].toFixed(6)}`,le=(e=[])=>e[e.length-1];function _e(e){return _(ie(e).reduce((r,n)=>{const a=le(r);return(!a||!ke(a,n))&&r.push(n),r},[]),e.properties)}function Oe(e,t){return"vertical"==(Math.abs(e.localLineBearing)<45||Math.abs(e.localLineBearing)>135?"vertical":"horizontal")?t>0?"left":"right":Math.abs(t)<90?"bottom":"top"}let X=[];(0,ve.Jj)({createChunks(e){X=function Ge(e=[]){const n=function qe(e){return e.reduce((t,r)=>(t[r.properties.routeId]?t[r.properties.routeId].geometry.coordinates=[...t[r.properties.routeId].geometry.coordinates,...r.geometry.coordinates]:t[r.properties.routeId]=r,t),[])}(Array.isArray(e)?e:e.features).map(_e);return function Ce(e){if(e.length<2)return e;const t=e.map(ie),r=new Map;return[].concat(...t).forEach(n=>{r.set(W(n),(r.get(W(n))||0)+1)}),t.map((n,a)=>function Le(e,t,r){const n=[[]];e.forEach(i=>{t.get(W(i))>1?n.push([]):le(n).push(i)});const a=n.filter(i=>i.length>0).reduce((i,o)=>o.length>i.length?o:i,[]);return _(0===a.length?e:a,r)}(n,r,e[a].properties))}(n)}(e.routesShapeGeojson.features)},recalculatePos({bbox:{ne:e,sw:t}}){const n=function Re(e){return function Fe(e){return e.map((t,r)=>{const n=e.slice();n.splice(r,1);const a=function Ae(e,t){return t.map(r=>T(r.lngLat,e.lngLat)).reduce((r,n,a,{length:i})=>r+n/i,0)||0}(t,n);return{lngLat:t.lngLat,anchor:Oe(t,a),properties:t.properties}})}(e.map((e=>t=>{let r=t;"MultiLineString"===t.geometry.type&&(r=_(t.geometry.coordinates[0]),t.geometry.coordinates.forEach((o,l)=>{if(0===l)return;const u=_(o);V(u)>V(r)&&(r=u)}));const n=V(r);return{lngLat:R(Q(r,n*e)),localLineBearing:T(Q(r,n*(e-.1)),Q(r,n*(e+.1))),properties:t.properties}})(.5)))}(X.map(i=>ge(i,[t.lng,t.lat,e.lng,e.lat])).filter(({geometry:{coordinates:i}})=>i.length>0));return{points:n,allInBbox:n.length===X.length}}})}},I={};function c(s){var m=I[s];if(void 0!==m)return m.exports;var g=I[s]={exports:{}};return U[s](g,g.exports,c),g.exports}c.m=U,c.x=()=>{var s=c.O(void 0,[592],()=>c(898));return c.O(s)},s=[],c.O=(m,g,v,d)=>{if(!g){var b=1/0;for(w=0;w<s.length;w++){for(var[g,v,d]=s[w],p=!0,S=0;S<g.length;S++)(!1&d||b>=d)&&Object.keys(c.O).every(x=>c.O[x](g[S]))?g.splice(S--,1):(p=!1,d<b&&(b=d));if(p){s.splice(w--,1);var C=v();void 0!==C&&(m=C)}}return m}d=d||0;for(var w=s.length;w>0&&s[w-1][2]>d;w--)s[w]=s[w-1];s[w]=[g,v,d]},c.d=(s,m)=>{for(var g in m)c.o(m,g)&&!c.o(s,g)&&Object.defineProperty(s,g,{enumerable:!0,get:m[g]})},c.f={},c.e=s=>Promise.all(Object.keys(c.f).reduce((m,g)=>(c.f[g](s,m),m),[])),c.u=s=>"common.4471ab4b5cbd777d.js",c.miniCssF=s=>{},c.o=(s,m)=>Object.prototype.hasOwnProperty.call(s,m),(()=>{var s;c.tt=()=>(void 0===s&&(s={createScriptURL:m=>m},typeof trustedTypes<"u"&&trustedTypes.createPolicy&&(s=trustedTypes.createPolicy("angular#bundler",s))),s)})(),c.tu=s=>c.tt().createScriptURL(s),c.p="",(()=>{var s={898:1};c.f.i=(d,w)=>{s[d]||importScripts(c.tu(c.p+c.u(d)))};var g=self.webpackChunklibre_routing_playground=self.webpackChunklibre_routing_playground||[],v=g.push.bind(g);g.push=d=>{var[w,b,p]=d;for(var S in b)c.o(b,S)&&(c.m[S]=b[S]);for(p&&p(c);w.length;)s[w.pop()]=1;v(d)}})(),(()=>{var s=c.x;c.x=()=>c.e(592).then(s)})(),c.x()})();