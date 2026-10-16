// Loaded only into the separate manual runtime. No production imports.
const net=require('node:net'),dns=require('node:dns');
const local=h=>['localhost','127.0.0.1','::1','[::1]'].includes(String(h).toLowerCase());
const refuse=()=>{throw new Error('MANUAL_TEST_EXTERNAL_NETWORK_DENIED');};
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){let opts=Array.isArray(args[0])?args[0]:args;let host=typeof opts[0]==='object'?opts[0]?.host:typeof opts[1]==='string'?opts[1]:'localhost';if(host&&!local(host))refuse();return connect.apply(this,args);};
const lookup=dns.lookup;dns.lookup=function(host,...args){if(!local(host))refuse();return lookup.call(this,host,...args);};
const promiseLookup=dns.promises.lookup;dns.promises.lookup=async function(host,...args){if(!local(host))refuse();return promiseLookup.call(this,host,...args);};
const fetch=globalThis.fetch;globalThis.fetch=function(input,...args){const u=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(!local(u.hostname))refuse();return fetch.call(this,input,...args);};
