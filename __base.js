// Unterpfad-Unterstuetzung fuer GitHub Pages (/atllendr). Aendert keine Daten.
(function(){var P='/atllendr';
 var fx=function(v){return (typeof v==='string'&&v.charAt(0)==='/'&&v.charAt(1)!=='/'&&v.indexOf(P+'/')!==0)?P+v:v};
 try{var d=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'src');Object.defineProperty(HTMLIFrameElement.prototype,'src',{configurable:true,enumerable:d.enumerable,get:d.get,set:function(v){d.set.call(this,fx(v))}})}catch(x){}
 document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a)return;var h=a.getAttribute('href');
  if(h&&h.charAt(0)==='/'&&h.charAt(1)!=='/'&&h.indexOf(P+'/')!==0&&!a.target){e.preventDefault();location.assign(P+h)}},true);
 if(!('serviceWorker' in navigator))return;
 navigator.serviceWorker.register(P+'/sw.js',{scope:P+'/'}).then(function(){return navigator.serviceWorker.ready}).then(function(){
  if(!navigator.serviceWorker.controller){var k='atlas-sw-reload';var done=false;try{done=sessionStorage.getItem(k)==='1';sessionStorage.setItem(k,'1')}catch(x){}if(!done)location.reload()}
 }).catch(function(e){console.error('SW',e)});
})();
