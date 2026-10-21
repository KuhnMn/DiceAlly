async function o(e){let n="development-local",i=await e.savedSource(n);return i?e.active(n,i):(await e.revisions(n)).find(t=>t.active&&t.revision.status==="ready")?.revision}export{o as a};
