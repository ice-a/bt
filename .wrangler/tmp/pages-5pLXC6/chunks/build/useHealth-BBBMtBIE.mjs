import{$ as e,j as a}from"../virtual/entry.mjs";function useHealth(){return a("health",()=>null)}async function refreshHealth(){const a=useHealth();try{a.value=await e("/api/health")}catch{a.value=null}return a.value}export{refreshHealth as r,useHealth as u};
//# sourceMappingURL=useHealth-BBBMtBIE.mjs.map
