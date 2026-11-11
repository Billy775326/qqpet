# QQPet 开发指南

本文介绍环境准备、隔离测试、打包发布和已修改的 SWF。所有命令均在仓库根目录执行；仅使用软件请先阅读 [README](../README.md)。

## 环境准备

- Node.js 22（与 CI 保持一致，使用该版本的最新补丁版）及 npm。
- Git 与 Git LFS；`resources/pet/` 中的美术与 Flash 文件通过 LFS 获取。
- Android 构建另需 Android SDK 与 JDK 17；农场 SWF 回归另需 Java、JPEXS FFDec 和 Chrome/Chromium。

```bash
git clone https://github.com/Billy775326/qqpet.git
cd qqpet
git lfs install
git lfs pull
npm ci
npm run dev
```

## 检查与测试

在仓库根目录运行 `npm run typecheck`、`npm test` 和 `npm run test:ui`。UI 测试使用隔离的 Electron 配置与模拟数据，检查屏幕边缘布局、悬停和面板切换，不操作正在运行的宠物。

可运行 `npm run test:ui -- popups` 检查气泡原有定位、菜单展开时的位置稳定性、气泡按钮命中和状态弹窗的关闭清理；Windows 下还会使用独立测试窗口检查弹窗相对任务栏和模拟托盘折叠区的原生层级，不移动实际鼠标。

可运行 `npm run test:ui -- tasks` 使用隔离存档检查原有页签与布局、领奖对应、成长历程奖励防重、重载后已领取状态、面板刷新及关闭清理，并检查四种视口与缩放组合下的布局和实际奖励图标。

可运行 `npm run test:ui -- toys` 检查新增玩具的商城分页、19 张实际图片、重复购买、库存使用与重载，以及三种视口下新增三页的显示；另按程序实际高清资源选择逻辑、三档视口缩放和四个商城页签进行 24 组截图对比，并检查 54 组子分类布局，覆盖原皮肤边框、选中爱心、两排对齐、文字居中及点击区域。`node --experimental-strip-types --test tests/toy-catalog.test.ts tests/task-milestones.test.ts tests/care.test.ts` 覆盖玩具定义及来源、购买条件、使用收益、成长奖励防重、存档兼容和托管用品选择。

可运行 `node --experimental-strip-types --test tests/inventory-mail.test.ts` 检查实时库存足量校验、过期数量、重复库存合并、邮件事务、失败重试、未知库存保留及旧版包裹导入。`npm run test:ui -- inventory` 使用隔离文件存档和真实界面，验证工具取消、888 种邮件附件、文件替换失败恢复、一次保存领取、旧按钮防重、新邮件实时显示、重载与四种视口；不向真实邮箱发送邮件，也不改真实宠物存档。

`node --experimental-strip-types --test tests/fishing-stock.test.ts` 覆盖池塘批量投放的容量、资格、实时余额、独立编号、一次保存、失败重试与旧鱼存档。`npm run test:ui -- fishing` 使用实际池塘 SWF 和真实 Ruffle、静音的隔离实例，通过原生点击验证选鱼页内数量加减、单次支付确认和取消、无额外数量窗口、保存失败重试、确认期间余额变化、普通／粉钻容量、重复确认、选鱼重置、三种视口，以及加载中关闭和桥接清理；不会移动物理鼠标或写入真实池塘。需要先执行 `npm run build` 提供 Ruffle 运行文件。

`npm run test:ui -- fishing-startup` 在隔离实例中测量首次及两次重复打开池塘的同步耗时、协议回调就绪耗时、长任务与帧间隔，并验证连续点击只打开一个池塘、关闭后恢复桥接、加载中关闭及不发生购买。结果保存在 `dist/fishing-startup-results.json`；没有使用固定的机器性能阈值，也不将协议回调就绪视为整个场景已绘制完成。池塘单独使用直接 WebGL 渲染路径，测量方法与限制见[池塘启动说明](pond-startup.zh-CN.md)。

若本机通过独立的 Electron 测试运行时验证，可将该运行时放在忽略的 `dist/` 内，并设置 `QQPET_TEST_ELECTRON_RUNTIME` 为其可执行文件路径；测试会替换该测试运行时的 `resources/app.asar`。不要指定日常使用的程序目录。`QQPET_TEST_RESOURCES` 可指定美术资源根目录；默认使用仓库的 `resources/`。

界面测试使用隔离存档，通过 DevTools 指定测试 CSS 视口与设备缩放，并校验实际渲染尺寸。`display-matrix` 覆盖 1280×720、1366×768、1920×1080、2560×1440、3840×2160、3440×1440、2560×1080、1080×1920 八种物理尺寸，100%、125%、150%、175%、200%、250%、300% 七档缩放，以及任务栏隐藏和四边保留 48 DIP 的工作区；覆盖层另外保留 3 DIP 边带。五类界面共 1,400 组组合，报告保存在 `dist/display-matrix-results.json`。这是渲染器与工作区模拟验证，不能代替所有真实显示器与混合 DPI 多屏实测。

可单独运行显示矩阵：`npm run test:ui -- display-matrix`。设置 `QQPET_DISPLAY_VIEWS` 为逗号分隔的 `menu,setup,shop,controls,mini` 子集，可缩小诊断范围。

Windows 真实任务栏验证需要先运行 `npm run build`，再显式执行 `npm run test:taskbar -- --allow-taskbar-changes`。脚本会短暂切换当前桌面的任务栏常显、自动隐藏与鼠标唤出，使用隔离透明窗口运行生产窗口逻辑，并在结束时恢复原自动隐藏状态与鼠标位置。报告为 `dist/desktop-workarea-results.json`；普通单元测试和界面测试不切换系统任务栏设置。此项只验证实际连接的主屏及当前系统缩放。

农场商店和购买弹窗可单独运行 `node scripts/test-farm-popup.mjs`。先将 `QQPET_TEST_JAVA`、`QQPET_FFDEC_JAR` 和 `QQPET_TEST_BROWSER` 分别设为 Java、JPEXS FFDec JAR 和 Chrome/Chromium 可执行文件路径。测试仅在 `dist/` 中生成带测试入口的 Flash 副本，使用独立浏览器存储验证默认排序、余额变化时的位置稳定、目录及卡片复用、快速切换、滚轮边界、滚动位置、数量范围、连续点击及重复确认；不会操作真实农场存档或物理鼠标。报告和截图保存在输出的 `dist/farm-popup-*` 目录。优化前后测量与默认排序见[农场商店说明](farm-shop-performance.md)。

## 构建

项目目前处于 0.x 初始开发阶段。新增面向用户的功能使用次版本发布，兼容修复使用修订版本；不把同一 0.x 主版本视为无条件兼容承诺。每次正式发布在版本说明中列出存档、配置和升级影响。

```bash
npm run dist   # 类型检查 + 构建 + 打包当前平台安装包到 dist/
```

推送 `v*` 标签时由 GitHub Actions 构建 Windows ZIP 便携版、macOS DMG 和 Linux AppImage／deb，再发布 Release 与 `SHA256SUMS.txt`；只有配置完整 Android 发布签名时才额外提供 APK。其他推送不触发发布构建，也可在 Actions 中手动指定已有发布标签重试构建。版本来自 `package.json`，Android 自动读取同一版本；发布说明从 CHANGELOG 中提取相应版本段落，缺少段落或标签版本不一致时停止发布。

## Android 构建与签名

Android 构建需要 Android SDK，JDK 使用与 CI 一致的 17，可通过 `JAVA_HOME` 指定。Bash 环境可执行 `npm run android`；Windows PowerShell 在仓库根目录执行：

```powershell
npm run typecheck
npm run build:android-web
.\android\gradlew.bat -p android assembleDebug
```

debug 包输出到 `android/app/build/outputs/apk/debug/`。CI 的 release 包需要在仓库 Secrets 中配置签名密钥：

| Secret | 内容 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | keystore 文件的 base64（`base64 -i release.jks`） |
| `ANDROID_KEYSTORE_PASSWORD` | keystore 密码 |
| `ANDROID_KEY_ALIAS` | 密钥别名 |
| `ANDROID_KEY_PASSWORD` | 密钥密码 |

每次发布都必须用同一个 keystore，否则已安装的用户无法覆盖升级。

## 物品获取与使用确认

物品分类在 `src/renderer/pet/data/rarity.json` 显式登记，`rarity.ts` 提供四类名称与查询，`acquisition.ts` 提供最后一份的风险判定。每个已注册库存 ID 恰好归入一类，新增物品须同步审核登记；原名称和描述不参与运行时关键字推断。`reviews` 记录有歧义条目和较易获得条目的人工处理依据，完整规则见[物品分类说明](item-rarity.zh-CN.md)。分类与实际发放途径分离，本轮保留既有商城、奖池、邮件、任务与辅助领取，不修改存档结构。

`node --experimental-strip-types --test tests/item-use.test.ts tests/rarity-catalog.test.ts` 验证分类覆盖、真实物品的最后一份保护、取消、库存竞争、药品、批量数量与托管保留。`node scripts/test-ui.mjs item-use inventory care quantity toys tasks shop` 检查原提示皮肤、四类图鉴及相关界面。物品使用和图鉴用例使用真实分类；仅药品／数值道具的通用边界使用测试构建中的分类替换，不写入生产目录或用户存档。测试使用隔离存档、静音 Electron 窗口及 4 组尺寸／缩放。正式发布仍需执行项目发布回归。

## 改过的 SWF

以下文件用 [JPEXS FFDec](https://github.com/jindrapetrik/jpexs-decompiler) 打过补丁，重新导入资源时不要覆盖：

| 文件 | 改动 |
|---|---|
| `resources/pet/fishing/main.swf` | 鱼苗按满足等级及粉钻条件优先、组内等级升序、同等级鱼的出售单价升序排列，不计产量，移除特殊鱼置顶；可用 `node tools/fix-fishing-order.mjs` 重复应用排序补丁，角标字号与单行显示补丁可用 `node tools/fix-fishing-level.mjs` 重复应用。选鱼页内数量控件及携带数量的支付协议源码位于 `tools/fishing/src/`；设置 `QQPET_TEST_JAVA` 和 `QQPET_FFDEC_JAR` 后运行 `node tools/build-fishing.mjs`，只重新编译这两个类，保留其他素材与补丁 |
| `resources/pet/mstx/qq_mstx.swf` | 隐藏需要联网的「兑换礼包」「魔法爱情石」按钮 |
| `resources/pet/qqfarm/Farm.swf` | 允许在 `file://` 之外启动；「金币」改为「元宝」；商店按解锁状态、等级、出售单价和购买价稳定排序，余额只更新灰显及购买提示；复用目录、卡片和提示层，支持滚轮并保留购买前的滚动位置；商店、仓库和购买弹窗按缩放比例播放动画，购买弹窗防止重复打开和重复确认 |
| `resources/pet/qqfarm/props.swf` | 素材中的「金币」文字改为「元宝」；原滚动条增加内容与滑块同步滚动接口 |
| `resources/pet/qqfarm/com/MyFarm/data/xml/seed.xml` | 种子目录按等级及作物出售单价升序排列，可用 `node tools/sort-farm-seeds.mjs` 重新整理，不修改物品属性；实际商店另按解锁状态、等级、出售单价及购买价稳定排序，余额不参与位置排序 |
| `resources/pet/smallGame/{100ceng,ball,paopao2}/` 下读屏幕尺寸的 26 个 SWF | `Capabilities.screenResolutionX/Y` 改为 `ExternalInterface.call("API.GetScreenWidth/Height")`（Ruffle 返回的是播放器自身尺寸） |

## 目录

| 路径 | 说明 |
|---|---|
| `src/main` | 主进程：窗口、托盘、`app://` 协议、存档、AI 与天气请求 |
| `src/preload` | `window.qqpet` 接口 |
| `src/renderer` | 界面（原生 TypeScript），`pet/` 为养成逻辑，`ui/` 为各窗口，`swf/` 为 Ruffle 封装 |
| `src/shared` | 主进程与渲染层共享的 IPC 与存档类型 |
| `src/android` | Android 版的 `window.qqpet` 实现，经 WebView 接口调用原生层 |
| `android/` | Android 原生工程：悬浮窗服务、游戏页、文件选择、文字分享入口、开机自启 |
| `resources/pet` | 原版资源，`npm run import-assets -- <app.asar>` 可重新导入 |
| `tools/` | 反混淆脚本、原版 CSS 移植脚本、CDP 调试脚本 |
