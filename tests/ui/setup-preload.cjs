const {contextBridge,ipcRenderer}=require('electron')
contextBridge.exposeInMainWorld('qqpet',{
  load:()=>ipcRenderer.invoke('fixture:load'),
  save:patch=>{const error=ipcRenderer.sendSync('fixture:save',patch);if(error)throw new Error(error)},
  keyStorage:async()=> '隔离测试：密钥已加密保存，同一用户重启后可继续使用。',
  setFocusable:()=>{},setMenuOpen:()=>{},
  messageBox:options=>ipcRenderer.invoke('fixture:question',options),
  exportSave:()=>ipcRenderer.invoke('fixture:export'),
  importSave:()=>ipcRenderer.send('fixture:import'),
  resetPet:()=>ipcRenderer.send('fixture:reset'),
  aiModels:config=>ipcRenderer.invoke('fixture:models',config),
  aiChat:(config,messages)=>ipcRenderer.invoke('fixture:chat',config,messages),
})
