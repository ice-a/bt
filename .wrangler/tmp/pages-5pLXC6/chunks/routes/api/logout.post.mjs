import{d as o,m as e,s as t}from"../../_/nitro.mjs";import"node:buffer";import"node:timers";import"node:events";import"node:process";import"cloudflare:workers";const r=o(o=>e.env.WEBPASSWORD?(t(o,"web_unlock","",{httpOnly:!0,sameSite:"lax",path:"/",maxAge:0}),{ok:!0}):{ok:!0});export{r as default};
//# sourceMappingURL=logout.post.mjs.map
