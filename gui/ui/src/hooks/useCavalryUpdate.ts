import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText, type CavalryInstall, type CavalryRelease, type DownloadProgress } from "../api";
export type UpdatePhase = "idle" | "checking" | "ready" | "downloading" | "verifying" | "cancelling" | "cancelled" | "downloaded" | "error";
const versionParts = (version: string) => version.split(/[.-]/).slice(0,3).map(value => Number(value) || 0);
function newer(a: string, b: string) { const left=versionParts(a),right=versionParts(b); for(let i=0;i<3;i++){if((left[i]??0)!==(right[i]??0))return (left[i]??0)>(right[i]??0);} return false; }
export function useCavalryUpdate(installs: CavalryInstall[], onDownloaded: (path:string)=>void, onDownloadFailed: (reason:string)=>void) {
  const [open,setOpen]=useState(false);
  const [phase,setPhase]=useState<UpdatePhase>("idle");
  const [release,setRelease]=useState<CavalryRelease|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [path,setPath]=useState<string|null>(null);
  const [progress,setProgress]=useState<DownloadProgress|null>(null);
  const checking=useRef<Promise<void>|null>(null);
  const downloading=useRef(false);
  const cancelRequested=useRef(false);
  const downloadCallback=useRef(onDownloaded); downloadCallback.current=onDownloaded;
  const failureCallback=useRef(onDownloadFailed); failureCallback.current=onDownloadFailed;
  const check=useCallback(() => {
    if (checking.current) return checking.current;
    if (downloading.current) return Promise.resolve();
    setPhase("checking"); setError(null);
    const promise=api.checkCavalryUpdate().then(info=>{setRelease(info);setPhase("ready");}).catch(reason=>{setError(errorText(reason));setPhase("error");}).finally(()=>{checking.current=null;});
    checking.current=promise; return promise;
  },[]);
  useEffect(()=>{void check();},[check]);
  useEffect(()=>{
    let disposed=false;let unlisten:(()=>void)|undefined;
    api.onDownloadProgress(value=>{if(!downloading.current)return;setProgress(value);if(!cancelRequested.current)setPhase(value.phase);}).then(stop=>{if(disposed)stop();else unlisten=stop;}).catch(()=>{if(!disposed)setError("无法读取实时下载进度，完成结果仍会显示。");});
    return()=>{disposed=true;unlisten?.();};
  },[]);
  const download=async()=>{
    if(!release || downloading.current)return;
    downloading.current=true;cancelRequested.current=false;setPhase("downloading");setProgress(null);setError(null);setPath(null);
    try{
      const result=await api.downloadCavalryUpdate(release.version);
      if(result.status==="cancelled")setPhase("cancelled");
      else if(result.path){setPath(result.path);setPhase("downloaded");downloadCallback.current(result.path);}
      else {setError("下载未返回安装包位置，请重试。");setPhase("error");}
    }catch(reason){const message=errorText(reason);setError(message);setPhase("error");failureCallback.current(message);}
    finally{downloading.current=false;cancelRequested.current=false;}
  };
  const cancel=async()=>{cancelRequested.current=true;setPhase("cancelling");try{await api.cancelCavalryDownload();}catch(reason){setError(errorText(reason));}};
  const installed=installs.map(install=>install.version).filter(Boolean).sort((a,b)=>newer(a,b)?-1:newer(b,a)?1:0)[0];
  const hasUpdate=!!release && (!installed || newer(release.version,installed));
  const busy=["downloading","verifying","cancelling"].includes(phase);
  return {open,phase,release,error,path,progress,hasUpdate,installed,busy,check,download,cancel,
    show:()=>{setOpen(true);if(phase==="idle"||phase==="error")void check();},
    close:()=>setOpen(false),
    reveal:async()=>{if(path)try{await api.revealCavalryDownload(path);}catch(reason){setError(errorText(reason));}},
  };
}
export type CavalryUpdateController = ReturnType<typeof useCavalryUpdate>;
