const {contextBridge,ipcRenderer}=require('electron')
contextBridge.exposeInMainWorld('qqpet',{
  load:()=>ipcRenderer.invoke('fixture:load'),
  save:patch=>{const error=ipcRenderer.sendSync('fixture:save',patch);if(error)throw new Error(error)},
  keyStorage:async()=> '隔离测试',
  setFocusable:()=>{},setMenuOpen:()=>{}
})
