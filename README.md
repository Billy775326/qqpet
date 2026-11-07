# QQPet

QQPet 是基于 Arctic Penguin T800 逆向重建的 QQ 宠物复刻项目，提供 Windows、macOS 和 Linux 桌面版，并包含 Android 悬浮窗工程。Flash 内容由 [Ruffle](https://ruffle.rs) 播放。

[下载安装](#下载安装) · [使用指南](docs/user-guide.zh-CN.md) · [更新日志](CHANGELOG.md) · [开发指南](docs/development.zh-CN.md)

> **版权声明**：QQ 宠物的美术资源与 SWF 版权归腾讯所有；旅行照片素材版权归《旅行青蛙·中国之旅》所有。本项目仅供学习交流，请勿用于商业用途。代码许可证不覆盖这些资源。

## 下载安装

当前正式版为 **[v0.3.0](https://github.com/Billy775326/qqpet/releases/tag/v0.3.0)**。从 [Releases](https://github.com/Billy775326/qqpet/releases/latest) 下载对应平台的文件；同页提供 `SHA256SUMS.txt`，可用于核对下载文件的 SHA-256。

| 平台 | 下载文件 | 运行方式 |
| --- | --- | --- |
| Windows x64 | `QQPet-<版本>-win-x64-portable.zip` | 解压到可写目录，运行 `QQPet.exe`，无需安装 |
| macOS Apple 芯片 | `QQPet-<版本>-arm64.dmg` | 将 QQPet 拖入“应用程序” |
| macOS Intel | `QQPet-<版本>.dmg` | 将 QQPet 拖入“应用程序” |
| Linux x64 | `QQPet-<版本>.AppImage` 或 `qqpet_<版本>_amd64.deb` | AppImage 添加执行权限后运行，或安装 deb |

### Android

Android 工程要求 Android 11 及以上。Android APK 仅在仓库配置发布签名时提供，当前版本以 Release 附件为准；自行构建与签名见[开发指南](docs/development.zh-CN.md#android-构建与签名)。

### Windows 首次使用与升级

1. 将 ZIP 完整解压到有写入权限的目录，运行 `QQPet.exe`。
2. 在选蛋页领养宠物，也可导入已有存档；宠物和托盘图标提供日常操作入口。
3. 升级时先退出 QQPet，备份整个旧目录，再把旧目录的整个 `data/` 复制到新版本目录，之后启动新版本。不要在运行中覆盖程序。

`data/` 保存宠物存档、浏览器存储、加密凭据等应用数据。单独导出宠物 JSON 不能代替整个目录的备份。Windows 便携版不启用开机自启；数据与 API Key 的迁移规则见[使用指南](docs/user-guide.zh-CN.md#数据备份与-api-key)，本次兼容变化见 [v0.3.0 升级说明](docs/releases/v0.3.0.zh-CN.md)。

<details>
<summary>首次运行的系统提示与 Linux 安装命令</summary>

桌面产物没有代码签名，首次运行可能被系统拦截。

- **Windows**：SmartScreen 提示“Windows 已保护你的电脑”时，可点“更多信息”查看“仍要运行”。
- **macOS**：可先尝试打开，再到“系统设置 → 隐私与安全性”中选择“仍要打开”。若提示“已损坏”或无法验证开发者，可在终端执行一次：

  ```bash
  xattr -cr /Applications/QQPet.app
  ```

- **Linux AppImage**：

  ```bash
  chmod +x QQPet-*.AppImage
  ./QQPet-*.AppImage
  ```

  若提示缺少 FUSE，Ubuntu 22.04 可安装 `libfuse2`，24.04 可安装 `libfuse2t64`。
- **Linux deb**：

  ```bash
  sudo apt install ./qqpet_*_amd64.deb
  ```

</details>

## 功能

| 玩法 | 内容 |
| --- | --- |
| 宠物养成 | 选蛋领养、成长升级、饥饿／清洁／心情／健康、生病就医、死亡复活和重生 |
| 学习与日常 | 课程、升学考试、打工、全国旅游、奇遇、纪念品和旅行相簿；活动进度在关闭应用期间继续计时 |
| 商城与会员 | 购物车、背包、食品／清洁用品／药品／玩具／装扮，粉钻、贴心宝贝及会员倒计时；元宝充值为本地模拟，不涉及真实付款 |
| 任务与收藏 | 每日任务、地区旅游挑战、68 项永久成长目标、签到、图鉴，以及节日／生日／旅行邮件 |
| 托管照料 | 配置喂食、清洁和玩耍用品与触发比例；可选自动补购、自动完成可托管的每日任务并领奖，这两项默认关闭 |
| 活动与游戏 | 池塘养鱼、QQ 农场、密室探险、桌面互动小游戏及独立窗口小游戏 |
| 桌面交互 | 左右贴边 mini、移入探头、点击展开、托盘菜单、天气播报、节日问候、透明度、免打扰、全屏应用前台自动隐藏和高清素材 |
| 可选 AI | 连接 OpenAI 兼容接口，进行聊天、台词改写、剪贴板文字点评或翻译；无需配置 AI 即可使用养成功能 |

具体操作、续费规则和托管边界见[使用指南](docs/user-guide.zh-CN.md)；永久目标的物品与元宝奖励见[成长任务奖励明细](docs/task-rewards.zh-CN.md)。

## 截图

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/pet.png" alt="桌面宠物与右键菜单"><br>桌面宠物与右键菜单</td>
    <td width="50%"><img src="docs/screenshots/shop.png" alt="商城与背包"><br>商城与背包</td>
  </tr>
</table>

<details>
<summary>更多界面截图</summary>

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/petinfo.png" alt="宠物资料"><br>宠物资料</td>
    <td width="50%"><img src="docs/screenshots/signin.png" alt="图鉴与签到"><br>图鉴与签到</td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/task.png" alt="今日任务"><br>今日任务</td>
    <td><img src="docs/screenshots/travel.png" alt="全国旅游"><br>全国旅游</td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/setup.png" alt="系统设置"><br>系统设置</td>
    <td></td>
  </tr>
</table>

</details>

## 已知限制

- 池塘与农场仍使用原 Flash 图形指针，分别受原始 24 FPS、20 FPS 限制，可能有跟手不顺的感觉；独立高刷新指针尚未实现。
- 分辨率、DPI 与任务栏工作区经过模拟组合测试，不能保证所有真实显示器、混合 DPI 多屏和窗口管理器的表现完全一致。
- Windows 便携模式约束应用自身的数据位置，不保证操作系统、驱动或安全软件不留下运行记录。

## 开发

使用 Node.js 22（与 CI 保持一致）和 Git LFS，在仓库根目录执行：

```bash
git lfs install
git lfs pull
npm ci
npm run dev
```

完整克隆步骤、环境准备和隔离测试方法见[开发指南](docs/development.zh-CN.md)。

### 检查与测试

在仓库根目录运行 `npm test`、`npm run typecheck` 和 `npm run test:ui`。测试范围、单独运行方法及真实任务栏测试的影响见[检查与测试](docs/development.zh-CN.md#检查与测试)。

## 构建

```bash
npm run dist
```

此命令检查类型、构建并打包当前平台的产物到 `dist/`。三平台发布工作流、Android 签名及检查命令见[构建说明](docs/development.zh-CN.md#构建)。普通分支推送不会触发正式发布。

## 改过的 SWF

重新导入资源前，请查看[SWF 补丁清单](docs/development.zh-CN.md#改过的-swf)，避免覆盖已修复的资源。农场商店的默认排序与性能测量见[农场商店说明](docs/farm-shop-performance.md)。

## 目录

主进程位于 `src/main/`，界面与养成逻辑位于 `src/renderer/`，原版资源位于 `resources/pet/`；完整模块说明见[目录说明](docs/development.zh-CN.md#目录)。

## 文档导航

| 文档 | 用途 |
| --- | --- |
| [使用指南](docs/user-guide.zh-CN.md) | 商城、粉钻与贴心宝贝、托管、任务和数据备份 |
| [v0.3.0 升级说明](docs/releases/v0.3.0.zh-CN.md) | 本次版本变化、兼容范围与升级步骤 |
| [更新日志](CHANGELOG.md) | 按版本维护的用户可见变化 |
| [成长任务奖励](docs/task-rewards.zh-CN.md) | 68 项永久目标的奖励明细 |
| [农场商店说明](docs/farm-shop-performance.md) | 排序规则、性能改动与测量边界 |
| [开发指南](docs/development.zh-CN.md) | 环境、测试、构建、SWF 补丁与目录结构 |

## 许可证

本项目代码以 [GPL-3.0](LICENSE) 发布。该许可证不覆盖 `resources/pet/` 下的原版美术资源、SWF 与旅行照片，其版权归各自所有者，见文首版权声明。

## 友情链接

本项目认可 [LINUX DO](https://linux.do) 社区。
