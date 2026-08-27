const CHUNKS = 11;
const parts = await Promise.all(Array.from({length: CHUNKS}, (_, i) => fetch(`/chunks/app.${String(i+1).padStart(3,'0')}.txt`, {cache:'no-store'}).then(r => { if(!r.ok) throw new Error(`Chunk ${i+1} failed`); return r.text(); })));
const url = URL.createObjectURL(new Blob([parts.join('')], {type:'text/javascript'}));
try { await import(url); } finally { URL.revokeObjectURL(url); }
