import type { CavalryUpdateController } from "../hooks/useCavalryUpdate";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
export function UpdateDialog({ update }: {update:CavalryUpdateController}) {
  if(!update.open)return null;
  const {phase,release,error,busy,progress}=update;
  const percent=progress?.total ? Math.min(100,Math.round(progress.downloaded/progress.total*100)):null;
  const title=phase==="downloaded"?"安装包已准备好":phase==="checking"?"检查 Cavalry 更新":update.hasUpdate?"发现新版 Cavalry":"Cavalry 软件更新";
  return <Modal title={title} icon={phase==="downloaded"?"check":"download"} onClose={update.close} closeLabel={busy?"隐藏下载进度":"关闭更新窗口"} className="update-dialog" actions={(close) => <>
    {busy?<><button type="button" className="secondary-button" onClick={close}>后台下载</button><button type="button" className="quiet-button" disabled={phase==="cancelling"} onClick={()=>void update.cancel()}>{phase==="cancelling"?"正在取消…":"取消下载"}</button></>
      :phase==="downloaded"?<><button type="button" className="secondary-button" onClick={close}>完成</button><button type="button" className="primary-button" onClick={()=>void update.reveal()}><Icon name="folder"/>打开下载位置</button></>
      :<>{phase!=="checking"&&phase!=="error"&&<button type="button" className="quiet-button" onClick={()=>void update.check()}>重新检查</button>}<button type="button" className="secondary-button" data-autofocus onClick={close}>关闭</button>{phase==="error"?<button type="button" className="primary-button" onClick={()=>void update.check()}>重新检查</button>:release&&phase!=="checking"&&<button type="button" className="primary-button" disabled={!release.downloadSupported} onClick={()=>void update.download()}><Icon name="download"/>{update.hasUpdate?"下载安装包":"重新下载安装包"}</button>}</>}
  </>}>
    {phase==="checking"?<div className="operation-state" role="status"><span className="progress-spinner" aria-hidden/><p>正在向官网确认最新版本…</p></div>
      :phase==="downloaded"?<div className="operation-state"><span className="state-symbol success"><Icon name="check"/></span><p>Cavalry {release?.version} 已下载至“下载”文件夹。</p><p className="muted">打开安装包后可保留旧版本并存，不会自动替换。</p></div>
      :<>
        {release&&<div className="version-comparison"><div><span>本机最新</span><strong>{update.installed??"未安装"}</strong></div><Icon name="arrow"/><div><span>官网最新</span><strong>{release.version}</strong></div></div>}
        {release&&!busy&&phase!=="error"&&<p className="update-result" role="status">{phase==="cancelled"?"下载已取消，未完成的文件已移除。":update.hasUpdate?"新版已可下载，现有版本会保留。":"本机已有官网最新版本。"}</p>}
        {busy&&<div className="download-progress" role="status"><div className="progress-caption"><span>{phase==="verifying"?"正在校验安装包…":phase==="cancelling"?"正在取消下载…":"正在下载安装包…"}</span><span>{percent!==null?`${percent}%`:""}</span></div><progress aria-label="安装包下载进度" max={100} value={percent??undefined}/><p className="muted">{phase==="cancelling"?"取消后不会保留未完成的文件。":"可以关闭此窗口，下载会继续。"}</p></div>}
        {release&&!busy&&<p className="muted update-source">版本信息来自 Cavalry 官网。{!release.downloadSupported?"此平台请前往官网下载对应安装包。":"仅下载，不修改已安装的 Cavalry。"}</p>}
      </>}
    {error&&<p className="field-error" role="alert">{error}</p>}
  </Modal>;
}
